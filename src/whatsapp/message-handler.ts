import { WASocket, BaileysEventMap } from '@whiskeysockets/baileys';
import { performance } from 'node:perf_hooks';
import { commandRegistry } from '../handlers/command.registry';

export function handleIncomingMessages(sock: WASocket, upsert: BaileysEventMap['messages.upsert']): void {
  // Process only new messages (notify type)
  if (upsert.type !== 'notify') return;

  for (const msg of upsert.messages) {
    const startTime = performance.now();

    // 1. Ignore messages from bot itself
    if (msg.key.fromMe) continue;

    // 2. Ignore status updates / broadcast
    const chatId = msg.key.remoteJid;
    if (!chatId || chatId === 'status@broadcast') continue;

    // 3. Safely extract text message content
    const text = (
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      ''
    ).trim();

    if (!text) continue;

    // 4. Extract first word without prefix (case-insensitive)
    const words = text.split(/\s+/);
    const firstWord = words[0].toLowerCase();

    // 5. Lookup command in registry
    const command = commandRegistry.getCommand(firstWord);

    // If command is not registered (e.g. "halo", "test"), STAY SILENT. Do not reply.
    if (!command) continue;

    // 6. Identify sender for groups vs private chats
    const senderJid = msg.key.participant || chatId;
    const args = words.slice(1);

    // 7. Execute registered command asynchronously
    command.execute({
      sock,
      rawMessage: msg,
      chatId,
      senderJid,
      commandName: firstWord,
      args,
      startTime,
    }).catch((err) => {
      console.error(`❌ Error executing command "${firstWord}":`, err?.message || err);
    });
  }
}
