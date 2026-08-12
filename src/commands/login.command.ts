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
    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: 'Command ini hanya bisa digunakan di chat pribadi.' },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  const apiKey = ctx.args[0]?.trim();
  if (!apiKey) {
    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: '⚠️ Format salah.\nGunakan: new!login <API_KEY>' },
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

  // Resolve nomor WhatsApp asli (dari mapping LID / metadata pesan). Tanpa fallback ke LID.
  const phone = resolvePhone({ senderJid: ctx.senderJid, rawMessage: ctx.rawMessage });

  // Kalau nomor asli tidak ketemu, tolak biar tidak salah identitas
  if (!phone) {
    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: error('Nomor WhatsApp tidak teridentifikasi. Silakan kirim pesan sekali lagi, lalu coba new!login <API_KEY>.') },
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
    'Akun WhatsApp kamu sekarang sudah terhubung dengan website NEETstore. Ketik *new!menu* untuk melihat perintah.',
  ].join('\n');

  await ctx.sock.sendMessage(ctx.chatId, { text: responseText }, { quoted: ctx.rawMessage });
}

export async function logoutCommand(ctx: CommandContext): Promise<void> {
  const { removeSession } = require('../storage/session');
  removeSession(ctx.senderJid);
  await ctx.sock.sendMessage(ctx.chatId, { text: '✅ Akun berhasil dilepaskan dari bot ini.' }, { quoted: ctx.rawMessage });
}
