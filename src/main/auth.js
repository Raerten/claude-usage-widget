const { BrowserWindow, session } = require('electron');
const path = require('path');
const axios = require('axios');
const {
  CLAUDE_BASE_URL,
  ORGANIZATIONS_API,
  USER_AGENT,
  ORG_INDEX,
  LOGIN_WINDOW_WIDTH,
  LOGIN_WINDOW_HEIGHT,
  VISIBLE_LOGIN_POLL_MS,
  SILENT_LOGIN_POLL_MS,
  SILENT_LOGIN_TIMEOUT_MS,
} = require('./constants');
const store = require('./store');
const { getMainWindow } = require('./window');

let loginWindow = null;
let silentLoginWindow = null;
let silentLoginInProgress = false;

// --- Shared login helpers ---

async function checkLoginStatus(state, opts) {
  if (state.hasLoggedIn || !opts.getWindow()) return;

  try {
    const cookies = await session.defaultSession.cookies.get({
      url: CLAUDE_BASE_URL,
      name: 'sessionKey',
    });

    if (cookies.length === 0) return;

    const sessionKey = cookies[0].value;
    console.log(`${opts.logPrefix}Session key found, attempting to get org ID...`);

    let orgId = null;
    try {
      const response = await axios.get(ORGANIZATIONS_API, {
        headers: {
          'Cookie': `sessionKey=${sessionKey}`,
          'User-Agent': USER_AGENT,
        },
      });

      if (response.data && Array.isArray(response.data)) {
        console.log(`${opts.logPrefix}Organizations found:`, response.data.length,
          response.data.map((o, i) => `[${i}] ${o.name || 'unnamed'}: ${o.uuid || o.id}`).join(', '));

        if (response.data.length > ORG_INDEX) {
          orgId = response.data[ORG_INDEX].uuid || response.data[ORG_INDEX].id;
          console.log(`${opts.logPrefix}Using org [${ORG_INDEX}]:`, orgId);
        } else {
          console.log(`${opts.logPrefix}ORG_INDEX ${ORG_INDEX} out of bounds, only ${response.data.length} orgs`);
        }
      }
    } catch (err) {
      console.log(`${opts.logPrefix}API not ready yet:`, err.message);
    }

    if (sessionKey && orgId) {
      state.hasLoggedIn = true;

      console.log(`${opts.logPrefix}Login successful!`);
      store.saveCredentials(sessionKey, orgId);

      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('login-success', {
          sessionKey,
          organizationId: orgId,
        });
      }

      opts.onSuccess();
    }
  } catch (error) {
    console.error(`${opts.logPrefix}Login check error:`, error);
  }
}

function createLoginPoller(state, opts, intervalMs) {
  const id = setInterval(async () => {
    if (!state.hasLoggedIn && opts.getWindow()) {
      await checkLoginStatus(state, opts);
    } else {
      clearInterval(id);
    }
  }, intervalMs);

  return { clear: () => clearInterval(id) };
}

function attachNavigationListeners(browserWindow, state, opts) {
  browserWindow.webContents.on('did-finish-load', async () => {
    const url = browserWindow.webContents.getURL();
    console.log(`${opts.logPrefix}Page loaded:`, url);
    if (url.includes('claude.ai')) {
      await checkLoginStatus(state, opts);
    }
  });

  browserWindow.webContents.on('did-navigate', async (event, url) => {
    console.log(`${opts.logPrefix}Navigated to:`, url);
    if (url.includes('claude.ai')) {
      await checkLoginStatus(state, opts);
    }
  });
}

// --- Login window (visible) ---

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: LOGIN_WINDOW_WIDTH,
    height: LOGIN_WINDOW_HEIGHT,
    parent: getMainWindow(),
    modal: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  loginWindow.loadURL(CLAUDE_BASE_URL);

  const state = { hasLoggedIn: false };
  const opts = {
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

// --- Silent login (hidden window) ---

async function attemptSilentLogin() {
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

    const state = { hasLoggedIn: false };
    const opts = {
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

module.exports = { createLoginWindow, attemptSilentLogin };
