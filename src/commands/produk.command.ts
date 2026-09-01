import { CommandContext } from '../types/command.types';
import { fetchApiProducts, ApiProduct } from '../api/products/products.api';
import { getSession } from '../storage/session';
import { formatRupiah } from '../lib/utils';
import { loading, error } from '../lib/formatter';
import { logger } from '../lib/logger';
import { BRAND_ALIASES } from '../config/brandCodes';

export async function produkCommand(ctx: CommandContext): Promise<void> {
  const sess = getSession(ctx.senderJid);
  if (!sess) {
    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: '❌ Kamu belum terhubung ke bot ini.\n\nSilakan tautkan akun:\nlogin <API_KEY>' },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  await ctx.sock.sendMessage(ctx.chatId, { text: loading('Mengambil daftar produk...') });

  const code = ctx.args.join(' ').trim().toLowerCase();

  // ===== case A: produk / harga tanpa argumen → tampilkan daftar kode dikelompokkan per brandCategory =====
  if (!code) {
    const res = await fetchApiProducts(sess.apiKey);
    const brandMeta = new Map<string, { brandName?: string; brandCategory?: string }>();

    if (res.success && res.data) {
      for (const p of res.data) {
        if (p.brandSlug && !brandMeta.has(p.brandSlug)) {
          brandMeta.set(p.brandSlug, {
            brandName: p.brand || undefined,
            brandCategory: p.brandCategory || undefined,
          });
        }
      }
    }

    const categoryGroups = new Map<string, Array<{ code: string; displayName: string }>>();

    for (const [aliasCode, targetStr] of Object.entries(BRAND_ALIASES)) {
      const [brandSlug, regionTarget] = targetStr.split('|');
      const meta = brandMeta.get(brandSlug);
      const catName = meta?.brandCategory || 'Lainnya';

      if (!categoryGroups.has(catName)) {
        categoryGroups.set(catName, []);
      }

      let regionDisplay = '';
      if (regionTarget && regionTarget !== 'Indonesia+null') {
        regionDisplay = ` (${regionTarget})`;
      } else if (regionTarget === 'Indonesia+null') {
        regionDisplay = ' (Indonesia)';
      }

      const fallbackName = brandSlug
        .split('-')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
      const displayName = meta?.brandName || fallbackName;

      categoryGroups.get(catName)!.push({
        code: aliasCode,
        displayName: `${displayName}${regionDisplay}`,
      });
    }

    let text = '📦 *DAFTAR BRAND PRODUK*\n\n💡 _Ketik *produk <kode>* untuk melihat itemnya_\n_Contoh: produk mltr_\n';

    for (const [catName, items] of categoryGroups) {
      text += `\n*${catName}*\n`;
      items.sort((a, b) => a.code.localeCompare(b.code));
      for (const item of items) {
        text += `• ${item.code} - ${item.displayName}\n`;
      }
    }

    await ctx.sock.sendMessage(ctx.chatId, { text: text.trim() }, { quoted: ctx.rawMessage });
    return;
  }

  // ===== case B: produk / harga <kode> → resolver dinamis via V1 API =====
  const targetSelector = BRAND_ALIASES[code] || code;
  const [slugTarget, regionTarget] = targetSelector.split('|');

  const res = await fetchApiProducts(sess.apiKey, { search: slugTarget });
  if (!res.success || !res.data) {
    logger.warn({ error: res.error, code }, 'Produk per kode gagal diambil dari V1 API');
    await ctx.sock.sendMessage(ctx.chatId, { text: error(res.error || 'Gagal mengambil produk.') }, { quoted: ctx.rawMessage });
    return;
  }

  // Filter ketersediaan & harga > 0
  let available = res.data.filter((p) => p.availability === 'AVAILABLE' && p.price > 0);

  // Pencocokan presisi berdasarkan targetSelector
  available = available.filter((p) => {
    const cleanSlug = slugTarget.toLowerCase();
    const matchBrand = p.brandSlug === cleanSlug;
    if (!matchBrand) return false;

    if (regionTarget === 'Indonesia+null') {
      // Eksplisit: region === Indonesia ATAU region === null (e.g. SKU ml1000)
      return p.region === null || p.region?.toLowerCase() === 'indonesia';
    } else if (regionTarget) {
      return p.region && p.region.toLowerCase() === regionTarget.toLowerCase();
    }
    return true;
  });

  if (available.length === 0) {
    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: `📦 Tidak ada produk aktif untuk kode *${code}*.` },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  // Ambillah metadata langsung dari objek produk V1 (100% SOURCES OF TRUTH DARI V1)
  const sample = available[0];
  const level = sample.level || 'MEMBER';
  const brandTitle = sample.brand || slugTarget;
  let regionTitle = '';

  if (sample.region) {
    regionTitle = ` (${sample.region})`;
  } else if (regionTarget && regionTarget !== 'Indonesia+null') {
    regionTitle = ` (${regionTarget})`;
  } else if (regionTarget === 'Indonesia+null') {
    regionTitle = ` (Indonesia)`;
  }

  const headerName = `${brandTitle}${regionTitle}`.toUpperCase();

  let text = `🎮 *${headerName}*\n`;
  text += `🏅 Harga Level: *${level}*\n`;
  text += `🛒 *CARA ORDER:*\n`;
  text += `• Saldo : \`net <kode> <id/tujuan>\`\n`;
  text += `• QRIS  : \`qris <kode> <id/tujuan>\`\n`;
  text += `───────────────`;

  // Grouping 100% menggunakan properti `productCategory` dari respon V1 API
  const grouped = new Map<string, ApiProduct[]>();
  for (const p of available) {
    const key = p.productCategory || p.category || 'Lainnya';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  }

  for (const [cat, items] of grouped) {
    text += `\n\n「 *${cat.toUpperCase()}* 」\n`;
    const sorted = [...items].sort((a, b) => a.price - b.price);
    for (const p of sorted) {
      const cleanName = (p.name || '').replace(/\*/g, '').trim();
      text += `*${cleanName}*\n${formatRupiah(p.price)} | Kode: ${p.sku.toLowerCase()}\n`;
    }
  }

  await ctx.sock.sendMessage(ctx.chatId, { text: text.trim() }, { quoted: ctx.rawMessage });
}


