import { CommandContext } from '../types/command.types';
import { getSession, invalidatePhoneSession, removeSession } from '../storage/session';
import { fetchApiProfile } from '../api/profile/profile.api';
import { resolvePhone } from './lid';
import { logger } from './logger';

export interface GuardResult {
  valid: boolean;
  apiKey?: string;
  profile?: any;
}

/**
 * Lazy Identity Guard (Terpusat):
 * Memvalidasi bahwa nomor pengirim WhatsApp saat ini identik dengan User.phone di akun website.
 * Jika tidak cocok (misalnya nomor akun di web telah diganti):
 * - Otomatis mencabut sesi lokal nomor lama dari sessions.json dan LID mapping
 * - Menolak operasi sebelum memanggil backend API v1
 * - Mengirim pesan edukatif ke pengguna tanpa meminta PIN di grup
 */
export async function assertSessionPhoneMatch(
  ctx: CommandContext,
  options: { silent?: boolean } = {}
): Promise<GuardResult> {
  const sess = getSession(ctx.senderJid);
  if (!sess) {
    if (!options.silent) {
      await ctx.sock.sendMessage(
        ctx.chatId,
        { text: '❌ Kamu belum terhubung ke bot ini.\n\nSilakan tautkan akun:\nlogin <API_KEY>' },
        { quoted: ctx.rawMessage }
      );
    }
    return { valid: false };
  }

  const senderPhone = resolvePhone({ senderJid: ctx.senderJid, rawMessage: ctx.rawMessage });
  if (!senderPhone) {
    logger.warn({ senderJid: ctx.senderJid }, 'Lazy guard: Nomor pengirim tidak ter-resolve');
    removeSession(ctx.senderJid);
    if (!options.silent) {
      await ctx.sock.sendMessage(
        ctx.chatId,
        { text: '❌ Nomor WhatsApp tidak dapat diidentifikasi. Sesi dinonaktifkan.' },
        { quoted: ctx.rawMessage }
      );
    }
    return { valid: false };
  }

  // Ambil profil dari API untuk mencocokkan nomor telepon terkini
  const res = await fetchApiProfile(sess.apiKey);
  if (!res.success || !res.data) {
    logger.warn({ error: res.error, senderPhone }, 'Lazy guard: Gagal fetch profil / API key invalid');
    removeSession(ctx.senderJid);
    invalidatePhoneSession(senderPhone);
    if (!options.silent) {
      await ctx.sock.sendMessage(
        ctx.chatId,
        { text: '❌ Sesi akun tidak valid atau API Key telah kedaluwarsa. Silakan login kembali.' },
        { quoted: ctx.rawMessage }
      );
    }
    return { valid: false };
  }

  const profile = res.data;
  const accountDigits = String(profile.phone || '').replace(/\D/g, '');

  if (!profile.phone || accountDigits !== senderPhone) {
    logger.warn(
      { senderPhone, accountPhone: profile.phone, accountDigits },
      'Lazy guard: Terdeteksi ketidakcocokan nomor WhatsApp dengan akun website! Mencabut sesi lama.'
    );

    // Hapus sesi nomor lama seketika dari storage lokal
    removeSession(ctx.senderJid);
    invalidatePhoneSession(senderPhone);

    if (!options.silent) {
      await ctx.sock.sendMessage(
        ctx.chatId,
        {
          text: '❌ Akses akun pada nomor ini telah dinonaktifkan karena nomor WhatsApp akun telah berubah. Silakan login kembali menggunakan nomor WhatsApp yang terdaftar.',
        },
        { quoted: ctx.rawMessage }
      );
    }
    return { valid: false };
  }

  return { valid: true, apiKey: sess.apiKey, profile };
}
