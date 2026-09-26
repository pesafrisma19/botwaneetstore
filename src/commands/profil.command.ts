import { CommandContext } from '../types/command.types';
import { assertSessionPhoneMatch } from '../lib/sessionGuard';
import { formatRupiah } from '../lib/utils';
import { infoBox } from '../lib/formatter';

export async function profilCommand(ctx: CommandContext): Promise<void> {
  const guard = await assertSessionPhoneMatch(ctx);
  if (!guard.valid) return;

  const p = guard.profile;
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
