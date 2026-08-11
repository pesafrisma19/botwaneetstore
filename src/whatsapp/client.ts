import { WASocket } from '@whiskeysockets/baileys';

let socketInstance: WASocket | null = null;

export function setSocketInstance(sock: WASocket): void {
  socketInstance = sock;
}

export function getSocketInstance(): WASocket {
  if (!socketInstance) {
    throw new Error('WASocket is not initialized yet. Call startWhatsAppConnection first.');
  }
  return socketInstance;
}
