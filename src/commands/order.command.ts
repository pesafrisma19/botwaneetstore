import crypto from 'crypto';
import { CommandContext } from '../types/command.types';
import {
  createApiOrder,
  fetchApiOrderDetails,
  fetchApiOrdersHistory,
} from '../api/orders/orders.api';
import { fetchApiProducts } from '../api/products/products.api';
import { validateAccount } from '../api/validation/validation.api';
import { getSession, saveInvoiceMapping } from '../storage/session';
import { formatRupiah, formatExpiry } from '../lib/utils';
import { loading, error, infoBox } from '../lib/formatter';
import { logger } from '../lib/logger';
import { setPendingOrder, getPendingOrder, clearPendingOrder, PendingOrder } from '../state/order-pending';
import { resolvePhone } from '../lib/lid';

import QRCode from 'qrcode';

function generateRefId(): string {
  return 'BOT' + Date.now() + crypto.randomBytes(2).toString('hex').toUpperCase();
}

function parseTarget(rawTarget: string, rawZone: string, args: string[]): { targetAccount: string; targetZone?: string } {
  let target = rawTarget;
  let zone = rawZone;

  if (!zone && target.includes('(') && target.includes(')')) {
    const m = target.match(/^(.+?)\((.+?)\)$/);
    if (m) {
      target = m[1];
      zone = m[2];
    }
  }

  target = target.replace(/[()]/g, '');
  zone = (zone || '').replace(/[()]/g, '');

  return { targetAccount: target, targetZone: zone || undefined };
}

