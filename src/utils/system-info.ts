import os from 'node:os';

export interface SystemMetrics {
  botUptime: string;
  serverUptime: string;
  cpuUsagePercent: number;
  ramUsedFormatted: string;
  ramTotalFormatted: string;
  nodeVersion: string;
  platform: string;
}

export function formatUptime(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const sec = totalSeconds % 60;
  const min = Math.floor((totalSeconds / 60) % 60);
  const hr = Math.floor((totalSeconds / 3600) % 24);
  const day = Math.floor(totalSeconds / 86400);

  const parts: string[] = [];
  if (day > 0) parts.push(`${day} hari`);
  if (hr > 0) parts.push(`${hr} jam`);
  if (min > 0) parts.push(`${min} menit`);
  if (sec > 0 || parts.length === 0) parts.push(`${sec} detik`);

  return parts.join(' ');
}

export function getCpuUsagePercent(): number {
  const cpus = os.cpus();
  let totalTimes = 0;
  let totalIdle = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTimes += (cpu.times as any)[type];
    }
    totalIdle += cpu.times.idle;
  }

  if (totalTimes === 0) return 0;
  const used = totalTimes - totalIdle;
  return Number(((used / totalTimes) * 100).toFixed(1));
}

export function getSystemMetrics(): SystemMetrics {
  const botUptimeSec = process.uptime();
  const serverUptimeSec = os.uptime();

  const totalMemGB = os.totalmem() / (1024 * 1024 * 1024);
  const usedMemGB = (os.totalmem() - os.freemem()) / (1024 * 1024 * 1024);

  return {
    botUptime: formatUptime(botUptimeSec),
    serverUptime: formatUptime(serverUptimeSec),
    cpuUsagePercent: getCpuUsagePercent(),
    ramUsedFormatted: `${usedMemGB.toFixed(1)} GB`,
    ramTotalFormatted: `${totalMemGB.toFixed(1)} GB`,
    nodeVersion: process.version,
    platform: os.platform(),
  };
}
