const Store = require('electron-store');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

function getEncryptionKey() {
  const keyPath = path.join(app.getPath('userData'), '.encryption-key');
  try {
    return fs.readFileSync(keyPath, 'utf8');
  } catch {
    const key = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(path.dirname(keyPath), { recursive: true });
    fs.writeFileSync(keyPath, key, { mode: 0o600 });
    return key;
  }
}

const store = new Store({
  encryptionKey: getEncryptionKey()
});

module.exports = {
  getSessionKey: () => store.get('sessionKey'),

  // Selected org (the one we fetch usage for)
  getOrganizationId: () => store.get('selectedOrganizationId'),
  setSelectedOrganizationId: (orgId) => store.set('selectedOrganizationId', orgId),

  // All orgs from the account
  getOrganizations: () => store.get('organizations', []),
  setOrganizations: (orgs) => store.set('organizations', orgs),

  getCredentials: () => ({
    sessionKey: store.get('sessionKey'),
    organizationId: store.get('selectedOrganizationId'),
  }),

  saveCredentials: (sessionKey, organizations, selectedOrgId) => {
    store.set('sessionKey', sessionKey);
    if (organizations) {
      store.set('organizations', organizations);
    }
    if (selectedOrgId) {
      store.set('selectedOrganizationId', selectedOrgId);
    }
  },

  deleteCredentials: () => {
    store.delete('sessionKey');
    store.delete('selectedOrganizationId');
    store.delete('organizations');
    store.delete('apiCookies');
  },

  getWindowPosition: () => store.get('windowPosition'),
  saveWindowPosition: (x, y) => store.set('windowPosition', { x, y }),

  getOpacity: () => store.get('widgetOpacity', 90),
  saveOpacity: (value) => store.set('widgetOpacity', value),

  getApiCookies: () => store.get('apiCookies', {}),
  saveApiCookies: (cookies) => store.set('apiCookies', cookies),
  clearApiCookies: () => store.delete('apiCookies'),

  getLogWindowPosition: () => store.get('logWindowPosition'),
  saveLogWindowPosition: (x, y) => store.set('logWindowPosition', { x, y }),

  getCollapsed: () => store.get('widgetCollapsed', false),
  saveCollapsed: (value) => store.set('widgetCollapsed', !!value),

  getAutostart: () => store.get('autostart', false),
  saveAutostart: (value) => store.set('autostart', !!value),
};
