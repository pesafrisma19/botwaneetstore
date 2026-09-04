import { CommandContext } from '../types/command.types';
import { fetchApiProfile } from '../api/profile/profile.api';
import { setSession, saveLidMapping } from '../storage/session';
import { formatRupiah } from '../lib/utils';
import { infoBox, loading, error } from '../lib/formatter';
import { logger } from '../lib/logger';
import { resolvePhone } from '../lib/lid';

export async function loginCommand(ctx: CommandContext): Promise<void> {
  const isGroup = ctx.chatId.endsWith('@g.us');

  if (isGroup) {
    const groupWarnText = [
      '🛡️ *Keamanan Akun*',
      '',
      'Perintah `login` wajib dilakukan di *Chat Pribadi (Japri) Bot* agar API Key kamu tidak dilihat oleh anggota grup lain.',
      '',
      '👉 Silakan kirim pesan ke chat pribadi bot ini:',
      '`login <API_KEY>`',
    ].join('\n');

    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: groupWarnText },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  const apiKey = ctx.args[0]?.trim();
  if (!apiKey) {
    const formatWarnText = [
      '⚠️ *Format Login Salah!*',
      '',
      'Cara menghubungkan akun website ke Bot WhatsApp:',
      '',
      '1️⃣ Dapatkan API Key di web: *neetstore.id* (Menu *Profil ➡️ API Key*)',
      '2️⃣ Kirim ke chat pribadi ini dengan format:',
      '   `login <API_KEY>`',
      '',
      '_Contoh:_',
      '`login nts_live_98a7sd8f7as6df78as`',
    ].join('\n');

    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: formatWarnText },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  // Resolve nomor WhatsApp asli SEBELUM request API — tanpa fallback ke LID.
  const phone = resolvePhone({ senderJid: ctx.senderJid, rawMessage: ctx.rawMessage });

  // Kalau nomor asli tidak ketemu, tolak biar tidak salah identitas
  if (!phone) {
    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: error('Nomor WhatsApp tidak teridentifikasi. Silakan kirim pesan sekali lagi, lalu coba login <API_KEY>.') },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  await ctx.sock.sendMessage(ctx.chatId, { text: loading('Mensinkronkan akun dengan website...') });

  const res = await fetchApiProfile(apiKey);

  if (!res.success || !res.data) {
    const msg =
      res.error ||
      'API Key tidak valid / belum disetujui / IP belum di whitelist. Cek di halaman API Key web.';
    logger.warn({ error: res.error }, 'Login gagal via v1 profile');
    await ctx.sock.sendMessage(ctx.chatId, { text: error(msg) }, { quoted: ctx.rawMessage });
    return;
  }

  const profile = res.data;

  // WAJIB: API key harus milik User dengan nomor WhatsApp pengirim yang SAMA.
  const accountDigits = String(profile.phone || '').replace(/\D/g, '');
  if (!profile.phone || accountDigits !== phone) {
    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: error('API Key tidak sesuai dengan nomor WhatsApp kamu.') },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  const saved = setSession(ctx.senderJid, {
    apiKey,
    updated_at: new Date().toISOString(),
  });

  if (!saved) {
    await ctx.sock.sendMessage(ctx.chatId, { text: error('Nomor WhatsApp tidak dapat diidentifikasi. Coba kirim pesan sekali lagi.') });
    return;
  }

  if (ctx.senderJid.endsWith('@lid')) {
    await saveLidMapping(ctx.senderJid, phone);
  }

  const responseText = [
    '✅ *Login / Tautkan Akun Berhasil!*',
    '',
    infoBox('📋 *Data Akun Kamu*', {
      '👤 Nama': profile.fullname || profile.username,
      '⭐ Level': profile.level,
      '💰 Balance': formatRupiah(profile.balance),
    }),
    '',
    'Akun WhatsApp kamu sekarang sudah terhubung dengan website NEETstore. Ketik *menu* untuk melihat perintah.',
  ].join('\n');

  await ctx.sock.sendMessage(ctx.chatId, { text: responseText }, { quoted: ctx.rawMessage });
}

export async function logoutCommand(ctx: CommandContext): Promise<void> {
  const { removeSession } = require('../storage/session');
  removeSession(ctx.senderJid);
  await ctx.sock.sendMessage(ctx.chatId, { text: '✅ Akun berhasil dilepaskan dari bot ini.' }, { quoted: ctx.rawMessage });
}
