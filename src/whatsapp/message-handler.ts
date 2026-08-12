import { WASocket, BaileysEventMap } from '@whiskeysockets/baileys';
import { performance } from 'node:perf_hooks';
import { commandRegistry } from '../handlers/command.registry';
import { config } from '../config';
import { getPendingOrder, clearPendingOrder } from '../state/order-pending';
import { confirmOrder } from '../commands/order.command';
import { logger } from '../lib/logger';
import { resolvePhone } from '../lib/lid';

const YES_ARGS = ['Y', 'YA', 'YES', 'OK', 'GAS', 'LANJUT'];
const NO_ARGS = ['N', 'NO', 'GA', 'GAK', 'G', 'TIDAK', 'BATAL'];

export function handleIncomingMessages(sock: WASocket, upsert: BaileysEventMap['messages.upsert']): void {
  if (upsert.type !== 'notify') return;

  for (const msg of upsert.messages) {
    const startTime = performance.now();

    if (msg.key.fromMe) continue;

    const chatId = msg.key.remoteJid;
    if (!chatId || chatId === 'status@broadcast') continue;

    const text = (
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      ''
    ).trim();

    if (!text) continue;

    const senderJid = msg.key.participant || chatId;

    // Resolve LID → nomor asli (semua sumber metadata), simpan cache mapping.
    resolvePhone({ senderJid, rawMessage: msg });

    // 1. Cek konfirmasi order menggantung (Y/N)
    const pending = getPendingOrder(senderJid);
    if (pending) {
      const upper = text.toUpperCase();
      if (YES_ARGS.includes(upper)) {
        confirmOrder(
          { sock, rawMessage: msg, chatId, senderJid, commandName: 'order', args: [], startTime },
          pending
        ).catch((err) => logger.error({ err }, 'Gagal eksekusi order hasil konfirmasi'));
        clearPendingOrder(senderJid);
        continue;
      }
      if (NO_ARGS.includes(upper)) {
        clearPendingOrder(senderJid);
        sock.sendMessage(chatId, { text: '❌ *Pesanan Dibatalkan.*\nSaldo kamu tidak terpotong.' }).catch(() => {});
        continue;
      }
    }

    // 2. Prefix validation
    if (!text.toLowerCase().startsWith(config.botCommandPrefix.toLowerCase())) continue;

    const textWithoutPrefix = text.slice(config.botCommandPrefix.length).trim();
    if (!textWithoutPrefix) continue;

    const words = textWithoutPrefix.split(/\s+/);
    const commandName = words[0].toLowerCase();
    const args = words.slice(1);

    const command = commandRegistry.getCommand(commandName);
    if (!command) continue;

    command
      .execute({ sock, rawMessage: msg, chatId, senderJid, commandName, args, startTime })
      .catch((err) => {
        logger.error({ command: commandName, err: err?.message || err }, 'Gagal eksekusi command');
        sock.sendMessage(chatId, { text: '❌ Terjadi kesalahan tak terduga. Coba lagi.' }).catch(() => {});
      });
  }
}
