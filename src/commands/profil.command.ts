import { CommandContext } from '../types/command.types';
import { fetchApiProfile } from '../api/profile/profile.api';
import { getSession } from '../storage/session';
import { formatRupiah } from '../lib/utils';
import { infoBox, loading, error } from '../lib/formatter';
import { logger } from '../lib/logger';

export async function profilCommand(ctx: CommandContext): Promise<void> {
  const sess = getSession(ctx.senderJid);
  if (!sess) {
    await ctx.sock.sendMessage(
      ctx.chatId,
      {
        text: '❌ Kamu belum terhubung ke bot ini.\n\nSilakan tautkan akun:\nnew!login <API_KEY>',
      },
      { quoted: ctx.rawMessage }
    );
    return;
  }

  await ctx.sock.sendMessage(ctx.chatId, { text: loading('Mengambil data akun...') });

  const res = await fetchApiProfile(sess.apiKey);

  if (!res.success || !res.data) {
    logger.warn({ error: res.error }, 'Profil gagal diambil');
    await ctx.sock.sendMessage(ctx.chatId, { text: error(res.error || 'Gagal mengambil profil.') }, { quoted: ctx.rawMessage });
    return;
  }

  const p = res.data;
  const isSaldo = ctx.commandName === 'saldo' || ctx.commandName === 'ceksaldo' || ctx.commandName === 'balance';
  const displayName = p.fullname || p.username;

  if (isSaldo) {
    const text = `💰 *Saldo Kamu*\n\n👤 ${displayName}\n💵 *${formatRupiah(p.balance)}*`;
    await ctx.sock.sendMessage(ctx.chatId, { text }, { quoted: ctx.rawMessage });
    return;
  }

  const text = [
    '👤 *PROFIL AKUN*',
    '──────────────',
    infoBox('📋 *Data Akun*', {
      '👤 Nama': displayName,
      '⭐ Level': p.level,
      '💰 Balance': formatRupiah(p.balance),
    }),
  ].join('\n');

  await ctx.sock.sendMessage(ctx.chatId, { text }, { quoted: ctx.rawMessage });
}
