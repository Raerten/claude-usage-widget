const Store = require('electron-store');

const store = new Store({
  // encryptionKey: 'claude-widget-secure-key-2024'
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
  },

  getWindowPosition: () => store.get('windowPosition'),
  saveWindowPosition: (x, y) => store.set('windowPosition', { x, y }),

  getOpacity: () => store.get('widgetOpacity', 90),
  saveOpacity: (value) => store.set('widgetOpacity', value),
};
