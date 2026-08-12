import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { AppConfig } from '../config/env';
import { setSocketInstance } from './client';
import { registerWhatsAppEvents } from './events';
import { loadAll } from '../storage/session';

let isConnecting = false;
let currentQr = '';

const RECONNECT_BASE_MS = 3000;
const RECONNECT_MAX_MS = 60000;
let reconnectDelayMs = RECONNECT_BASE_MS;
let reconnectTimer: NodeJS.Timeout | null = null;

export function getCurrentQr(): string {
  return currentQr;
}

function scheduleReconnect(config: AppConfig): void {
  if (reconnectTimer) return;
  const delay = reconnectDelayMs;
  reconnectDelayMs = Math.min(reconnectDelayMs * 2, RECONNECT_MAX_MS);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startWhatsAppConnection(config).catch((err) => {
      console.error('❌ Failed to reconnect WhatsApp:', err?.message || err);
    });
  }, delay);
}

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function resetReconnectBackoff(): void {
  reconnectDelayMs = RECONNECT_BASE_MS;
}

export async function startWhatsAppConnection(config: AppConfig): Promise<WASocket> {
  if (isConnecting) {
    throw new Error('Connection attempt already in progress.');
  }

  isConnecting = true;
  console.log('🔄 Initializing WhatsApp Auth State from auth/ ...');

  loadAll();

  const { state, saveCreds } = await useMultiFileAuthState(config.authFolder);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // Custom handler below using qrcode-terminal
    logger: pino({ level: 'silent' }),
    browser: ['NEETSTORE WA Bot', 'Chrome', '1.0.0'],
  });

  setSocketInstance(sock);

  // Save session credentials whenever updated
  sock.ev.on('creds.update', saveCreds);

  // Handle connection status lifecycle
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Render pairing QR code in terminal if session is not yet authenticated
    if (qr) {
      currentQr = qr;
      console.log('\n================================================================');
      console.log('📱 SCAN THIS QR CODE FROM WHATSAPP MOBILE APP TO PAIR BOT');
      console.log('👉 WhatsApp -> Settings -> Linked Devices -> Link a Device');
      console.log('================================================================\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      isConnecting = false;
      currentQr = '';
      clearReconnectTimer();
      resetReconnectBackoff();
      const botNumber = sock.user?.id ? sock.user.id.split(':')[0] : 'Unknown';
      console.log('\n================================================================');
      console.log(`✅ WHATSAPP BOT CONNECTED SUCCESSFULLY!`);
      console.log(`📱 Bot WA Number: ${botNumber}`);
      console.log('================================================================\n');
    }

    if (connection === 'close') {
      isConnecting = false;
      currentQr = '';
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;

      console.log(`⚠️ Connection closed. Status Code: ${statusCode || 'Unknown'}`);

      if (isLoggedOut) {
        // JANGAN auto-reconnect saat sesi di-logout WhatsApp.
        clearReconnectTimer();
        resetReconnectBackoff();
        console.error('\n❌ FATAL: Bot session was logged out by WhatsApp.');
        console.error('👉 Please clear/delete the "auth/" folder and restart the bot to scan a new QR code.\n');
      } else {
        console.log('🔄 Temporary disconnection detected. Reconnecting with exponential backoff...');
        scheduleReconnect(config);
      }
    }
  });

  // Attach event listener foundation
  registerWhatsAppEvents(sock);

  return sock;
}
