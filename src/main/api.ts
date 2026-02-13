import axios, { AxiosResponse } from 'axios';
import { USAGE_API_TEMPLATE, USER_AGENT } from './constants';
import * as store from './store';
import { getMainWindow } from './window';
import type { UsageData } from '../types/usage';

const API_RETRIES = 5;
const API_RETRY_DELAY_MS = 3000;

export function buildCookieHeader(sessionKey: string): string {
  const extra = store.getApiCookies();
  const parts = [`sessionKey=${sessionKey}`];
  for (const [name, value] of Object.entries(extra)) {
    if (name !== 'sessionKey') {
      parts.push(`${name}=${value}`);
    }
  }
  return parts.join('; ');
}

export function storeResponseCookies(response: AxiosResponse): void {
  const setCookieHeaders = response.headers['set-cookie'];
  if (!setCookieHeaders) return;

  const saved = store.getApiCookies();
  for (const raw of setCookieHeaders) {
    const pair = raw.split(';')[0]; // "name=value"
    const eqIdx = pair.indexOf('=');
    if (eqIdx > 0) {
      const name = pair.substring(0, eqIdx).trim();
      const value = pair.substring(eqIdx + 1).trim();
      saved[name] = value;
    }
  }
  store.saveApiCookies(saved);
  console.log('[Main] Stored API cookies:', Object.keys(saved).join(', '));
}

function sendRetryProgress(attempt: number, maxAttempts: number): void {
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('fetch-retry', { attempt, maxAttempts });
  }
}

export async function fetchUsageData(): Promise<UsageData> {
  const organizationId = store.getOrganizationId();
  const initialSessionKey = store.getSessionKey();

  console.log('[Main] Credentials:', {
    hasSessionKey: !!initialSessionKey,
    organizationId,
  });

  if (!initialSessionKey || !organizationId) {
    throw new Error('MissingCredentials');
  }

  const url = USAGE_API_TEMPLATE.replace('{orgId}', organizationId);

  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= API_RETRIES; attempt++) {
    const sessionKey = store.getSessionKey();
    if (!sessionKey) throw new Error('SessionExpired');

    console.log(`[Main] API request to: ${url} (attempt ${attempt}/${API_RETRIES})`);
    try {
      const response: AxiosResponse<UsageData> = await axios.get(url, {
        headers: {
          'Cookie': buildCookieHeader(sessionKey),
          'User-Agent': USER_AGENT,
        },
      });
      storeResponseCookies(response);
      console.log('[Main] API request successful, status:', response.status);
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: AxiosResponse; message: string };
      lastError = error as Error;
      const status = axiosError.response?.status;
      console.error(`[Main] API request failed (attempt ${attempt}/${API_RETRIES}):`, axiosError.message);

      if (axiosError.response) storeResponseCookies(axiosError.response);

      if (status === 401) {
        throw new Error('SessionExpired');
      }

      if (status === 403 && attempt < API_RETRIES) {
        sendRetryProgress(attempt, API_RETRIES);
        await new Promise(r => setTimeout(r, API_RETRY_DELAY_MS));
        continue;
      }

      if (status === 403) {
        throw new Error('SessionExpired');
      }

      throw error;
    }
  }
  throw lastError;
}
