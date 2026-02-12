const { Tray, Menu, app } = require('electron');
const path = require('path');

let tray = null;

function createTray(handlers) {
  try {
    tray = new Tray(path.join(__dirname, '../../assets/tray-icon.png'));

    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show Widget', click: handlers.onShow },
      { label: 'Refresh', click: handlers.onRefresh },
      { type: 'separator' },
      { label: 'Settings', click: () => { /* TODO */ } },
      { label: 'Re-login', click: handlers.onReLogin },
      { type: 'separator' },
      { label: 'Exit', click: () => app.quit() },
    ]);

    tray.setToolTip('Claude Usage Widget');
    tray.setContextMenu(contextMenu);
    tray.on('click', handlers.onToggle);
  } catch (error) {
    console.error('Failed to create tray:', error);
  }
}

module.exports = { createTray };
