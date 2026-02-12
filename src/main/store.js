const Store = require('electron-store');

const store = new Store({
  // encryptionKey: 'claude-widget-secure-key-2024'
});

module.exports = {
  getSessionKey: () => store.get('sessionKey'),
  getOrganizationId: () => store.get('organizationId'),

  getCredentials: () => ({
    sessionKey: store.get('sessionKey'),
    organizationId: store.get('organizationId'),
  }),

  saveCredentials: (sessionKey, organizationId) => {
    store.set('sessionKey', sessionKey);
    if (organizationId) {
      store.set('organizationId', organizationId);
    }
  },

  deleteCredentials: () => {
    store.delete('sessionKey');
    store.delete('organizationId');
  },

  getWindowPosition: () => store.get('windowPosition'),
  saveWindowPosition: (x, y) => store.set('windowPosition', { x, y }),
};
