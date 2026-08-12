import os from 'os';
import { CommandContext } from '../types/command.types';
import { config } from '../config';

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  let res = '';
  if (d > 0) res += `${d} Hari, `;
  if (h > 0) res += `${h} Jam, `;
  if (m > 0) res += `${m} Menit, `;
  res += `${s} Detik`;
  return res;
}

export async function pingCommand(ctx: CommandContext): Promise<void> {
  const msgTimestamp = Number(ctx.rawMessage.messageTimestamp) * 1000;
  const now = Date.now();
  let pingMs = now - msgTimestamp;
  if (pingMs < 0) pingMs = 0;

  const memoryUsage = process.memoryUsage();
  const ram = Math.round(memoryUsage.rss / 1024 / 1024);
  const totalRam = Math.round(os.totalmem() / 1024 / 1024);
  const uptime = formatUptime(process.uptime());
  const isConnected = Boolean(ctx.sock.user);

  const text = `🏓 *SYSTEM INFO (REALTIME)*

⏱️ *Runtime:* ${uptime}
🚀 *Speed:* ${pingMs} ms
⚡ *RAM Terpakai:* ${ram} MB / ${totalRam} MB
💻 *OS/Platform:* ${os.type()} ${os.release()}
📡 *API:* ${config.neetstoreApiBaseUrl}
🟢 *Status:* ${isConnected ? 'Online & Sync' : 'Disconnected'}`;

  await ctx.sock.sendMessage(ctx.chatId, { text }, { quoted: ctx.rawMessage });
}
