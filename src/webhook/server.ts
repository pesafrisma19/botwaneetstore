import { Hono } from 'hono';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../lib/logger';
import { getSocketInstance } from '../whatsapp/client';
import { getInvoicePhone, getInvoiceTarget, removeInvoiceMapping } from '../storage/session';
import { formatRupiah } from '../lib/utils';

export interface WebhookPayload {
  event?: string;
  eventId?: string;
  timestamp?: string;
  data?: Record<string, any>;
}

function verifySignature(body: string, signature: string): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', config.webhookSecret)
    .update(body)
    .digest('hex');
  const provided = signature.replace(/^sha256=/, '');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

function mapEventToMessage(event: string, data: Record<string, any>): string | null {
  const refId = data?.refId || data?.invoiceId || data?.clientRefId || '';
  const productName = data?.productName || data?.sku || '';

  switch (event) {
    case 'order.processing':
      if (data?.paymentMethod === 'SALDO_AKUN') {
        return null;
      }
      return `⏳ *PESANAN DIPROSES*\n\n» *Invoice:* ${refId}\n» *Produk:* ${productName}\n\nTunggu sebentar, pesananmu sedang dikerjakan otomatis.`;
    case 'order.success':
      return `✅ *PESANAN SUKSES*\n\n» *Invoice:* ${refId}\n» *Produk:* ${productName}\n${data?.serialNumber ? `» *Serial:* ${data.serialNumber}\n` : ''}${data?.message ? `» *Catatan:* ${data.message}\n` : ''}\nTerimakasih telah bertransaksi!`;
    case 'order.failed':
      return `❌ *PESANAN GAGAL*\n\n» *Invoice:* ${refId}\n» *Produk:* ${productName}\n${data?.message ? `» *Catatan:* ${data.message}\n` : ''}\nMaaf atas kendalanya.`;
    case 'deposit.success': {
      const invoiceId = data?.invoiceId || data?.refId || '';
      const clientRef = data?.clientRefId || (data?.refId !== invoiceId ? data?.refId : '') || '';
      let msg = `✅ *DEPOSIT BERHASIL*\n\n`;
      msg += `🆔 *Invoice:* ${invoiceId}\n`;
      if (clientRef) msg += `🔖 *Ref ID:* ${clientRef}\n`;
      msg += `──────────────\n`;
      if (data?.balanceBefore !== undefined) msg += `💰 *Saldo Awal:* ${formatRupiah(data.balanceBefore)}\n`;
      msg += `➕ *Saldo Masuk:* ${formatRupiah(data?.creditedAmount || data?.amount || 0)}\n`;
      if (data?.fee && Number(data.fee) > 0) msg += `💳 *Fee Admin:* ${formatRupiah(data.fee)}\n`;
      if (data?.uniqueCode && Number(data.uniqueCode) > 0) msg += `🔢 *Kode Unik:* ${data.uniqueCode}\n`;
      if (data?.totalAmount) msg += `💵 *Total Bayar:* ${formatRupiah(data.totalAmount)}\n`;
      msg += `──────────────\n`;
      if (data?.balanceAfter !== undefined) msg += `💰 *Total Saldo:* *${formatRupiah(data.balanceAfter)}*\n`;
      return msg.trim();
    }
    case 'deposit.failed': {
      const invoiceId = data?.invoiceId || data?.refId || '';
      const clientRef = data?.clientRefId || (data?.refId !== invoiceId ? data?.refId : '') || '';
      let msg = `❌ *DEPOSIT GAGAL*\n\n`;
      msg += `🆔 *Invoice:* ${invoiceId}\n`;
      if (clientRef) msg += `🔖 *Ref ID:* ${clientRef}\n`;
      msg += `💵 *Nominal:* ${formatRupiah(data?.amount || 0)}\n`;
      if (data?.paymentMethod) msg += `» *Metode:* ${data.paymentMethod}\n`;
      msg += `» *Status:* GAGAL / EXPIRED\n`;
      if (data?.failureReason) msg += `📝 *Alasan:* ${data.failureReason}\n`;
      msg += `\nSilakan buat deposit baru atau hubungi Admin jika ada kendala.`;
      return msg.trim();
    }
    case 'ping':
      return null;
    default:
      return null;
  }
}

export function createWebhookApp() {
  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok', uptime: process.uptime() }));

  app.get('/webhook', (c) =>
    c.json({
      success: true,
      message: 'Webhook receiver NEETSTORE Bot aktif. Kirim POST dengan X-NEETSTORE-SIGNATURE.',
    })
  );

  app.post('/webhook', async (c) => {
    const rawBody = await c.req.text();
    const signature = c.req.header('X-NEETSTORE-SIGNATURE') || '';

    if (!verifySignature(rawBody, signature)) {
      logger.warn('Webhook signature tidak valid');
      return c.json({ success: false, error: 'Invalid signature.' }, 401);
    }

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return c.json({ success: false, error: 'Invalid JSON.' }, 400);
    }

    const event = payload.event || '';
    const data = payload.data || {};
    const message = mapEventToMessage(event, data);

    logger.info({ event, eventId: payload.eventId }, 'Webhook diterima');

    if (!message) {
      return c.json({ success: true });
    }

    // Resolve target WA: prioritas field phone/wa di payload, lalu invoice mapping
    let targetPhone = data?.phone || data?.wa || '';
    let invoiceTarget: any = null;
    if (!targetPhone) {
      const invoiceKey = data?.invoiceId || data?.refId || data?.clientRefId || '';
      invoiceTarget = getInvoiceTarget(invoiceKey);
      targetPhone = invoiceTarget ? invoiceTarget.jid : '';
    }

    if (!targetPhone) {
      logger.warn({ event }, 'Webhook tanpa target WA phone, notifikasi tidak dikirim');
      return c.json({ success: true, note: 'no_target_phone' });
    }

    try {
      const sock = getSocketInstance();
      const destinationJid = targetPhone.includes('@')
        ? targetPhone
        : `${targetPhone.replace('+', '').replace(/\D/g, '')}@s.whatsapp.net`;

      const sendOptions: any = {};
      if (invoiceTarget?.rawMessage) {
        sendOptions.quoted = invoiceTarget.rawMessage;
      }

      await sock.sendMessage(
        destinationJid,
        {
          text: message,
        },
        sendOptions
      );
      logger.info({ event, targetPhone: destinationJid }, 'Notifikasi WA terkirim');

      // Clear mapping from invoice_map.json once final status event delivery succeeds
      if (event === 'order.success' || event === 'order.failed' || event === 'deposit.success' || event === 'deposit.failed') {
        if (data?.invoiceId) removeInvoiceMapping(data.invoiceId);
        if (data?.refId) removeInvoiceMapping(data.refId);
        if (data?.clientRefId) removeInvoiceMapping(data.clientRefId);
      }
    } catch (err) {
      logger.error({ err: (err as Error)?.message }, 'Gagal kirim notifikasi WA');
    }

    return c.json({ success: true });
  });

  return app;
}
