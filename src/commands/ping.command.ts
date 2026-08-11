import { performance } from 'node:perf_hooks';
import { CommandContext } from '../types/command.types';
import { getSystemMetrics } from '../utils/system-info';

export async function pingCommand(ctx: CommandContext): Promise<void> {
  const endTime = performance.now();
  const responseTimeMs = Math.round(endTime - ctx.startTime);

  const metrics = getSystemMetrics();
  const isConnected = Boolean(ctx.sock.user);

  const responseText = [
    'PONG!',
    '',
    `Response      : ${responseTimeMs} ms`,
    `Bot Uptime    : ${metrics.botUptime}`,
    `Server Uptime : ${metrics.serverUptime}`,
    `CPU           : ${metrics.cpuUsagePercent}%`,
    `RAM           : ${metrics.ramUsedFormatted} / ${metrics.ramTotalFormatted}`,
    `Node.js       : ${metrics.nodeVersion}`,
    `Platform      : ${metrics.platform}`,
    `WhatsApp      : ${isConnected ? 'Connected' : 'Disconnected'}`,
  ].join('\n');

  await ctx.sock.sendMessage(ctx.chatId, { text: responseText }, { quoted: ctx.rawMessage });
}
