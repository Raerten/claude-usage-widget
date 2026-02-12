module.exports = {
  CLAUDE_BASE_URL: 'https://claude.ai',
  ORGANIZATIONS_API: 'https://claude.ai/api/organizations',
  USAGE_API_TEMPLATE: 'https://claude.ai/api/organizations/{orgId}/usage',

  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',

  WIDGET_WIDTH: 480,
  WIDGET_HEIGHT: 140,
  LOGIN_WINDOW_WIDTH: 800,
  LOGIN_WINDOW_HEIGHT: 700,

  VISIBLE_LOGIN_POLL_MS: 2000,
  SILENT_LOGIN_POLL_MS: 1000,
  SILENT_LOGIN_TIMEOUT_MS: 15000,

  // Which organization to pick from the API response array
  ORG_INDEX: 0,
};
