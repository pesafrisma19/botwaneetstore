import { CommandContext } from '../types/command.types';
import {
  createApiDeposit,
  fetchApiDepositDetails,
  fetchApiDepositsHistory,
} from '../api/deposits/deposits.api';
import { getSession, getPhoneFromJid, saveInvoiceMapping } from '../storage/session';
import { formatRupiah } from '../lib/utils';
import { loading, error } from '../lib/formatter';
import { logger } from '../lib/logger';

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

  await ctx.sock.sendMessage(ctx.chatId, { text: loading('Membuat tagihan deposit...') });

  const res = await createApiDeposit(sess.apiKey, { amount, paymentMethod: method });

  if (!res.success || !res.data) {
    logger.warn({ error: res.error }, 'Deposit gagal');
    await ctx.sock.sendMessage(ctx.chatId, { text: error(res.error || 'Gagal membuat tagihan deposit.') }, { quoted: ctx.rawMessage });
    return;
  }

  const d = res.data;

  const phone = getPhoneFromJid(ctx.senderJid);
  if (phone) {
    if (d.refId) saveInvoiceMapping(d.refId, phone);
    if (d.clientRefId) saveInvoiceMapping(d.clientRefId, phone);
  }

  let text = `🏷️ *DETAIL DEPOSIT*\n`;
  text += `» *Ref ID:* ${d.refId}\n`;
  text += `» *Metode:* ${d.paymentMethod}\n`;
  text += `──────────────\n`;
  text += `» *Nominal:* ${formatRupiah(d.amount)}\n`;
  if (d.fee && Number(d.fee) > 0) text += `» *Fee:* ${formatRupiah(d.fee)}\n`;
  if (d.uniqueCode && Number(d.uniqueCode) > 0) text += `» *Kode Unik:* ${d.uniqueCode}\n`;
  text += `» *Total Transfer:* *${formatRupiah(d.totalAmount)}*\n`;
  text += `──────────────\n`;
  if (d.expiredAt) text += `» *Expired:* ${new Date(d.expiredAt).toLocaleString('id-ID')}\n\n`;
  else text += `\n`;

  if (d.paymentInstructions) {
    text += `💳 *Instruksi Pembayaran:*\n${d.paymentInstructions}\n\n`;
  }

  if (d.checkoutUrl) {
    text += `🔗 *Link Pembayaran:*\n${d.checkoutUrl}\n\n`;
  }
  if (d.qrImageUrl) {
    text += `🖼 *QRIS:* ${d.qrImageUrl}\n\n`;
  }

  text += `Cek status: new!status ${d.refId}`;

  await ctx.sock.sendMessage(ctx.chatId, { text }, { quoted: ctx.rawMessage });
}

export async function depositStatusCommand(ctx: CommandContext): Promise<void> {
  const sess = getSession(ctx.senderJid);
  if (!sess) {
    await ctx.sock.sendMessage(ctx.chatId, { text: '❌ Kamu belum terhubung ke bot ini.' }, { quoted: ctx.rawMessage });
    return;
  }

  const refId = ctx.args[0]?.trim();
  if (!refId) {
    await ctx.sock.sendMessage(ctx.chatId, { text: '❌ *Format:* new!deposit-status <ref_id>' }, { quoted: ctx.rawMessage });
    return;
  }

  const res = await fetchApiDepositDetails(sess.apiKey, refId);
  if (!res.success || !res.data) {
    await ctx.sock.sendMessage(ctx.chatId, { text: error(res.error || 'Deposit tidak ditemukan.') }, { quoted: ctx.rawMessage });
    return;
  }

  const d = res.data;
  const emoji = d.status === 'SUCCESS' || d.status === 'PAID' ? '✅' : d.status === 'PENDING' || d.status === 'WAITING' ? '🕐' : '❌';
  let text = `💰 *Status Deposit*\n\n`;
  text += `${emoji} Status: *${d.status}*\n`;
  text += `🆔 Ref ID: ${d.refId}\n`;
  text += `💵 Nominal: ${formatRupiah(d.amount)}\n`;
  text += `💳 Total: ${formatRupiah(d.totalAmount)}\n`;
  if (d.paidAt) text += `✅ Dibayar: ${new Date(d.paidAt).toLocaleString('id-ID')}\n`;

  await ctx.sock.sendMessage(ctx.chatId, { text }, { quoted: ctx.rawMessage });
}

export async function depositHistoryCommand(ctx: CommandContext): Promise<void> {
  const sess = getSession(ctx.senderJid);
  if (!sess) {
    await ctx.sock.sendMessage(ctx.chatId, { text: '❌ Kamu belum terhubung ke bot ini.' }, { quoted: ctx.rawMessage });
    return;
  }

  const res = await fetchApiDepositsHistory(sess.apiKey, { page: 1, limit: 10 });
  if (!res.success || !res.data || res.data.data.length === 0) {
    await ctx.sock.sendMessage(ctx.chatId, { text: '📋 Tidak ada riwayat deposit.' }, { quoted: ctx.rawMessage });
    return;
  }

  let text = `📋 *Riwayat Deposit (10 terakhir)*\n\n`;
  for (const d of res.data.data) {
    const emoji = d.status === 'SUCCESS' || d.status === 'PAID' ? '✅' : '🕐';
    text += `${emoji} \`${d.refId}\` ${formatRupiah(d.amount)} | ${d.status}\n\n`;
  }

  await ctx.sock.sendMessage(ctx.chatId, { text: text.trim() }, { quoted: ctx.rawMessage });
}
