import { CommandContext } from '../types/command.types';
import { requestBotRegistration, BotRegisterResult } from '../api/auth/auth.api';
import { setSession, getPhoneFromJid, saveLidMapping } from '../storage/session';
import { infoBox, loading, error } from '../lib/formatter';
import { logger } from '../lib/logger';
import { normalizePhone } from '../lib/utils';

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

  let phone = getPhoneFromJid(ctx.senderJid);

  // Resolve LID → nomor asli dari berbagai sumber metadata pesan
  if (!phone && ctx.senderJid.endsWith('@lid')) {
    const waKey = ctx.rawMessage.key as unknown as {
      senderPn?: string;
      participantPn?: string;
      participantAlt?: string;
      remoteJidAlt?: string;
    };

    const pn = waKey.senderPn ?? waKey.participantPn ?? waKey.participantAlt ?? waKey.remoteJidAlt;

    if (pn) {
      const resolved = normalizePhone(pn);
      if (resolved) {
        phone = resolved;
        saveLidMapping(ctx.senderJid, resolved);
      }
    }
  }

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
  if (apiKey) rows['🔑 API Key'] = apiKey;

  const pmText = [
    '✅ *Pendaftaran Bot Berhasil!*',
    '',
    infoBox('📋 *Data Akun Kamu*', rows),
    '',
    '🔐 *Login Website:*',
    'Gunakan nomor WA & password di atas di neetstore.id',
    '',
    '⚠️ *Simpan password baik-baik!*',
    '',
    '💬 *Tautkan Bot:*',
    'Kirim command berikut di chat ini (PM):',
    '',
    '`new!login <API_KEY>`',
    '',
    '_Contoh: new!login NST-KEY-XXXX_',
  ].join('\n');

  await ctx.sock.sendMessage(ctx.senderJid, { text: pmText });

  // Konfirmasi singkat di grup (tanpa rahasia)
  const groupText = `✅ Pendaftaran *${fullname || data.username}* berhasil!\n\n🤫 Detail akun (nomor WA & password) telah dikirim ke chat pribadi kamu. Silakan cek chat bot.`;
  await ctx.sock.sendMessage(ctx.chatId, { text: groupText }, { quoted: ctx.rawMessage });
}
