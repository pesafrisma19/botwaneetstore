import { botName } from '../config';

export function boxHeader(title: string): string {
  return `╔═════════════════════╗\n║   ${title}\n╚═════════════════════╝`;
}

export function section(title: string, content: string): string {
  return `┌─ ${title}\n${content}\n└──────────────`;
}

export function infoBox(title: string, rows: Record<string, string | number>): string {
  let text = `╔═════════════════════╗\n║  ${title}\n╠═════════════════════╣\n`;
  for (const [label, value] of Object.entries(rows)) {
    text += `║ ${label} : *${value}*\n`;
  }
  text += `╚═════════════════════╝`;
  return text;
}

export function success(message: string): string {
  return `✅ *Berhasil!*\n\n${message}`;
}

export function error(message: string): string {
  return `❌ *Gagal!*\n\n📝 Alasan: ${message}`;
}

export function loading(message = 'Sedang memproses...'): string {
  return `⏳ _${message}_`;
}

export function warning(message: string): string {
  return `⚠️ *Perhatian!*\n\n${message}`;
}

export function footer(): string {
  return `\n⚡ _Powered by ${botName}_`;
}
