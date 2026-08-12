import { proto } from '@whiskeysockets/baileys';
import { getPhoneFromJid, saveLidMapping } from '../storage/session';
import { normalizePhone } from './utils';

export interface MessageContext {
  senderJid: string;
  rawMessage: proto.IWebMessageInfo;
}

/**
 * Resolve nomor WhatsApp asli dari sender (JID biasa atau LID).
 * Alur:
 *   1. JID biasa (@s.whatsapp.net)  → normalize langsung
 *   2. LID (@lid)                   → cek mapping tersimpan (getPhoneFromJid)
 *   3. Belum ada                     → cari PN dari metadata pesan (senderPn/participantPn/...)
 *   4. Normalize + simpan mapping
 *   5. Gagal                         → return null
 *
 * IMPORTANT: TIDAK pernah fallback ke angka LID sebagai nomor WA.
 * @returns nomor WA (format 62xxx) atau null jika tidak teridentifikasi.
 */
export function resolvePhone(ctx: MessageContext): string | null {
  const { senderJid, rawMessage } = ctx;
  if (!senderJid) return null;

  // 1. JID biasa → langsung normalize
  if (senderJid.endsWith('@s.whatsapp.net')) {
    return normalizePhone(senderJid.split('@')[0]);
  }

  // 2. Bukan LID juga (misal grup jid tanpa @lid) → normalize apa adanya
  if (!senderJid.endsWith('@lid')) {
    return normalizePhone(senderJid.split('@')[0]);
  }

  // 3. LID → cek mapping tersimpan
  const mapped = getPhoneFromJid(senderJid);
  if (mapped) return mapped;

  // 4. LID belum ter-mapping → cari PN dari metadata pesan
  const key = rawMessage?.key as unknown as {
    senderPn?: string;
    participantPn?: string;
    participantAlt?: string;
    remoteJidAlt?: string;
  };

  const pn = key?.senderPn ?? key?.participantPn ?? key?.participantAlt ?? key?.remoteJidAlt;
  if (!pn) return null;

  const normalized = normalizePhone(pn);
  if (!normalized) return null;

  // 5. Simpan cache LID → nomor agar pesan berikutnya tidak butuh metadata lagi
  saveLidMapping(senderJid, normalized);

  return normalized;
}
