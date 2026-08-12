import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export interface AppConfig {
  nodeEnv: string;
  authFolder: string;
  dataFolder: string;
  botCommandPrefix: string;
  neetstoreApiBaseUrl: string;
  ownerNumber: string;
  botName: string;
  httpPort: number;
  webhookSecret: string;
  botSecret: string;
}

export function validateEnv(): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const authFolder = path.join(__dirname, '../../auth');
  const dataFolder = path.join(__dirname, '../../data');
  const botCommandPrefix = process.env.BOT_COMMAND_PREFIX || 'new!';
  const neetstoreApiBaseUrl = process.env.NEETSTORE_API_BASE_URL || 'https://api.neetstore.id';
  const ownerNumber = process.env.OWNER_NUMBER || '6285220581369';
  const botName = process.env.BOT_NAME || 'NEETstore Bot';
  const httpPort = Number(process.env.HTTP_PORT || process.env.PORT || 8001);

  // Secret wajib ada dari ENV (tanpa fallback predictable) — FAIL FAST saat start.
  if (!process.env.WEBHOOK_SECRET) {
    throw new Error('WEBHOOK_SECRET wajib diisi di file .env');
  }
  if (!process.env.BOT_SECRET) {
    throw new Error('BOT_SECRET wajib diisi di file .env');
  }

  const webhookSecret = process.env.WEBHOOK_SECRET;
  const botSecret = process.env.BOT_SECRET;

  return {
    nodeEnv,
    authFolder,
    dataFolder,
    botCommandPrefix,
    neetstoreApiBaseUrl,
    ownerNumber,
    botName,
    httpPort,
    webhookSecret,
    botSecret,
  };
}
