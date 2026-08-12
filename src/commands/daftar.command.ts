import { CommandContext } from '../types/command.types';
import { requestBotRegistration, BotRegisterResult } from '../api/auth/auth.api';
import { setSession, saveLidMapping } from '../storage/session';
import { infoBox, loading, error } from '../lib/formatter';
import { logger } from '../lib/logger';
import { resolvePhone } from '../lib/lid';

export async function daftarCommand(ctx: CommandContext): Promise<void> {
  const isGroup = ctx.chatId.endsWith('@g.us');
  const subCommand = ctx.args[0]?.toLowerCase();

  // Wajib format: new!daftar bot
  if (subCommand !== 'bot') {
    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: '⚠️ Format salah.\nGunakan: new!daftar bot' },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  if (!isGroup) {
    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: 'Pendaftaran hanya bisa dilakukan di dalam grup.' },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  // Resolve nomor WhatsApp asli (dari mapping LID / metadata pesan). Tanpa fallback ke LID.
  const phone = resolvePhone({ senderJid: ctx.senderJid, rawMessage: ctx.rawMessage });

  const fullname = ctx.rawMessage.pushName || '';

  // JANGAN fallback ke LID — kalau nomor asli tidak ketemu, tolak biar tidak bikin akun nomor salah
  if (!phone) {
    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: '❌ Nomor WhatsApp tidak teridentifikasi. Silakan kirim pesan sekali lagi, lalu coba new!daftar bot.' },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  const wa = phone;

  await ctx.sock.sendMessage(ctx.chatId, { text: loading('Sedang memproses pendaftaran...') });

  const res = await requestBotRegistration({
    wa,
    fullname,
  });

  if (!res.success || !res.data) {
    const msg = res.error || 'Pendaftaran gagal. Silakan coba lagi.';
    logger.warn({ error: res.error }, 'Daftar bot gagal');
    await ctx.sock.sendMessage(ctx.chatId, { text: error(msg) }, { quoted: ctx.rawMessage });
    return;
  }

  const data = res.data;

  // Kasus: nomor & API key sudah aktif → arahkan ke login
  if (data.alreadyRegistered) {
    await ctx.sock.sendMessage(ctx.chatId, {
      text: '✅ Nomor WhatsApp kamu sudah terdaftar!\n\nTautkan akun dengan: `new!login <API_KEY>`',
    }, { quoted: ctx.rawMessage });
    return;
  }

  const apiKey = data.apiKey;

  if (apiKey) {
    setSession(ctx.senderJid, {
      apiKey,
      updated_at: new Date().toISOString(),
    });

    if (ctx.senderJid.endsWith('@lid') && phone) {
      await saveLidMapping(ctx.senderJid, phone);
    }
  }

  // Detail akun dikirim ke CHAT PRIBADI (PM) pengirim — aman, tidak bocor di grup
  const rows: Record<string, string> = {
    '👤 Nama': fullname || data.username,
    '⭐ Level': data.level || 'MEMBER',
  };
  if (data.password) rows['🔑 Password'] = data.password;

  const pmText = [
    '✅ *Pendaftaran Bot Berhasil!*',
    '',
    infoBox('📋 *Data Akun Kamu*', rows),
    '',
    '🔐 *Login Website:*',
    'Gunakan nomor WA & password di atas di neetstore.id',
    '',
    '⚠️ *Simpan password baik-baik!*',
  ].join('\n');

  await ctx.sock.sendMessage(ctx.senderJid, { text: pmText });

  // Konfirmasi singkat di grup (tanpa rahasia)
  const groupText = `✅ Pendaftaran *${fullname || data.username}* berhasil!\n\n🤫 Detail akun (nomor WA & password) telah dikirim ke chat pribadi kamu. Silakan cek chat bot.`;
  await ctx.sock.sendMessage(ctx.chatId, { text: groupText }, { quoted: ctx.rawMessage });
}
