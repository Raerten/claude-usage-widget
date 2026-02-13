import { Tray, Menu, app, MenuItemConstructorOptions } from 'electron';
import { join } from 'path';
import * as store from './store';
import type { TrayHandlers } from '../types/tray';

let tray: Tray | null = null;
let handlers: TrayHandlers | null = null;

function buildContextMenu(): Electron.Menu {
  if (!handlers) throw new Error('Tray handlers not initialized');

  const orgs = store.getOrganizations();
  const selectedOrgId = store.getOrganizationId();

  const orgMenuItems: MenuItemConstructorOptions[] = orgs.length > 1
    ? [
        { type: 'separator' as const },
        { label: 'Organizations', enabled: false },
        ...orgs.map(org => ({
          label: org.name,
          type: 'radio' as const,
          checked: org.id === selectedOrgId,
          click: () => handlers!.onSwitchOrg(org.id),
        })),
      ]
    : [];

  return Menu.buildFromTemplate([
    { label: 'Show Widget', click: handlers.onShow },
    { label: 'Refresh', click: handlers.onRefresh },
    { label: 'Show Logs', click: handlers.onShowLogs },
    { label: 'Launch on Startup', type: 'checkbox', checked: store.getAutostart(), click: (menuItem) => handlers!.onToggleAutostart(menuItem.checked) },
    ...orgMenuItems,
    { type: 'separator' },
    { label: 'Re-login', click: handlers.onReLogin },
    { label: 'Log Out', click: handlers.onLogout },
    { type: 'separator' },
    { label: 'Exit', click: () => app.quit() },
  ]);
}

export function createTray(h: TrayHandlers): void {
  handlers = h;

  try {
    tray = new Tray(join(app.getAppPath(), 'assets', 'tray-icon.png'));
    tray.setToolTip('Claude Usage Widget');
    tray.setContextMenu(buildContextMenu());
    tray.on('click', handlers.onToggle);
  } catch (error) {
    console.error('Failed to create tray:', error);
  }
}

export function refreshTrayMenu(): void {
  if (tray) {
    tray.setContextMenu(buildContextMenu());
  }
}
