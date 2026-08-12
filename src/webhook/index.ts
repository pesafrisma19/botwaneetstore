import { serve } from '@hono/node-server';
import { config } from '../config';
import { createWebhookApp } from './server';
import { logger } from '../lib/logger';

export function startHttpServer(): void {
  const app = createWebhookApp();

  serve({ fetch: app.fetch, port: config.httpPort }, (info) => {
    logger.info({ port: info.port }, 'Hono HTTP server aktif');
  });
}
