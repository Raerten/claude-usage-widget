export interface TrayHandlers {
  onShow: () => void;
  onRefresh: () => void;
  onShowLogs: () => void;
  onReLogin: () => void;
  onLogout: () => void;
  onToggle: () => void;
  onSwitchOrg: (orgId: string) => void;
  onToggleAutostart: (enabled: boolean) => void;
}
