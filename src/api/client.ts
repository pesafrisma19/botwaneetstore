import { config } from '../config';
import { logger } from '../lib/logger';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 15000;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function apiRequest<T = unknown>(
  endpointPath: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    apiKey?: string;
    botKey?: string;
    body?: Record<string, unknown>;
    query?: Record<string, string | number | undefined>;
  } = {}
): Promise<ApiResponse<T>> {
  const baseUrl = config.neetstoreApiBaseUrl.replace(/\/$/, '');
  const url = new URL(`${baseUrl}${endpointPath.startsWith('/') ? endpointPath : '/' + endpointPath}`);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (options.apiKey) {
    headers['X-API-KEY'] = options.apiKey;
  }
  if (options.botKey) {
    headers['X-BOT-KEY'] = options.botKey;
  }

  let lastError = '';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url.toString(), {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (!res.ok) {
        const message =
          json?.error || json?.message || json?.error?.message || `HTTP ${res.status}`;
        return { success: false, error: message };
      }

      if (json && typeof json === 'object' && 'success' in json) {
        return json as ApiResponse<T>;
      }

      return { success: true, data: json as T };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: false, error: 'Waktu request ke server habis. Coba lagi nanti.' };
      }
      lastError = err?.message || 'Gagal terhubung ke server NEETSTORE API.';
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS * (attempt + 1));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  logger.error({ endpoint: endpointPath, error: lastError }, 'API request gagal setelah retry');
  return { success: false, error: 'Gagal terhubung ke server. Coba lagi nanti.' };
}
