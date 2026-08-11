import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export interface AppConfig {
  nodeEnv: string;
  authFolder: string;
}

export function validateEnv(): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const authFolder = path.join(__dirname, '../../auth');

  return {
    nodeEnv,
    authFolder,
  };
}
