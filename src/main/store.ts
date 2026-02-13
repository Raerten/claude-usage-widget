import Store from 'electron-store';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import type { StoreSchema, Organization, WindowPosition, Credentials } from '../types/store';

function getEncryptionKey(): string {
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

const store = new Store<StoreSchema>({
  encryptionKey: getEncryptionKey(),
});

export function getSessionKey(): string | undefined {
  return store.get('sessionKey');
}

export function getOrganizationId(): string | undefined {
  return store.get('selectedOrganizationId');
}

export function setSelectedOrganizationId(orgId: string): void {
  store.set('selectedOrganizationId', orgId);
}

export function getOrganizations(): Organization[] {
  return store.get('organizations', []) as Organization[];
}

export function setOrganizations(orgs: Organization[]): void {
  store.set('organizations', orgs);
}

export function getCredentials(): Credentials {
  return {
    sessionKey: store.get('sessionKey'),
    organizationId: store.get('selectedOrganizationId'),
  };
}

export function saveCredentials(
  sessionKey: string,
  organizations: Organization[] | null,
  selectedOrgId: string | null,
): void {
  store.set('sessionKey', sessionKey);
  if (organizations) {
    store.set('organizations', organizations);
  }
  if (selectedOrgId) {
    store.set('selectedOrganizationId', selectedOrgId);
  }
}

export function deleteCredentials(): void {
  store.delete('sessionKey');
  store.delete('selectedOrganizationId');
  store.delete('organizations');
  store.delete('apiCookies');
}

export function getWindowPosition(): WindowPosition | undefined {
  return store.get('windowPosition');
}

export function saveWindowPosition(x: number, y: number): void {
  store.set('windowPosition', { x, y });
}

export function getOpacity(): number {
  return store.get('widgetOpacity', 90) as number;
}

export function saveOpacity(value: number): void {
  store.set('widgetOpacity', value);
}

export function getApiCookies(): Record<string, string> {
  return (store.get('apiCookies', {}) ?? {}) as Record<string, string>;
}

export function saveApiCookies(cookies: Record<string, string>): void {
  store.set('apiCookies', cookies);
}

export function clearApiCookies(): void {
  store.delete('apiCookies');
}

export function getLogWindowPosition(): WindowPosition | undefined {
  return store.get('logWindowPosition');
}

export function saveLogWindowPosition(x: number, y: number): void {
  store.set('logWindowPosition', { x, y });
}

export function getCollapsed(): boolean {
  return store.get('widgetCollapsed', false) as boolean;
}

export function saveCollapsed(value: boolean): void {
  store.set('widgetCollapsed', !!value);
}

export function getAutostart(): boolean {
  return store.get('autostart', false) as boolean;
}

export function saveAutostart(value: boolean): void {
  store.set('autostart', !!value);
}
