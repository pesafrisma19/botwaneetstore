import { WASocket } from '@whiskeysockets/baileys';
import { handleIncomingMessages } from './message-handler';
import { saveLidMapping } from '../storage/session';
import { logger } from '../lib/logger';

export function registerWhatsAppEvents(sock: WASocket): void {
  sock.ev.on('messages.upsert', (upsert) => {
    handleIncomingMessages(sock, upsert);
  });

  // Resolve LID → nomor asli dari data kontak (sumber andal, dikirim WhatsApp saat kontak dikenal)
  sock.ev.on('contacts.upsert', (contacts) => {
    for (const c of contacts) {
      if (c.lid && c.jid) {
        saveLidMapping(`${c.lid.split('@')[0]}@lid`, c.jid.split('@')[0]);
      }
    }
  });

  sock.ev.on('contacts.update', (contacts) => {
    for (const c of contacts) {
      if (c.lid && c.jid) {
        saveLidMapping(`${c.lid.split('@')[0]}@lid`, c.jid.split('@')[0]);
      }
    }
  });
}
