import { CommandContext } from '../types/command.types';
import { fetchApiProducts, ApiProduct } from '../api/products/products.api';
import { getSession } from '../storage/session';
import { formatRupiah } from '../lib/utils';
import { loading, error, footer } from '../lib/formatter';
import { logger } from '../lib/logger';

export async function produkCommand(ctx: CommandContext): Promise<void> {
  const sess = getSession(ctx.senderJid);
  if (!sess) {
    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: '❌ Kamu belum terhubung ke bot ini.\n\nSilakan tautkan akun:\nnew!login <API_KEY>' },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  const keyword = ctx.args.join(' ').trim();

  await ctx.sock.sendMessage(ctx.chatId, { text: loading('Mengambil daftar produk...') });

  const res = await fetchApiProducts(sess.apiKey, keyword ? { search: keyword } : undefined);

  if (!res.success || !res.data) {
    logger.warn({ error: res.error }, 'Produk gagal diambil');
    await ctx.sock.sendMessage(ctx.chatId, { text: error(res.error || 'Gagal mengambil produk.') }, { quoted: ctx.rawMessage });
    return;
  }

  const available = res.data.filter((p) => p.availability === 'AVAILABLE' && p.price > 0);
  if (available.length === 0) {
    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: `📦 Tidak ada produk aktif yang cocok${keyword ? ` untuk *"${keyword}"*` : ''}.` },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  const grouped = new Map<string, ApiProduct[]>();
  for (const p of available) {
    const key = p.category || p.brand || 'Lainnya';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  }

  let text = `📦 *DAFTAR PRODUK*\n🏅 Level: *${sess.level.toUpperCase()}*\n🛒 *CARA ORDER:* \`new!order <sku> <id> [zone]\`\n───────────────\n`;

  const MAX = 100;
  let total = 0;

  for (const [cat, items] of grouped) {
    if (total >= MAX) {
      text += `\n_...dan masih ada lagi. Cek website untuk daftar lengkap!_\n`;
      break;
    }
    text += `\n「 *${cat.toUpperCase()}* 」\n`;
    const sorted = [...items].sort((a, b) => a.price - b.price);
    for (const p of sorted) {
      if (total >= MAX) break;
      const cleanName = p.name.replace(/\*/g, '').trim();
      text += `*${cleanName}*\n${formatRupiah(p.price)} | Kode: ${p.sku}\n`;
      total++;
    }
  }

  text += `\n💡 _Cari: new!produk <brand/kategori>_\n${footer()}`;

  await ctx.sock.sendMessage(ctx.chatId, { text: text.trim() }, { quoted: ctx.rawMessage });
}
