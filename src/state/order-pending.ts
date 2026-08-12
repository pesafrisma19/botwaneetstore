export interface PendingOrder {
  senderJid: string;
  refId: string;
  sku: string;
  productId?: number;
  targetAccount: string;
  targetZone?: string;
  nickname?: string;
  paymentMethod: 'BALANCE' | 'QRIS';
  timestamp: number;
  chatId: string;
}

const pendingMap = new Map<string, PendingOrder>();
const CONFIRM_TTL_MS = 5 * 60 * 1000;

export function setPendingOrder(senderJid: string, order: PendingOrder): void {
  pendingMap.set(senderJid, order);
}

export function getPendingOrder(senderJid: string): PendingOrder | null {
  const order = pendingMap.get(senderJid);
  if (!order) return null;
  if (Date.now() - order.timestamp > CONFIRM_TTL_MS) {
    pendingMap.delete(senderJid);
    return null;
  }
  return order;
}

export function clearPendingOrder(senderJid: string): void {
  pendingMap.delete(senderJid);
}

export const PENDING = pendingMap;
