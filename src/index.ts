import { validateEnv } from './config/env';
import { startWhatsAppConnection } from './whatsapp/connection';

async function bootstrap() {
  console.log('🚀 Starting neetstore-wa-bot foundation...');

  try {
    const config = validateEnv();
    console.log(`ℹ️ Environment: ${config.nodeEnv}`);

    await startWhatsAppConnection(config);
  } catch (err: any) {
    console.error('❌ Fatal error during bot startup:', err?.message || err);
    process.exit(1);
  }
}

bootstrap();
