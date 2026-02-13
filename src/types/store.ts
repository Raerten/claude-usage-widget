export interface Organization {
  id: string;
  name: string;
}

export interface WindowPosition {
  x: number;
  y: number;
}

export interface Credentials {
  sessionKey: string | undefined;
  organizationId: string | undefined;
}

export interface StoreSchema {
  sessionKey: string;
  selectedOrganizationId: string;
  organizations: Organization[];
  windowPosition: WindowPosition;
  widgetOpacity: number;
  apiCookies: Record<string, string>;
  logWindowPosition: WindowPosition;
  widgetCollapsed: boolean;
  autostart: boolean;
}
