import { CommandContext } from '../types/command.types';
import { requestBotRegistration, BotRegisterResult } from '../api/auth/auth.api';
import { setSession, getPhoneFromJid, saveLidMapping } from '../storage/session';
import { infoBox, loading, error } from '../lib/formatter';
import { logger } from '../lib/logger';

export async function daftarCommand(ctx: CommandContext): Promise<void> {
  const isGroup = ctx.chatId.endsWith('@g.us');

  if (isGroup) {
    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: 'Pendaftaran hanya dapat dilakukan melalui chat pribadi.' },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  const username = ctx.args[0]?.toLowerCase().trim();
  if (!username) {
    await ctx.sock.sendMessage(
      ctx.chatId,
      { text: '⚠️ Format salah.\nGunakan: new!daftar <username>\n_Contoh: new!daftar johndoe_' },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  const phone = getPhoneFromJid(ctx.senderJid);
  const wa = phone || ctx.senderJid.split('@')[0];
  const fullname = ctx.rawMessage.pushName || '';

  await ctx.sock.sendMessage(ctx.chatId, { text: loading('Sedang memproses pendaftaran...') });

  // Endpoint registrasi bot (butuh penambahan di backend web v1).
  const res = await requestBotRegistration({
    username,
    wa,
    fullname,
  });

  if (!res.success || !res.data) {
    const msg =
      res.error ||
      'Pendaftaran via bot belum tersedia di backend. Silakan daftar melalui website NEETstore, lalu tautkan dengan new!login <API_KEY>.';
    logger.warn({ error: res.error }, 'Daftar bot gagal');
    await ctx.sock.sendMessage(ctx.chatId, { text: error(msg) }, { quoted: ctx.rawMessage });
    return;
  }

  const data = res.data;
  const apiKey = data.apiKey;

  if (apiKey) {
    setSession(ctx.senderJid, {
      apiKey,
      username: data.username,
      level: data.level || 'MEMBER',
      updated_at: new Date().toISOString(),
    });

    if (ctx.senderJid.endsWith('@lid') && phone) {
      await saveLidMapping(ctx.senderJid, phone);
    }
  }

  const rows: Record<string, string> = {
    '👤 Username': data.username,
    '⭐ Level': data.level || 'MEMBER',
  };
  if (apiKey) rows['🔑 API Key'] = apiKey;

  const text = [
    '✅ *Pendaftaran Berhasil!*',
    '',
    infoBox('📋 *Data Akun Kamu*', rows),
    '',
    '⚠️ *Simpan data di atas baik-baik!* API Key tidak bisa dilihat lagi.',
  ].join('\n');

  await ctx.sock.sendMessage(ctx.chatId, { text: text }, { quoted: ctx.rawMessage });
}
