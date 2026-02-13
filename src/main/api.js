const axios = require('axios');
const { USAGE_API_TEMPLATE, USER_AGENT } = require('./constants');
const store = require('./store');
const { getMainWindow } = require('./window');

const API_RETRIES = 5;
const API_RETRY_DELAY_MS = 3000;

function buildCookieHeader(sessionKey) {
  const extra = store.getApiCookies();
  const parts = [`sessionKey=${sessionKey}`];
  for (const [name, value] of Object.entries(extra)) {
    if (name !== 'sessionKey') {
      parts.push(`${name}=${value}`);
    }
  }
  return parts.join('; ');
}

function storeResponseCookies(response) {
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

function sendRetryProgress(attempt, maxAttempts) {
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('fetch-retry', { attempt, maxAttempts });
  }
}

async function fetchUsageData() {
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

  let lastError;
  for (let attempt = 1; attempt <= API_RETRIES; attempt++) {
    // Re-read session key each attempt (may have been refreshed by silent login)
    const sessionKey = store.getSessionKey();
    if (!sessionKey) throw new Error('SessionExpired');

    console.log(`[Main] API request to: ${url} (attempt ${attempt}/${API_RETRIES})`);
    try {
      const response = await axios.get(url, {
        headers: {
          'Cookie': buildCookieHeader(sessionKey),
          'User-Agent': USER_AGENT,
        },
      });
      storeResponseCookies(response);
      console.log('[Main] API request successful, status:', response.status);
      return response.data;
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      console.error(`[Main] API request failed (attempt ${attempt}/${API_RETRIES}):`, error.message);

      // Still capture cookies from error responses (e.g. cf_clearance on 403)
      if (error.response) storeResponseCookies(error.response);

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

module.exports = { fetchUsageData, buildCookieHeader, storeResponseCookies };
