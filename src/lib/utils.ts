export function jidToPhone(jid: string): string {
  if (!jid) return '';
  const number = jid.split('@')[0];
  if (number.startsWith('62')) {
    return '0' + number.slice(2);
  }
  return number;
}

export function phoneTo62(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) return '62' + clean.slice(1);
  if (clean.startsWith('62')) return clean;
  return clean;
}

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let num = String(input).replace(/[^0-9]/g, '');
  if (!num) return null;

  // Legacy lokal Indonesia (0.. / 08..) — PN WhatsApp selalu membawa kode negara,
  // jadi kasus '0' hanya berasal dari sumber legacy/manual.
  if (num.startsWith('0')) num = '62' + num.slice(1);

  // Validasi generik E.164-like internasional (tanpa '+') — total 8 s/d 15 digit.
  // Tidak ada asumsi prefix 62. Angka @lid (>15 digit / asal tak valid) gagal di sini.
  if (!/^[1-9]\d{7,14}$/.test(num)) return null;

  return num;
}

export function phoneToJid(phone: string): string {
  return phoneTo62(phone) + '@s.whatsapp.net';
}

export function formatRupiah(number: number | string | null | undefined): string {
  return 'Rp ' + Number(number || 0).toLocaleString('id-ID');
}

export function formatExpiry(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  try {
    const expDate = new Date(dateInput);
    if (isNaN(expDate.getTime())) return '';

    const now = Date.now();
    const diffMs = expDate.getTime() - now;
    const diffMins = Math.round(diffMs / (60 * 1000));
    const diffHours = Math.round(diffMs / (60 * 60 * 1000));

    const timeFormatter = new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
      hour12: false,
    });
    const timeStr = timeFormatter.format(expDate).replace('.', ':') + ' WIB';

    if (diffMins > 0 && diffMins < 60) {
      return `${timeStr} (${diffMins} Menit)`;
    } else if (diffHours >= 1 && diffHours < 24) {
      return `${timeStr} (${diffHours} Jam)`;
    } else {
      const dateFormatter = new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
        hour12: false,
      });
      return dateFormatter.format(expDate).replace(/\./g, ':') + ' WIB';
    }
  } catch {
    return '';
  }
}

