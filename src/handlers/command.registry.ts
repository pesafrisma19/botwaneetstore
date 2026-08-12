import { CommandDefinition } from '../types/command.types';
import { pingCommand } from '../commands/ping.command';
import { loginCommand, logoutCommand } from '../commands/login.command';
import { daftarCommand } from '../commands/daftar.command';
import { profilCommand } from '../commands/profil.command';
import { produkCommand } from '../commands/produk.command';
import { orderCommand, statusCommand, riwayatCommand, cancelOrder } from '../commands/order.command';
import { depositCommand, depositStatusCommand, depositHistoryCommand } from '../commands/deposit.command';
import { ceknickCommand } from '../commands/ceknick.command';
import { menuCommand, menuAdminCommand, paymentCommand } from '../commands/menu.command';

class CommandRegistry {
  private commands = new Map<string, CommandDefinition>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register({ name: 'ping', description: 'Cek status dan performa bot real-time', execute: pingCommand });
    this.register({ name: 'menu', description: 'Daftar perintah bot', execute: menuCommand });
    this.register({ name: 'help', description: 'Daftar perintah bot', execute: menuCommand });
    this.register({ name: 'menuadmin', description: 'Menu admin', execute: menuAdminCommand });

    this.register({ name: 'daftar', description: 'Daftar akun baru via bot (grup)', execute: daftarCommand });
    this.register({ name: 'login', description: 'Tautkan akun NEETSTORE dengan API Key', execute: loginCommand });
    this.register({ name: 'logout', description: 'Lepas akun dari bot', execute: logoutCommand });

    this.register({ name: 'profil', description: 'Melihat rincian profil akun', execute: profilCommand });
    this.register({ name: 'profile', description: 'Melihat rincian profil akun', execute: profilCommand });
    this.register({ name: 'saldo', description: 'Cek saldo akun', execute: profilCommand });
    this.register({ name: 'ceksaldo', description: 'Cek saldo akun', execute: profilCommand });
    this.register({ name: 'balance', description: 'Cek saldo akun', execute: profilCommand });

    this.register({ name: 'produk', description: 'Daftar produk', execute: produkCommand });
    this.register({ name: 'product', description: 'Daftar produk', execute: produkCommand });
    this.register({ name: 'cari', description: 'Cari produk', execute: produkCommand });
    this.register({ name: 'harga', description: 'Daftar harga produk', execute: produkCommand });

    this.register({ name: 'order', description: 'Buat order (saldo)', execute: orderCommand });
    this.register({ name: 'beli', description: 'Buat order (saldo)', execute: orderCommand });
    this.register({ name: 'net', description: 'Buat order (saldo)', execute: orderCommand });
    this.register({ name: 'qris', description: 'Buat order (QRIS)', execute: orderCommand });
    this.register({ name: 'payqris', description: 'Buat order (QRIS)', execute: orderCommand });

    this.register({ name: 'status', description: 'Cek status order', execute: statusCommand });
    this.register({ name: 'cek', description: 'Cek status order', execute: statusCommand });
    this.register({ name: 'check', description: 'Cek status order', execute: statusCommand });
    this.register({ name: 'riwayat', description: 'Riwayat order', execute: riwayatCommand });
    this.register({ name: 'history', description: 'Riwayat order', execute: riwayatCommand });
    this.register({ name: 'cancel', description: 'Batalkan pesanan menggantung', execute: cancelOrder });
    this.register({ name: 'batal', description: 'Batalkan pesanan menggantung', execute: cancelOrder });

    this.register({ name: 'deposit', description: 'Buat tagihan deposit', execute: depositCommand });
    this.register({ name: 'topup', description: 'Buat tagihan deposit', execute: depositCommand });
    this.register({ name: 'depo', description: 'Buat tagihan deposit', execute: depositCommand });
    this.register({ name: 'deposit-status', description: 'Cek status deposit', execute: depositStatusCommand });
    this.register({ name: 'deposit-history', description: 'Riwayat deposit', execute: depositHistoryCommand });

    this.register({ name: 'ceknick', description: 'Cek nickname akun game', execute: ceknickCommand });
    this.register({ name: 'ceknik', description: 'Cek nickname akun game', execute: ceknickCommand });

    this.register({ name: 'payment', description: 'Informasi pembayaran', execute: paymentCommand });
    this.register({ name: 'bayar', description: 'Informasi pembayaran', execute: paymentCommand });
    this.register({ name: 'pembayaran', description: 'Informasi pembayaran', execute: paymentCommand });
  }

  public register(command: CommandDefinition): void {
    const key = command.name.toLowerCase().trim();
    this.commands.set(key, command);
  }

  public getCommand(name: string): CommandDefinition | undefined {
    const key = name.toLowerCase().trim();
    return this.commands.get(key);
  }

  public hasCommand(name: string): boolean {
    const key = name.toLowerCase().trim();
    return this.commands.has(key);
  }

  public list(): string[] {
    return Array.from(this.commands.keys());
  }
}

export const commandRegistry = new CommandRegistry();
