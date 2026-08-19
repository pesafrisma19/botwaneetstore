import crypto from 'crypto';
import QRCode from 'qrcode';
import { CommandContext } from '../types/command.types';
import {
  createApiDeposit,
  fetchApiDepositDetails,
  fetchApiDepositsHistory,
  ApiDepositResult,
} from '../api/deposits/deposits.api';
import { getSession, saveInvoiceMapping } from '../storage/session';
import { formatRupiah } from '../lib/utils';
import { loading, error } from '../lib/formatter';
import { logger } from '../lib/logger';
import { resolvePhone } from '../lib/lid';

function generateDepositRefId(): string {
  return 'BOTDEP' + Date.now() + crypto.randomBytes(2).toString('hex').toUpperCase();
}

export async function depositCommand(ctx: CommandContext): Promise<void> {
  const sess = getSession(ctx.senderJid);
  if (!sess) {
    await ctx.sock.sendMessage(ctx.chatId, { text: '❌ Kamu belum terhubung ke bot ini.\n\nSilakan tautkan akun:\nnew!login <API_KEY>' }, { quoted: ctx.rawMessage });
    return;
  }

  if (ctx.args.length < 2) {
    await ctx.sock.sendMessage(
      ctx.chatId,
      {
        text: `❌ *Format salah!*\n\nCara pakai:\nnew!deposit <nominal> <metode>\n\n_Contoh:_\nnew!deposit 50000 QRIS\nnew!deposit 100000 DANA\nnew!deposit 25000 BCA\n\n💡 Metode: QRIS, DANA, BCA, BRI, dll`,
      },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  const amount = parseInt(ctx.args[0]);
  const method = ctx.args[1].toUpperCase();

  if (isNaN(amount) || amount <= 0) {
    await ctx.sock.sendMessage(ctx.chatId, { text: '❌ Nominal tidak valid. Masukkan angka, contoh: new!deposit 50000 QRIS' }, { quoted: ctx.rawMessage });
    return;
  }

  const refId = generateDepositRefId();

  await ctx.sock.sendMessage(ctx.chatId, { text: loading('Membuat tagihan deposit...') });

  const res = await createApiDeposit(sess.apiKey, { amount, paymentMethod: method, refId });

  if (!res.success || !res.data) {
    logger.warn({ error: res.error }, 'Deposit gagal');
    await ctx.sock.sendMessage(ctx.chatId, { text: error(res.error || 'Gagal membuat tagihan deposit.') }, { quoted: ctx.rawMessage });
    return;
  }

  const d = res.data;

  // Simpan mapping invoice → room JID / nomor WA untuk notifikasi webhook
  const targetRoomJid = ctx.chatId || resolvePhone({ senderJid: ctx.senderJid, rawMessage: ctx.rawMessage });
  if (targetRoomJid) {
    if (d.invoiceId) saveInvoiceMapping(d.invoiceId, targetRoomJid, ctx.rawMessage);
    if (d.refId && d.refId !== d.invoiceId) saveInvoiceMapping(d.refId, targetRoomJid, ctx.rawMessage);
    if (d.clientRefId && d.clientRefId !== d.refId) saveInvoiceMapping(d.clientRefId, targetRoomJid, ctx.rawMessage);
  }

  let text = `💰 *DEPOSIT SALDO*\n\n`;
  text += `🆔 *Invoice:* ${d.invoiceId || d.refId}\n`;
  text += `🔖 *Ref ID:* ${d.refId}\n\n`;
  text += `💵 *Nominal:* ${formatRupiah(d.amount)}\n`;
  if (d.fee && Number(d.fee) > 0) text += `💳 *Fee Admin:* ${formatRupiah(d.fee)}\n`;
  if (d.uniqueCode && Number(d.uniqueCode) > 0) text += `🔢 *Kode Unik:* ${d.uniqueCode}\n`;
  text += `💰 *Total Bayar:* *${formatRupiah(d.totalAmount)}*\n\n`;
  text += `» *Metode:* ${d.paymentMethod}\n`;
  text += `» *Status:* ${d.status}\n`;
  if (d.expiredAt) text += `» *Expired:* ${new Date(d.expiredAt).toLocaleString('id-ID')}\n`;
  text += `──────────────\n`;

  if (d.qrString) {
    text += `📌 _Scan kode QRIS di atas menggunakan aplikasi e-wallet atau mobile banking Anda._\n`;
  } else if (d.paymentInstructions) {
    text += `💳 *Instruksi Pembayaran:*\n${d.paymentInstructions}\n\n`;
  }

  if (d.checkoutUrl) {
    text += `🔗 *Link Pembayaran:*\n${d.checkoutUrl}\n\n`;
  }

  text += `_Cek status: \`new!deposit-status ${d.invoiceId || d.refId}\`_`;

  if (d.qrString) {
    try {
      const qrBuffer = await QRCode.toBuffer(d.qrString, { width: 400, margin: 2 });
      await ctx.sock.sendMessage(ctx.chatId, { image: qrBuffer, caption: text.trim() }, { quoted: ctx.rawMessage });
      return;
    } catch (err: any) {
      logger.warn({ err: err?.message }, 'Gagal generate QR image buffer untuk deposit, fallback ke qrImageUrl/teks');
    }
  }

  if (d.qrImageUrl) {
    try {
      const imgRes = await fetch(d.qrImageUrl);
      if (imgRes.ok) {
        const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
        await ctx.sock.sendMessage(ctx.chatId, { image: imgBuffer, caption: text.trim() }, { quoted: ctx.rawMessage });
        return;
      }
    } catch (err: any) {
      logger.warn({ err: err?.message, url: d.qrImageUrl }, 'Gagal download QR image deposit dari qrImageUrl');
    }
  }

  await ctx.sock.sendMessage(ctx.chatId, { text: text.trim() }, { quoted: ctx.rawMessage });
}

export async function depositStatusCommand(ctx: CommandContext): Promise<void> {
  const sess = getSession(ctx.senderJid);
  if (!sess) {
    await ctx.sock.sendMessage(ctx.chatId, { text: '❌ Kamu belum terhubung ke bot ini.' }, { quoted: ctx.rawMessage });
    return;
  }

  const refId = ctx.args[0]?.trim();
  if (!refId) {
    await ctx.sock.sendMessage(ctx.chatId, { text: '❌ *Format:* new!deposit-status <ref_id / invoice_id>' }, { quoted: ctx.rawMessage });
    return;
  }

  await ctx.sock.sendMessage(ctx.chatId, { text: loading('Mengecek status deposit...') });

  const res = await fetchApiDepositDetails(sess.apiKey, refId);
  if (!res.success || !res.data) {
    await ctx.sock.sendMessage(ctx.chatId, { text: error(res.error || 'Deposit tidak ditemukan.') }, { quoted: ctx.rawMessage });
    return;
  }

  const d = res.data;
  const emoji = d.status === 'SUCCESS' || d.status === 'PAID' ? '✅' : d.status === 'PENDING' || d.status === 'WAITING' ? '🕐' : '❌';
  let text = `💰 *Status Deposit*\n\n`;
  text += `${emoji} Status: *${d.status}*\n`;
  if (d.invoiceId) text += `🆔 Invoice: ${d.invoiceId}\n`;
  text += `🔖 Ref ID: ${d.refId}\n`;
  text += `💵 Nominal: ${formatRupiah(d.amount)}\n`;
  if (d.fee && Number(d.fee) > 0) text += `💳 Fee Admin: ${formatRupiah(d.fee)}\n`;
  if (d.uniqueCode && Number(d.uniqueCode) > 0) text += `🔢 Kode Unik: ${d.uniqueCode}\n`;
  text += `💰 Total Bayar: ${formatRupiah(d.totalAmount)}\n`;
  if (d.paidAt) text += `✅ Dibayar: ${new Date(d.paidAt).toLocaleString('id-ID')}\n`;

  await ctx.sock.sendMessage(ctx.chatId, { text: text.trim() }, { quoted: ctx.rawMessage });
}

export async function depositHistoryCommand(ctx: CommandContext): Promise<void> {
  const sess = getSession(ctx.senderJid);
  if (!sess) {
    await ctx.sock.sendMessage(ctx.chatId, { text: '❌ Kamu belum terhubung ke bot ini.' }, { quoted: ctx.rawMessage });
    return;
  }

  await ctx.sock.sendMessage(ctx.chatId, { text: loading('Mengambil riwayat deposit...') });

  const res = await fetchApiDepositsHistory(sess.apiKey, { page: 1, limit: 10 });
  const rawData: any = res.data;
  const items: ApiDepositResult[] = Array.isArray(rawData) ? rawData : Array.isArray(rawData?.data) ? rawData.data : [];

  if (!res.success || items.length === 0) {
    await ctx.sock.sendMessage(ctx.chatId, { text: '📋 Tidak ada riwayat deposit.' }, { quoted: ctx.rawMessage });
    return;
  }

  let text = `📋 *Riwayat Deposit (10 terakhir)*\n\n`;
  for (const d of items) {
    const emoji = d.status === 'SUCCESS' || d.status === 'PAID' ? '✅' : '🕐';
    const displayId = d.invoiceId || d.refId;
    text += `${emoji} \`${displayId}\` ${formatRupiah(d.amount)} | ${d.status}\n\n`;
  }

  await ctx.sock.sendMessage(ctx.chatId, { text: text.trim() }, { quoted: ctx.rawMessage });
}
