import { CommandContext } from '../types/command.types';
import { fetchApiProducts } from '../api/products/products.api';
import { validateAccount } from '../api/validation/validation.api';
import { getSession } from '../storage/session';
import { loading, error } from '../lib/formatter';
import { logger } from '../lib/logger';

export async function ceknickCommand(ctx: CommandContext): Promise<void> {
  const sess = getSession(ctx.senderJid);
  if (!sess) {
    await ctx.sock.sendMessage(ctx.chatId, { text: '❌ Kamu belum terhubung ke bot ini.\n\nSilakan tautkan akun:\nlogin <API_KEY>' }, { quoted: ctx.rawMessage });
    return;
  }

  if (ctx.args.length < 2) {
    await ctx.sock.sendMessage(
      ctx.chatId,
      {
        text: `❌ *Format salah!*\n\nCara pakai:\nceknick <sku> <id> [zone]\n\n_Contoh:_\nceknick MOBILE_LEGENDS 123456 1234\nceknick FF 987654321\n\n💡 Kode produk: produk`,
      },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  const sku = ctx.args[0];
  let targetAccount = ctx.args[1];
  let targetZone = ctx.args[2] || '';

  // Dukung format 12345(1234)
  if (!targetZone && targetAccount.includes('(') && targetAccount.includes(')')) {
    const m = targetAccount.match(/^(.+?)\((.+?)\)$/);
    if (m) {
      targetAccount = m[1];
      targetZone = m[2];
    }
  }
  targetAccount = targetAccount.replace(/[()]/g, '');
  targetZone = targetZone.replace(/[()]/g, '');

  await ctx.sock.sendMessage(ctx.chatId, { text: loading(`Mengecek akun...`) });

  // Cari produk untuk dapatkan productId/brandId
  const prodRes = await fetchApiProducts(sess.apiKey, { search: sku });
  const product = prodRes.data?.find(
    (p) => p.sku.toLowerCase() === sku.toLowerCase() || p.name.toLowerCase().includes(sku.toLowerCase())
  );

  if (!product) {
    await ctx.sock.sendMessage(ctx.chatId, { text: error(`Produk *${sku}* tidak ditemukan. Cek kode di produk.`) }, { quoted: ctx.rawMessage });
    return;
  }

  const res = await validateAccount(sess.apiKey, {
    productId: product.productId,
    targetAccount,
    targetZone: targetZone || undefined,
  });

  if (!res.success || !res.data) {
    logger.warn({ error: res.error }, 'Ceknick gagal');
    await ctx.sock.sendMessage(ctx.chatId, { text: error(res.error || 'Gagal memverifikasi akun.') }, { quoted: ctx.rawMessage });
    return;
  }

  const v = res.data;
  const text = [
    `🎮 *${product.name.toUpperCase()}*`,
    '━━━━━━━━━━━━━━━',
    `🆔 ID   : ${targetAccount}${targetZone ? ' (' + targetZone + ')' : ''}`,
    `👤 Nick : ${v.nickname || 'Tidak ditemukan'}`,
    ...(v.detectedCountry ? [`🌍 Region: ${v.detectedCountry}`] : []),
  ].join('\n');

  await ctx.sock.sendMessage(ctx.chatId, { text }, { quoted: ctx.rawMessage });
}
