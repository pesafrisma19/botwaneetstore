import { CommandContext } from '../types/command.types';
import { fetchApiProducts } from '../api/products/products.api';
import { validateAccount } from '../api/validation/validation.api';
import { getSession } from '../storage/session';
import { loading, error } from '../lib/formatter';
import { logger } from '../lib/logger';
import { config } from '../config';

export interface GameValidatorDef {
  name: string;
  brandSlug: string;
  requiresZone: boolean;
  usage: string;
  sample: string;
  showRegion: boolean;
  showFirstTopup: boolean;
}

export const GAME_VALIDATORS: Record<string, GameValidatorDef> = {
  idml: {
    name: 'Mobile Legends',
    brandSlug: 'mobile-legends',
    requiresZone: true,
    usage: 'idml <User ID> <Server ID>',
    sample: 'idml 1615278168 16806',
    showRegion: true,
    showFirstTopup: true,
  },
  idmc: {
    name: 'Magic Chess: Go Go',
    brandSlug: 'magic-chess',
    requiresZone: true,
    usage: 'idmc <User ID> <Server ID>',
    sample: 'idmc 47821 1001',
    showRegion: false,
    showFirstTopup: true,
  },
  idff: {
    name: 'Free Fire',
    brandSlug: 'free-fire',
    requiresZone: false,
    usage: 'idff <User ID>',
    sample: 'idff 987654321',
    showRegion: false,
    showFirstTopup: false,
  },
  idhok: {
    name: 'Honor of Kings',
    brandSlug: 'honor-of-kings',
    requiresZone: false,
    usage: 'idhok <User ID>',
    sample: 'idhok 16246118369300962842',
    showRegion: false,
    showFirstTopup: false,
  },
  idgi: {
    name: 'Genshin Impact',
    brandSlug: 'genshin-impact',
    requiresZone: true,
    usage: 'idgi <UID> <Server>',
    sample: 'idgi 812345678 os_asia',
    showRegion: false,
    showFirstTopup: false,
  },
  idpm: {
    name: 'PUBG Mobile',
    brandSlug: 'pubg-mobile',
    requiresZone: false,
    usage: 'idpm <User ID>',
    sample: 'idpm 51256557534',
    showRegion: false,
    showFirstTopup: false,
  },
  idpubgm: {
    name: 'PUBG Mobile',
    brandSlug: 'pubg-mobile',
    requiresZone: false,
    usage: 'idpubgm <User ID>',
    sample: 'idpubgm 51256557534',
    showRegion: false,
    showFirstTopup: false,
  },
  idss: {
    name: 'Super Sus',
    brandSlug: 'super-sus',
    requiresZone: false,
    usage: 'idss <Space ID>',
    sample: 'idss 174840145',
    showRegion: false,
    showFirstTopup: false,
  },
  idhsr: {
    name: 'Honkai: Star Rail',
    brandSlug: 'honkai-star-rail',
    requiresZone: true,
    usage: 'idhsr <UID> <Server>',
    sample: 'idhsr 807643974 prod_official_asia',
    showRegion: false,
    showFirstTopup: false,
  },
  idzzz: {
    name: 'Zenless Zone Zero',
    brandSlug: 'zenless-zone-zero',
    requiresZone: true,
    usage: 'idzzz <UID> <Server>',
    sample: 'idzzz 1300622222 prod_gf_jp',
    showRegion: false,
    showFirstTopup: false,
  },
  idbs: {
    name: 'Blood Strike',
    brandSlug: 'blood-strike',
    requiresZone: false,
    usage: 'idbs <User ID>',
    sample: 'idbs 12345678',
    showRegion: false,
    showFirstTopup: false,
  },
};

