import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from '../lib/logger';
import { normalizePhone } from '../lib/utils';

export interface SessionData {
  apiKey: string;
  username: string;
  level: string;
  updated_at: string;
}

interface SessionFile {
  [phone: string]: SessionData;
}

interface LidMapFile {
  [lidKey: string]: string;
}

interface InvoiceMapFile {
  [invoiceKey: string]: string;
}

const SESSION_FILE = path.join(config.dataFolder, 'sessions.json');
const LID_FILE = path.join(config.dataFolder, 'lid_mappings.json');
const INVOICE_FILE = path.join(config.dataFolder, 'invoice_map.json');

let memSessions: SessionFile = {};
let lidMap: LidMapFile = {};
let invoiceMap: InvoiceMapFile = {};

function ensureDir(): void {
  if (!fs.existsSync(config.dataFolder)) {
    fs.mkdirSync(config.dataFolder, { recursive: true });
  }
}

function loadFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    }
  } catch (err) {
    logger.warn({ file: filePath, err: (err as Error)?.message }, 'Gagal load JSON');
  }
  return fallback;
}

function saveFile<T>(filePath: string, data: T): void {
  ensureDir();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    logger.error({ file: filePath, err: (err as Error)?.message }, 'Gagal simpan JSON');
  }
}

function resolvePhone(senderJid: string): string | null {
  if (!senderJid) return null;

  if (senderJid.endsWith('@s.whatsapp.net')) {
    return normalizePhone(senderJid.split('@')[0]);
  }

  if (senderJid.endsWith('@lid')) {
    const lidKey = senderJid.split('@')[0];
    return lidMap[lidKey] || null;
  }

  return normalizePhone(senderJid.split('@')[0]);
}

export function saveLidMapping(lid: string, phone: string): void {
  if (!lid.endsWith('@lid')) return;
  const lidKey = lid.split('@')[0];
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 8) return;

  if (lidMap[lidKey] === normalized) return;
  lidMap[lidKey] = normalized;
  saveFile(LID_FILE, lidMap);
  logger.info({ lid: lidKey, phone: normalized }, 'LID mapping tersimpan');
}

export function getPhoneVariants(jid: string): string[] {
  const phone = jid.split('@')[0].replace(/:\d+$/, '');
  const clean = phone.replace(/\D/g, '');

  const variants = [clean];
  if (clean.startsWith('62')) {
    variants.push('0' + clean.slice(2));
  } else if (clean.startsWith('0')) {
    variants.push('62' + clean.slice(1));
  } else if (clean.startsWith('8')) {
    variants.push('62' + clean);
    variants.push('0' + clean);
  }
  return variants;
}

export function setSession(senderJid: string, data: SessionData): boolean {
  const phone = resolvePhone(senderJid);
  if (!phone) {
    logger.warn({ senderJid }, 'Tidak bisa simpan session: nomor tidak ter-resolve');
    return false;
  }

  memSessions[phone] = { ...data, updated_at: new Date().toISOString() };
  saveFile(SESSION_FILE, memSessions);
  logger.info({ phone, username: data.username }, 'Session tersimpan');
  return true;
}

export function getSession(senderJid: string): SessionData | null {
  if (!senderJid) return null;
  const phone = resolvePhone(senderJid);

  if (phone && memSessions[phone]) return memSessions[phone];

  if (!senderJid.endsWith('@lid')) {
    for (const v of getPhoneVariants(senderJid)) {
      if (memSessions[v]) return memSessions[v];
    }
  }
  return null;
}

export function removeSession(senderJid: string): void {
  const phone = resolvePhone(senderJid);
  if (!phone) return;
  if (memSessions[phone]) {
    delete memSessions[phone];
    saveFile(SESSION_FILE, memSessions);
    logger.info({ phone }, 'Session dihapus');
  }
}

export function hasSession(senderJid: string): boolean {
  return getSession(senderJid) !== null;
}

export function getPhoneFromJid(senderJid: string): string | null {
  return resolvePhone(senderJid);
}

export function saveInvoiceMapping(invoiceId: string, phone: string): void {
  if (!invoiceId || !phone) return;
  invoiceMap[invoiceId] = phone;
  saveFile(INVOICE_FILE, invoiceMap);
}

export function getInvoicePhone(invoiceId: string): string | null {
  if (!invoiceId) return null;
  return invoiceMap[invoiceId] || null;
}

export function loadAll(): void {
  memSessions = loadFile<SessionFile>(SESSION_FILE, {});
  lidMap = loadFile<LidMapFile>(LID_FILE, {});
  invoiceMap = loadFile<InvoiceMapFile>(INVOICE_FILE, {});
  logger.info(
    { sessions: Object.keys(memSessions).length, lids: Object.keys(lidMap).length, invoices: Object.keys(invoiceMap).length },
    'Session, LID & invoice mapping dimuat'
  );
}

loadAll();
