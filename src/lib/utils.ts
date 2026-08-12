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

  if (num.startsWith('08')) return '62' + num.slice(1);
  if (num.startsWith('0')) return '62' + num.slice(1);
  if (num.startsWith('8') && num.length >= 9 && num.length <= 13) return '62' + num;
  if (num.startsWith('62')) return num;
  return num;
}

export function phoneToJid(phone: string): string {
  return phoneTo62(phone) + '@s.whatsapp.net';
}

export function formatRupiah(number: number | string | null | undefined): string {
  return 'Rp ' + Number(number || 0).toLocaleString('id-ID');
}