export async function handleGameValidation(ctx: CommandContext, def: GameValidatorDef): Promise<void> {
  const sess = getSession(ctx.senderJid);
  if (!sess) {
    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: '❌ Kamu belum terhubung ke bot ini.\n\nSilakan tautkan akun:\nlogin <API_KEY>' },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  let targetAccount = ctx.args[0] || '';
  let targetZone = ctx.args[1] || '';

  // Dukung format 12345(1234)
  if (!targetZone && targetAccount.includes('(') && targetAccount.includes(')')) {
    const m = targetAccount.match(/^(.+?)\((.+?)\)$/);
    if (m) {
      targetAccount = m[1];
      targetZone = m[2];
    }
  }
  targetAccount = targetAccount.replace(/[()]/g, '').trim();
  targetZone = targetZone.replace(/[()]/g, '').trim();

  // Validasi input wajib
  if (!targetAccount || (def.requiresZone && !targetZone)) {
    const usageText = `❌ Format salah.\nGunakan:\n\`${def.usage}\`\n\n_Contoh:_\n${def.sample}`;
    await ctx.sock.sendMessage(ctx.chatId, { text: usageText }, { quoted: ctx.rawMessage });
    return;
  }

  await ctx.sock.sendMessage(ctx.chatId, { text: loading(`Mengecek akun...`) });

  // Cari produk game terkait untuk memenuhi kontrak productId API
  const prodRes = await fetchApiProducts(sess.apiKey, { search: def.brandSlug });
  const product = prodRes.data?.find(
    (p) => p.brandSlug === def.brandSlug || p.brand?.toLowerCase().includes(def.name.toLowerCase())
  );

  if (!product) {
    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: error(`Layanan validasi game *${def.name}* sedang tidak tersedia.`) },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  const res = await validateAccount(sess.apiKey, {
    productId: product.productId,
    brandId: product.brandId ? Number(product.brandId) : undefined,
    targetAccount,
    targetZone: targetZone || undefined,
  });

  if (!res.success || !res.data || !res.data.valid) {
    logger.warn({ error: res.error, game: def.brandSlug }, 'Validasi akun gagal');
    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: error(res.error || 'Akun game tidak ditemukan / tidak valid.') },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  const v = res.data;
  let text = `🎮 *${def.name.toUpperCase()}*\n`;
  text += `━━━━━━━━━━━━━━━\n`;
  text += `🆔 ID : ${targetAccount}${targetZone ? ' (' + targetZone + ')' : ''}\n`;
  text += `👤 Nickname : ${v.nickname || 'Tidak ditemukan'}\n`;

  // Khusus ML: Tampilkan Region
  if (def.showRegion) {
    const regionName = v.detectedCountry || (v.detectedRegionCode === 'ID' ? 'Indonesia' : v.detectedRegionCode) || '';
    if (regionName) {
      text += `🌍 Region : ${regionName}\n`;
    }
  }

  // Khusus ML & MC: Tampilkan First Top Up
  if (def.showFirstTopup && v.firstTopupTiers && v.firstTopupTiers.length > 0) {
    text += `\n🎁 First Top Up\n`;
    for (const tier of v.firstTopupTiers) {
      const tierName = tier.name || (tier.diamonds ? `${tier.diamonds}+${tier.bonus || tier.diamonds} 💎` : 'Tier');
      const statusLabel = tier.available ? 'Tersedia' : 'Sudah diklaim';
      text += `• ${tierName} : ${statusLabel}\n`;
    }
  }

  await ctx.sock.sendMessage(ctx.chatId, { text: text.trim() }, { quoted: ctx.rawMessage });
}

export const idmlCommand = (ctx: CommandContext) => handleGameValidation(ctx, GAME_VALIDATORS.idml);
export const idmcCommand = (ctx: CommandContext) => handleGameValidation(ctx, GAME_VALIDATORS.idmc);
export const idffCommand = (ctx: CommandContext) => handleGameValidation(ctx, GAME_VALIDATORS.idff);
export const idhokCommand = (ctx: CommandContext) => handleGameValidation(ctx, GAME_VALIDATORS.idhok);
export const idgiCommand = (ctx: CommandContext) => handleGameValidation(ctx, GAME_VALIDATORS.idgi);
export const idpmCommand = (ctx: CommandContext) => handleGameValidation(ctx, GAME_VALIDATORS.idpm);
export const idpubgmCommand = (ctx: CommandContext) => handleGameValidation(ctx, GAME_VALIDATORS.idpubgm);
export const idssCommand = (ctx: CommandContext) => handleGameValidation(ctx, GAME_VALIDATORS.idss);
export const idhsrCommand = (ctx: CommandContext) => handleGameValidation(ctx, GAME_VALIDATORS.idhsr);
export const idzzzCommand = (ctx: CommandContext) => handleGameValidation(ctx, GAME_VALIDATORS.idzzz);
export const idbsCommand = (ctx: CommandContext) => handleGameValidation(ctx, GAME_VALIDATORS.idbs);

export async function cekidCommand(ctx: CommandContext): Promise<void> {
  const prefix = config.botCommandPrefix;
  let text = `🔎 *CEK ID GAME*\n━━━━━━━━━━━━━━━\n\n`;

  const seenSlugs = new Set<string>();
  for (const [, def] of Object.entries(GAME_VALIDATORS)) {
    if (seenSlugs.has(def.brandSlug)) continue;
    seenSlugs.add(def.brandSlug);

    const usage = prefix ? `${prefix}${def.usage}` : def.usage;
    text += `• ${def.name}\n\`${usage}\`\n\n`;
  }

  await ctx.sock.sendMessage(ctx.chatId, { text: text.trim() }, { quoted: ctx.rawMessage });
}