export async function orderCommand(ctx: CommandContext): Promise<void> {
  const sess = getSession(ctx.senderJid);
  if (!sess) {
    await ctx.sock.sendMessage(ctx.chatId, { text: '❌ Kamu belum terhubung ke bot ini.\n\nSilakan tautkan akun:\nlogin <API_KEY>' }, { quoted: ctx.rawMessage });
    return;
  }

  const isQris = ctx.commandName === 'qris' || ctx.commandName === 'payqris' || ctx.args.includes('--qris') || ctx.args.includes('-q');
  const cleanArgs = ctx.args.filter((a) => !a.startsWith('--'));

  if (cleanArgs.length < 2) {
    await ctx.sock.sendMessage(
      ctx.chatId,
      {
        text: `❌ *Format salah!*\n\nCara pakai:\norder <sku> <user_id> [zone]${isQris ? ' --qris' : ''}\n\n_Contoh:_\norder ML86 123456789 1234\norder FF10 987654321\n\n💡 Lihat kode SKU di produk`,
      },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  const sku = cleanArgs[0];
  const { targetAccount, targetZone } = parseTarget(cleanArgs[1], cleanArgs[2] || '', cleanArgs);

  const refId = generateRefId();

  // Cari produk dari SKU (untuk dapat productId)
  await ctx.sock.sendMessage(ctx.chatId, { text: loading('Mengecek pesanan...') });

  const prodRes = await fetchApiProducts(sess.apiKey, { search: sku });
  const product = prodRes.data?.find((p) => p.sku.toLowerCase() === sku.toLowerCase() || p.name.toLowerCase().includes(sku.toLowerCase()));

  if (!product) {
    await ctx.sock.sendMessage(ctx.chatId, { text: `❌ *Pesanan Gagal*\n\nProduk dengan SKU *${sku}* tidak ditemukan. Cek kode di produk.` }, { quoted: ctx.rawMessage });
    return;
  }

  // Validasi akun game jika produk mendukung validasi
  let nickname = '';
  if (product.hasValidation !== false) {
    const validateRes = await validateAccount(sess.apiKey, {
      productId: product.productId,
      targetAccount,
      targetZone,
    });

    if (!validateRes.success || !validateRes.data?.valid) {
      await ctx.sock.sendMessage(ctx.chatId, { text: `❌ *Pesanan Gagal*\n\nAlasan: ${validateRes.error || 'Akun game tidak ditemukan / tidak valid.'}` }, { quoted: ctx.rawMessage });
      return;
    }

    nickname = validateRes.data.nickname || '';
  }

  // =========================================================================
  // FLOW A: QRIS MODE (DIRECT INSTANT 1-TAHAP TANPA Y/N)
  // =========================================================================
  if (isQris) {
    await ctx.sock.sendMessage(ctx.chatId, { text: loading('Membuat QRIS pembayaran...') });

    const res = await createApiOrder(sess.apiKey, {
      sku: product.sku,
      productId: product.productId,
      targetAccount,
      targetZone,
      refId,
      nickname,
      paymentMethod: 'QRIS',
    });

    if (!res.success || !res.data) {
      logger.warn({ error: res.error }, 'Order QRIS gagal');
      await ctx.sock.sendMessage(ctx.chatId, { text: error(res.error || 'Gagal membuat QRIS.') }, { quoted: ctx.rawMessage });
      return;
    }

    const d = res.data;

    // Simpan mapping invoice → room JID (grup / chat pribadi) + rawMessage untuk quote reply
    const targetRoomJid = ctx.chatId || resolvePhone({ senderJid: ctx.senderJid, rawMessage: ctx.rawMessage });
    if (targetRoomJid) {
      if (d.invoiceId) saveInvoiceMapping(d.invoiceId, targetRoomJid, ctx.rawMessage);
      if (d.refId && d.refId !== d.invoiceId) saveInvoiceMapping(d.refId, targetRoomJid, ctx.rawMessage);
    }

    let caption = `🏷️ *TAGIHAN QRIS*\n`;
    caption += `──────────────\n`;
    caption += `» *Invoice:* ${d.invoiceId || d.refId}\n`;
    if (product.brand) caption += `» *Brand:* ${product.brand}\n`;
    caption += `» *Produk:* ${product.name || d.name}\n`;
    caption += `» *Target:* ${d.targetAccount}${d.targetZone ? ' (' + d.targetZone + ')' : ''}\n`;
    caption += `» *Nickname:* ${nickname || '-'}\n`;
    caption += `──────────────\n`;
    caption += `» *Harga:* ${formatRupiah(d.price || product.price)}\n`;
    if (d.feeAmount && Number(d.feeAmount) > 0) caption += `» *Fee Admin:* ${formatRupiah(d.feeAmount)}\n`;
    caption += `» *Total Bayar:* *${formatRupiah(d.totalAmount || d.price || product.price)}*\n`;
    caption += `» *Status Pembayaran:* ${d.paymentStatus}\n`;
    caption += `» *Status Order:* ${d.orderStatus}\n`;
    if (d.expiredAt) {
      const expFormatted = formatExpiry(d.expiredAt);
      if (expFormatted) caption += `» *Batas Bayar:* ${expFormatted}\n`;
    }
    caption += `──────────────\n`;
    caption += `📌 _Scan QRIS di atas untuk membayar._\n`;
    caption += `_Cek status: \`status ${d.refId || d.invoiceId}\`_`;

    if (d.qrString) {
      try {
        const qrBuffer = await QRCode.toBuffer(d.qrString, { width: 400, margin: 2 });
        await ctx.sock.sendMessage(ctx.chatId, { image: qrBuffer, caption: caption.trim() }, { quoted: ctx.rawMessage });
        return;
      } catch (err: any) {
        logger.warn({ err: err?.message }, 'Gagal generate QR image buffer, fallback ke qrImageUrl/teks');
      }
    }

    if (d.qrImageUrl) {
      try {
        const imgRes = await fetch(d.qrImageUrl);
        if (imgRes.ok) {
          const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
          await ctx.sock.sendMessage(ctx.chatId, { image: imgBuffer, caption: caption.trim() }, { quoted: ctx.rawMessage });
          return;
        }
      } catch (err: any) {
        logger.warn({ err: err?.message, url: d.qrImageUrl }, 'Gagal download QR image dari qrImageUrl');
      }
    }

    // Fallback jika qrString dan qrImageUrl null/gagal
    await ctx.sock.sendMessage(ctx.chatId, { text: caption.trim() }, { quoted: ctx.rawMessage });
    return;
  }

  // =========================================================================
  // FLOW B: SALDO MODE (2-TAHAP KONFIRMASI Y/N BEFORE DEDUCTION)
  // =========================================================================
  // Guard: Cek jika user sudah memiliki konfirmasi Y/N yang masih menggantung
  const existingPending = getPendingOrder(ctx.senderJid);
  if (existingPending) {
    let warningText = `⚠️ *MASIH ADA KONFIRMASI PENDING!*\n\n`;
    warningText += `Anda masih memiliki pesanan yang menunggu konfirmasi:\n`;
    warningText += `» *SKU:* ${existingPending.sku}\n`;
    warningText += `» *Target:* ${existingPending.targetAccount}${existingPending.targetZone ? ' (' + existingPending.targetZone + ')' : ''}\n\n`;
    warningText += `Ketik *Y* / *YA* untuk melanjutkan pesanan tersebut, atau *N* / *BATAL* untuk membatalkannya terlebih dahulu.`;

    await ctx.sock.sendMessage(ctx.chatId, { text: warningText }, { quoted: ctx.rawMessage });
    return;
  }

  const pending: PendingOrder = {
    senderJid: ctx.senderJid,
    refId,
    sku: product.sku,
    productId: product.productId,
    targetAccount,
    targetZone,
    nickname,
    paymentMethod: 'BALANCE',
    timestamp: Date.now(),
    chatId: ctx.chatId,
  };
  setPendingOrder(ctx.senderJid, pending);

  let text = `🏷️ *KONFIRMASI PESANAN*\n`;
  text += `──────────────\n`;
  if (product.brand) text += `» *Brand:* ${product.brand}\n`;
  text += `» *Produk:* ${product.name}\n`;
  text += `» *Target:* ${targetAccount}${targetZone ? ' (' + targetZone + ')' : ''}\n`;
  text += `» *Nickname:* ${nickname || '-'}\n`;
  text += `» *Harga:* ${formatRupiah(product.price)}\n`;
  text += `» *Metode Bayar:* Saldo Akun\n`;
  text += `──────────────\n\n`;
  text += `Apakah data di atas sudah benar? Kesalahan input bukan tanggung jawab Kami.\n\n`;
  text += `Ketik *Y* / *YA* / *OK* untuk lanjut, atau *N* / *BATAL* untuk membatalkan.`;

  await ctx.sock.sendMessage(ctx.chatId, { text }, { quoted: ctx.rawMessage });
}

export async function confirmOrder(ctx: CommandContext, pending: PendingOrder): Promise<void> {
  await ctx.sock.sendMessage(ctx.chatId, { text: loading('Memproses order...') });

  const sess = getSession(ctx.senderJid);
  if (!sess) {
    clearPendingOrder(ctx.senderJid);
    await ctx.sock.sendMessage(ctx.chatId, { text: error('Sesi tidak ditemukan. Silakan login ulang.') });
    return;
  }

  const res = await createApiOrder(sess.apiKey, {
    sku: pending.sku,
    productId: pending.productId,
    targetAccount: pending.targetAccount,
    targetZone: pending.targetZone,
    refId: pending.refId,
    nickname: pending.nickname,
    paymentMethod: pending.paymentMethod,
  });

  clearPendingOrder(ctx.senderJid);

  if (!res.success || !res.data) {
    logger.warn({ error: res.error }, 'Order gagal');
    await ctx.sock.sendMessage(ctx.chatId, { text: error(res.error || 'Order gagal diproses.') }, { quoted: ctx.rawMessage });
    return;
  }

  const d = res.data;

  // Simpan mapping invoice → room JID (grup / chat pribadi) + rawMessage untuk quote reply
  const targetRoomJid = ctx.chatId || resolvePhone({ senderJid: ctx.senderJid, rawMessage: ctx.rawMessage });
  if (targetRoomJid) {
    if (d.invoiceId) saveInvoiceMapping(d.invoiceId, targetRoomJid, ctx.rawMessage);
    if (d.refId && d.refId !== d.invoiceId) saveInvoiceMapping(d.refId, targetRoomJid, ctx.rawMessage);
  }

  let text = `🏷️ *INVOICE ORDER*\n`;
  text += `──────────────\n`;
  text += `» *Invoice:* ${d.invoiceId || d.refId}\n`;
  text += `» *Produk:* ${d.name || pending.sku}\n`;
  text += `» *Target:* ${d.targetAccount}${d.targetZone ? ' (' + d.targetZone + ')' : ''}\n`;
  text += `» *Nickname:* ${pending.nickname || '-'}\n`;
  text += `──────────────\n`;
  text += `» *Total Terpotong:* *${formatRupiah(d.totalAmount || d.price || 0)}*\n`;
  text += `» *Status Pembayaran:* ${d.paymentStatus}\n`;
  text += `» *Status Order:* ${d.orderStatus}\n`;

  if (d.serialNumber) {
    text += `\n🎫 *Serial:* ${d.serialNumber}\n`;
  }

  text += `──────────────\n`;
  text += `_Cek status: \`status ${d.refId || d.invoiceId}\`_`;

  await ctx.sock.sendMessage(ctx.chatId, { text }, { quoted: ctx.rawMessage });
}

export async function statusCommand(ctx: CommandContext): Promise<void> {
  const sess = getSession(ctx.senderJid);
  if (!sess) {
    await ctx.sock.sendMessage(ctx.chatId, { text: '❌ Kamu belum terhubung ke bot ini.' }, { quoted: ctx.rawMessage });
    return;
  }

  const refId = ctx.args[0]?.trim();
  if (!refId) {
    await ctx.sock.sendMessage(ctx.chatId, { text: '❌ *Format:* status <ref_id>\n_Contoh: status BOT1234567890_' }, { quoted: ctx.rawMessage });
    return;
  }

  await ctx.sock.sendMessage(ctx.chatId, { text: loading('Mengecek status...') });

  const res = await fetchApiOrderDetails(sess.apiKey, refId);
  if (!res.success || !res.data) {
    await ctx.sock.sendMessage(ctx.chatId, { text: error(res.error || 'Order tidak ditemukan.') }, { quoted: ctx.rawMessage });
    return;
  }

  const d = res.data;
  const statusEmoji: Record<string, string> = {
    SUCCESS: '✅', PROCESS: '⏳', PROCESSING: '⏳', PENDING: '🕐', FAILED: '💥', REFUND: '♻️', CANCELED: '❌',
  };

  let text = `📋 *Status Order*\n\n`;
  text += `${statusEmoji[d.orderStatus] || '❓'} Status: *${d.orderStatus}*\n`;
  text += `🆔 Invoice: ${d.invoiceId}\n`;
  text += `🔖 Ref ID: ${d.refId}\n`;
  text += `📦 Produk: ${d.name || d.sku || '-'}\n`;
  if (d.serialNumber) text += `🎫 Serial: ${d.serialNumber}\n`;
  if (d.message) text += `📝 Note: ${d.message}\n`;

  await ctx.sock.sendMessage(ctx.chatId, { text }, { quoted: ctx.rawMessage });
}

export async function riwayatCommand(ctx: CommandContext): Promise<void> {
  const sess = getSession(ctx.senderJid);
  if (!sess) {
    await ctx.sock.sendMessage(ctx.chatId, { text: '❌ Kamu belum terhubung ke bot ini.' }, { quoted: ctx.rawMessage });
    return;
  }

  await ctx.sock.sendMessage(ctx.chatId, { text: loading('Mengambil riwayat order...') });

  const res = await fetchApiOrdersHistory(sess.apiKey, { page: 1, limit: 10 });
  const items = res.data;
  if (!res.success || !Array.isArray(items) || items.length === 0) {
    await ctx.sock.sendMessage(ctx.chatId, { text: '📋 Tidak ada riwayat order.' }, { quoted: ctx.rawMessage });
    return;
  }

  let text = `📋 *Riwayat Order (10 terakhir)*\n\n`;
  for (const o of items) {
    const emoji = o.orderStatus === 'SUCCESS' ? '✅' : o.orderStatus === 'PROCESS' || o.orderStatus === 'PROCESSING' ? '⏳' : '❌';
    text += `${emoji} \`${o.refId}\` ${o.name || o.sku}\n   💵 ${formatRupiah(o.totalAmount || 0)} | ${o.orderStatus}\n\n`;
  }

  await ctx.sock.sendMessage(ctx.chatId, { text: text.trim() }, { quoted: ctx.rawMessage });
}

export async function cancelOrder(ctx: CommandContext): Promise<void> {
  clearPendingOrder(ctx.senderJid);
  await ctx.sock.sendMessage(ctx.chatId, { text: '❌ *Pesanan Dibatalkan.*\nSaldo kamu tidak terpotong.' }, { quoted: ctx.rawMessage });
}
