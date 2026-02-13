const { Tray, Menu, app } = require('electron');
const path = require('path');
const store = require('./store');

let tray = null;
let handlers = null;

function buildContextMenu() {
  const orgs = store.getOrganizations();
  const selectedOrgId = store.getOrganizationId();

  const orgMenuItems = orgs.length > 1
    ? [
        { type: 'separator' },
        { label: 'Organizations', enabled: false },
        ...orgs.map(org => ({
          label: org.name,
          type: 'radio',
          checked: org.id === selectedOrgId,
          click: () => handlers.onSwitchOrg(org.id),
        })),
      ]
    : [];

  return Menu.buildFromTemplate([
    { label: 'Show Widget', click: handlers.onShow },
    { label: 'Refresh', click: handlers.onRefresh },
    { label: 'Show Logs', click: handlers.onShowLogs },
    ...orgMenuItems,
    { type: 'separator' },
    { label: 'Re-login', click: handlers.onReLogin },
    { label: 'Log Out', click: handlers.onLogout },
    { type: 'separator' },
    { label: 'Exit', click: () => app.quit() },
  ]);
}

function createTray(h) {
  handlers = h;

  try {
    tray = new Tray(path.join(__dirname, '../../assets/tray-icon.png'));
    tray.setToolTip('Claude Usage Widget');
    tray.setContextMenu(buildContextMenu());
    tray.on('click', handlers.onToggle);
  } catch (error) {
    console.error('Failed to create tray:', error);
  }
}

function refreshTrayMenu() {
  if (tray) {
    tray.setContextMenu(buildContextMenu());
  }
}

module.exports = { createTray, refreshTrayMenu };
