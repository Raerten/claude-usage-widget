import { BrowserWindow, session } from 'electron';
import axios from 'axios';
import {
  CLAUDE_BASE_URL,
  ORGANIZATIONS_API,
  USER_AGENT,
  LOGIN_WINDOW_WIDTH,
  LOGIN_WINDOW_HEIGHT,
  VISIBLE_LOGIN_POLL_MS,
  SILENT_LOGIN_POLL_MS,
  SILENT_LOGIN_TIMEOUT_MS,
} from './constants';
import * as store from './store';
import { getMainWindow } from './window';
import { refreshTrayMenu } from './tray';
import { buildCookieHeader, storeResponseCookies } from './api';
import type { Organization } from '../types/store';

let loginWindow: BrowserWindow | null = null;
let silentLoginWindow: BrowserWindow | null = null;
let silentLoginInProgress = false;

interface LoginState {
  hasLoggedIn: boolean;
}

interface LoginOpts {
  getWindow: () => BrowserWindow | null;
  logPrefix: string;
  onSuccess: () => void;
}

interface Poller {
  clear: () => void;
}

async function checkLoginStatus(state: LoginState, opts: LoginOpts): Promise<void> {
  if (state.hasLoggedIn || !opts.getWindow()) return;

  try {
    const cookies = await session.defaultSession.cookies.get({
      url: CLAUDE_BASE_URL,
      name: 'sessionKey',
    });

    if (cookies.length === 0) return;

    const sessionKey = cookies[0].value;
    console.log(`${opts.logPrefix}Session key found, attempting to get orgs...`);

    let organizations: Organization[] | null = null;
    try {
      const response = await axios.get(ORGANIZATIONS_API, {
        headers: {
          'Cookie': buildCookieHeader(sessionKey),
          'User-Agent': USER_AGENT,
        },
      });
      storeResponseCookies(response);

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        organizations = response.data.map((org: { uuid?: string; id?: string; name?: string }) => ({
          id: org.uuid || org.id || '',
          name: org.name || 'Unnamed',
        }));
        console.log(`${opts.logPrefix}Organizations found:`, organizations!.length,
          organizations!.map((o, i) => `[${i}] ${o.name}: ${o.id}`).join(', '));
      }
    } catch (err: unknown) {
      console.log(`${opts.logPrefix}API not ready yet:`, (err as Error).message);
    }

    if (sessionKey && organizations && organizations.length > 0) {
      state.hasLoggedIn = true;

      const currentSelectedId = store.getOrganizationId();
      const selectedOrgId = organizations.some(o => o.id === currentSelectedId)
        ? currentSelectedId!
        : organizations[0].id;

      console.log(`${opts.logPrefix}Login successful! Selected org: ${selectedOrgId}`);
      store.saveCredentials(sessionKey, organizations, selectedOrgId);
      refreshTrayMenu();

      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('login-success', {
          sessionKey,
          organizationId: selectedOrgId,
          organizations,
        });
      }

      opts.onSuccess();
    }
  } catch (error) {
    console.error(`${opts.logPrefix}Login check error:`, error);
  }
}

function createLoginPoller(state: LoginState, opts: LoginOpts, intervalMs: number): Poller {
  const id = setInterval(async () => {
    if (!state.hasLoggedIn && opts.getWindow()) {
      await checkLoginStatus(state, opts);
    } else {
      clearInterval(id);
    }
  }, intervalMs);

  return { clear: () => clearInterval(id) };
}

function attachNavigationListeners(browserWindow: BrowserWindow, state: LoginState, opts: LoginOpts): void {
  browserWindow.webContents.on('did-finish-load', async () => {
    const url = browserWindow.webContents.getURL();
    console.log(`${opts.logPrefix}Page loaded:`, url);
    if (url.includes('claude.ai')) {
      await checkLoginStatus(state, opts);
    }
  });

  browserWindow.webContents.on('did-navigate', async (_event, url) => {
    console.log(`${opts.logPrefix}Navigated to:`, url);
    if (url.includes('claude.ai')) {
      await checkLoginStatus(state, opts);
    }
  });
}

export function createLoginWindow(): void {
  loginWindow = new BrowserWindow({
    width: LOGIN_WINDOW_WIDTH,
    height: LOGIN_WINDOW_HEIGHT,
    parent: getMainWindow() || undefined,
    modal: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  loginWindow.loadURL(CLAUDE_BASE_URL);

  const state: LoginState = { hasLoggedIn: false };
  const opts: LoginOpts = {
    getWindow: () => loginWindow,
    logPrefix: '',
    onSuccess: () => {
      poller.clear();
      if (loginWindow) loginWindow.close();
    },
  };

  attachNavigationListeners(loginWindow, state, opts);
  const poller = createLoginPoller(state, opts, VISIBLE_LOGIN_POLL_MS);

  loginWindow.on('closed', () => {
    poller.clear();
    loginWindow = null;
  });
}

export async function attemptSilentLogin(): Promise<boolean> {
  if (silentLoginInProgress) {
    console.log('[Main] Silent login already in progress, skipping...');
    return false;
  }

  silentLoginInProgress = true;
  console.log('[Main] Attempting silent login...');

  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('silent-login-started');
  }

  return new Promise((resolve) => {
    silentLoginWindow = new BrowserWindow({
      width: LOGIN_WINDOW_WIDTH,
      height: LOGIN_WINDOW_HEIGHT,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    silentLoginWindow.loadURL(CLAUDE_BASE_URL);

    const state: LoginState = { hasLoggedIn: false };
    const opts: LoginOpts = {
      getWindow: () => silentLoginWindow,
      logPrefix: '[Main] Silent login: ',
      onSuccess: () => {
        silentLoginInProgress = false;
        poller.clear();
        if (silentLoginWindow) silentLoginWindow.close();
        resolve(true);
      },
    };

    attachNavigationListeners(silentLoginWindow, state, opts);
    const poller = createLoginPoller(state, opts, SILENT_LOGIN_POLL_MS);

    const timeoutId = setTimeout(() => {
      if (!state.hasLoggedIn) {
        console.log('[Main] Silent login timeout, falling back to visible login...');
        silentLoginInProgress = false;
        poller.clear();
        if (silentLoginWindow) silentLoginWindow.close();

        const mw = getMainWindow();
        if (mw) mw.webContents.send('silent-login-failed');

        createLoginWindow();
        resolve(false);
      }
    }, SILENT_LOGIN_TIMEOUT_MS);

    silentLoginWindow.on('closed', () => {
      poller.clear();
      clearTimeout(timeoutId);
      silentLoginWindow = null;
    });
  });
}
