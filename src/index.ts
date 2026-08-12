import { validateEnv } from './config/env';
import { startWhatsAppConnection } from './whatsapp/connection';
import { startHttpServer } from './webhook';

async function bootstrap() {
  console.log('🚀 Starting neetstore-wa-bot (Hono + TypeScript)...');

  try {
    const config = validateEnv();
    console.log(`ℹ️ Environment: ${config.nodeEnv}`);

    // Start Hono HTTP server (QR view + health + webhook receiver)
    startHttpServer();

    await startWhatsAppConnection(config);
  } catch (err: any) {
    console.error('❌ Fatal error during bot startup:', err?.message || err);
    process.exit(1);
  }
}

bootstrap();
