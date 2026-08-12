import { CommandContext } from '../types/command.types';
import { boxHeader, section, footer, infoBox } from '../lib/formatter';
import { config, ownerNumber } from '../config';
import { getSocketInstance } from '../whatsapp/client';
import { phoneToJid } from '../lib/utils';

export async function menuCommand(ctx: CommandContext): Promise<void> {
  const prefix = config.botCommandPrefix;
  const text = `${boxHeader(`🤖 *${config.botName}*`)}

📋 *Daftar Perintah User:*

${section('📝 *AKUN*', `│  ${prefix}daftar <username>
│  ${prefix}login <API_KEY>  — Tautkan akun web
│  ${prefix}profil  — Info akun & saldo
│  ${prefix}saldo   — Cek saldo saja`)}

${section('📦 *PRODUK*', `│  ${prefix}produk          — Semua produk
│  ${prefix}produk <brand/kategori>
│  ${prefix}produk <keyword>  — Cari produk`)}

${section('🛒 *ORDER*', `│  ${prefix}order <sku> <id> [zone]
│  ${prefix}order <sku> <id> --qris  (bayar QRIS)`)}

${section('🔎 *CEK AKUN GAME*', `│  ${prefix}ceknick <sku> <id> [zone]
│  _Contoh: ${prefix}ceknick MOBILE_LEGENDS 123456 1234_`)}

${section('📋 *CEK & RIWAYAT*', `│  ${prefix}status <ref_id>  — Cek status order/deposit
│  ${prefix}riwayat          — Riwayat order`)}

${section('💰 *DEPOSIT*', `│  ${prefix}deposit <nominal> <metode>
│  _Contoh: ${prefix}deposit 50000 QRIS_`)}

${footer()}`;

  await ctx.sock.sendMessage(ctx.chatId, { text });
}

export async function menuAdminCommand(ctx: CommandContext): Promise<void> {
  const ownerNumbers = ownerNumber.split(',').map((n) => n.trim());
  const senderNumber = ctx.senderJid.split('@')[0];
  const isOwner = ownerNumbers.includes(senderNumber);

  if (!isOwner) {
    await ctx.sock.sendMessage(ctx.chatId, { text: '🛡️ *Akses Ditolak*\n\nPerintah ini hanya untuk Admin.' });
    return;
  }

  const text = `${boxHeader(`🛡️ *${config.botName} — Admin Panel*`)}

🔐 *Daftar Perintah Admin:*

${section('ℹ️ *INFO*', `│  Admin terdaftar: ${ownerNumber}
│  Semua perintah user juga bisa diakses admin`)}

${footer()}`;

  await ctx.sock.sendMessage(ctx.chatId, { text });
}

export async function paymentCommand(ctx: CommandContext): Promise<void> {
  const text = `💳 *INFORMASI PEMBAYARAN NEETSTORE* 💳

Silakan lakukan pembayaran melalui salah satu metode di bawah ini:

📱 *E-WALLET & QRIS*
» *QRIS* : Scan QRIS yang dikirim bot saat deposit
» *GOPAY* : \`088975323968\`
» *DANA*  : \`081221947806\`

🏦 *TRANSFER BANK*
» *BCA*     : \`4310613130\`
» *Seabank* : \`901190124859\`

📞 *PULSA*
» *Telkomsel* : \`085220581369\`

⚠️ *PENTING UNTUK PEMBAYARAN:*
• Bank ke Dana tambah *Rp 500*
• QRIS tambah *0,5%* jika di atas *Rp 500.000*
• Transfer Pulsa Telkomsel tambah *35%*

📸 _Jika sudah melakukan transfer, harap kirimkan / reply dengan bukti transfernya._`;

  await ctx.sock.sendMessage(ctx.chatId, { text }, { quoted: ctx.rawMessage });
}

export async function ownerDmCommand(ctx: CommandContext): Promise<void> {
  const ownerNumbers = ownerNumber.split(',').map((n) => n.trim());
  const senderNumber = ctx.senderJid.split('@')[0];
  if (!ownerNumbers.includes(senderNumber)) return;

  const sock = getSocketInstance();
  await sock.sendMessage(phoneToJid(ownerNumbers[0]), {
    text: infoBox('📊 *LAPORAN BOT*', {
      '👤 Sender': ctx.senderJid,
      '💬 Chat': ctx.chatId,
      '📝 Command': ctx.commandName,
    }),
  });
}
