const axios = require('axios');
const { USAGE_API_TEMPLATE, USER_AGENT } = require('./constants');
const store = require('./store');

async function fetchUsageData() {
  const sessionKey = store.getSessionKey();
  const organizationId = store.getOrganizationId();

  console.log('[Main] Credentials:', {
    hasSessionKey: !!sessionKey,
    organizationId,
  });

  if (!sessionKey || !organizationId) {
    throw new Error('MissingCredentials');
  }

  const url = USAGE_API_TEMPLATE.replace('{orgId}', organizationId);
  console.log('[Main] Making API request to:', url);

  try {
    const response = await axios.get(url, {
      headers: {
        'Cookie': `sessionKey=${sessionKey}`,
        'User-Agent': USER_AGENT,
      },
    });
    console.log('[Main] API request successful, status:', response.status);
    return response.data;
  } catch (error) {
    console.error('[Main] API request failed:', error.message);
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      throw new Error('SessionExpired');
    }
    throw error;
  }
}

module.exports = { fetchUsageData };
