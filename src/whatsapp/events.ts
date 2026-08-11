import { WASocket } from '@whiskeysockets/baileys';
import { handleIncomingMessages } from './message-handler';

export function registerWhatsAppEvents(sock: WASocket): void {
  sock.ev.on('messages.upsert', (upsert) => {
    handleIncomingMessages(sock, upsert);
  });
}
