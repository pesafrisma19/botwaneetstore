import { validateEnv, AppConfig } from './env';

export const config: AppConfig = validateEnv();

export const botName = config.botName;
export const ownerNumber = config.ownerNumber;
export const botCommandPrefix = config.botCommandPrefix;
export const neetstoreApiBaseUrl = config.neetstoreApiBaseUrl;
export const botSecret = config.botSecret;
