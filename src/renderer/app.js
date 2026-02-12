// Application state
let credentials = null;
let updateInterval = null;
let countdownInterval = null;
let latestUsageData = null;
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

// DOM elements
const elements = {
    widgetContainer: document.getElementById('widgetContainer'),
    loadingContainer: document.getElementById('loadingContainer'),
    loginContainer: document.getElementById('loginContainer'),
    noUsageContainer: document.getElementById('noUsageContainer'),
    autoLoginContainer: document.getElementById('autoLoginContainer'),
    mainContent: document.getElementById('mainContent'),
    loginBtn: document.getElementById('loginBtn'),

    // Session (five_hour)
    sessionPercentage: document.getElementById('sessionPercentage'),
    sessionProgress: document.getElementById('sessionProgress'),
    sessionResetText: document.getElementById('sessionResetText'),

    // Weekly (seven_day)
    weeklyPercentage: document.getElementById('weeklyPercentage'),
    weeklyProgress: document.getElementById('weeklyProgress'),
    weeklyResetText: document.getElementById('weeklyResetText'),

    // Sonnet (seven_day_sonnet)
    sonnetRow: document.getElementById('sonnetRow'),
    sonnetPercentage: document.getElementById('sonnetPercentage'),
    sonnetProgress: document.getElementById('sonnetProgress'),
    sonnetResetText: document.getElementById('sonnetResetText'),

    // Footer
    lastUpdate: document.getElementById('lastUpdate'),
    footerRefreshBtn: document.getElementById('footerRefreshBtn'),

    // Opacity
    opacitySlider: document.getElementById('opacitySlider'),

    // Settings
    settingsBtn: document.getElementById('settingsBtn'),
    settingsOverlay: document.getElementById('settingsOverlay'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    coffeeBtn: document.getElementById('coffeeBtn')
};

// Initialize
async function init() {
    setupEventListeners();
    loadOpacity();
    credentials = await window.electronAPI.getCredentials();

    if (credentials.sessionKey && credentials.organizationId) {
        showMainContent();
        await fetchUsageData();
        startAutoUpdate();
    } else {
        showLoginRequired();
    }
}

// Event Listeners
function setupEventListeners() {
    elements.loginBtn.addEventListener('click', () => {
        window.electronAPI.openLogin();
    });

    elements.footerRefreshBtn.addEventListener('click', () => doRefresh());

    // Opacity slider
    elements.opacitySlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        applyOpacity(value);
        window.electronAPI.saveOpacity(value);
    });

    // Settings
    elements.settingsBtn.addEventListener('click', () => {
        elements.settingsOverlay.style.display = 'flex';
    });

    elements.closeSettingsBtn.addEventListener('click', () => {
        elements.settingsOverlay.style.display = 'none';
    });

    elements.logoutBtn.addEventListener('click', async () => {
        await window.electronAPI.deleteCredentials();
        elements.settingsOverlay.style.display = 'none';
        showLoginRequired();
        window.electronAPI.openLogin();
    });

    elements.coffeeBtn.addEventListener('click', () => {
        window.electronAPI.openExternal('https://paypal.me/SlavomirDurej?country.x=GB&locale.x=en_GB');
    });

    // Listen for login success
    window.electronAPI.onLoginSuccess(async (data) => {
        credentials = data;
        await window.electronAPI.saveCredentials(data);
        showMainContent();
        await fetchUsageData();
        startAutoUpdate();
    });

    // Listen for refresh requests from tray
    window.electronAPI.onRefreshUsage(async () => {
        await fetchUsageData();
    });

    // Listen for session expiration events
    window.electronAPI.onSessionExpired(() => {
        credentials = { sessionKey: null, organizationId: null };
        showLoginRequired();
    });

    // Listen for silent login attempts
    window.electronAPI.onSilentLoginStarted(() => {
        showAutoLoginAttempt();
    });

    window.electronAPI.onSilentLoginFailed(() => {
        showLoginRequired();
    });
}

// Opacity management
async function loadOpacity() {
    try {
        const saved = await window.electronAPI.getOpacity();
        const value = saved || 90;
        elements.opacitySlider.value = value;
        applyOpacity(value);
    } catch {
        applyOpacity(90);
    }
}

function applyOpacity(value) {
    elements.widgetContainer.style.opacity = value / 100;
}

// Manual refresh (footer button)
async function doRefresh() {
    elements.footerRefreshBtn.classList.add('spinning');
    await fetchUsageData();
    elements.footerRefreshBtn.classList.remove('spinning');
}

// Fetch usage data from Claude API
async function fetchUsageData() {
    if (!credentials.sessionKey || !credentials.organizationId) {
        showLoginRequired();
        return;
    }

    try {
        const data = await window.electronAPI.fetchUsageData();
        updateUI(data);
    } catch (error) {
        console.error('Error fetching usage data:', error);
        if (error.message.includes('SessionExpired') || error.message.includes('Unauthorized')) {
            credentials = { sessionKey: null, organizationId: null };
            showAutoLoginAttempt();
        } else {
            showError('Failed to fetch usage data');
        }
    }
}

// Check if there's no usage data
function hasNoUsage(data) {
    const sessionUtil = data.five_hour?.utilization || 0;
    const sessionReset = data.five_hour?.resets_at;
    const weeklyUtil = data.seven_day?.utilization || 0;
    const weeklyReset = data.seven_day?.resets_at;
    const sonnetUtil = data.seven_day_sonnet?.utilization || 0;
    const sonnetReset = data.seven_day_sonnet?.resets_at;

    return sessionUtil === 0 && !sessionReset &&
        weeklyUtil === 0 && !weeklyReset &&
        sonnetUtil === 0 && !sonnetReset;
}

// Update UI with usage data
function updateUI(data) {
    latestUsageData = data;

    if (hasNoUsage(data)) {
        showNoUsage();
        return;
    }

    showMainContent();
    refreshTimers();
    startCountdown();
    updateLastUpdated();
}

// Track if we've already triggered a refresh for expired timers
let sessionResetTriggered = false;
let weeklyResetTriggered = false;

function refreshTimers() {
    if (!latestUsageData) return;

    // Session (five_hour)
    const sessionUtil = latestUsageData.five_hour?.utilization || 0;
    const sessionResetsAt = latestUsageData.five_hour?.resets_at;

    if (sessionResetsAt) {
        const diff = new Date(sessionResetsAt) - new Date();
        if (diff <= 0 && !sessionResetTriggered) {
            sessionResetTriggered = true;
            setTimeout(() => fetchUsageData(), 3000);
        } else if (diff > 0) {
            sessionResetTriggered = false;
        }
    }

    updateProgressBar(elements.sessionProgress, elements.sessionPercentage, sessionUtil);
    updateResetText(elements.sessionResetText, sessionResetsAt, 5 * 60);

    // Weekly (seven_day)
    const weeklyUtil = latestUsageData.seven_day?.utilization || 0;
    const weeklyResetsAt = latestUsageData.seven_day?.resets_at;

    if (weeklyResetsAt) {
        const diff = new Date(weeklyResetsAt) - new Date();
        if (diff <= 0 && !weeklyResetTriggered) {
            weeklyResetTriggered = true;
            setTimeout(() => fetchUsageData(), 3000);
        } else if (diff > 0) {
            weeklyResetTriggered = false;
        }
    }

    updateProgressBar(elements.weeklyProgress, elements.weeklyPercentage, weeklyUtil);
    updateResetText(elements.weeklyResetText, weeklyResetsAt, 7 * 24 * 60);

    // Sonnet (seven_day_sonnet) — show row only if data exists
    const sonnetData = latestUsageData.seven_day_sonnet;
    if (sonnetData && (sonnetData.utilization > 0 || sonnetData.resets_at)) {
        elements.sonnetRow.style.display = 'block';
        const sonnetUtil = sonnetData.utilization || 0;
        updateProgressBar(elements.sonnetProgress, elements.sonnetPercentage, sonnetUtil);
        updateResetText(elements.sonnetResetText, sonnetData.resets_at, 7 * 24 * 60);
    } else {
        elements.sonnetRow.style.display = 'none';
    }
}

function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        refreshTimers();
    }, 1000);
}

// Update progress bar
function updateProgressBar(progressElement, percentageElement, value) {
    const percentage = Math.min(Math.max(value, 0), 100);
    progressElement.style.width = `${percentage}%`;
    percentageElement.textContent = `${Math.round(percentage)}% used`;

    // Color coding based on level
    progressElement.classList.remove('warning', 'danger');
    if (percentage >= 90) {
        progressElement.classList.add('danger');
    } else if (percentage >= 75) {
        progressElement.classList.add('warning');
    }
}

// Format reset text like "Resets 2h 15m (Europe/London)"
function updateResetText(textElement, resetsAt, totalMinutes) {
    if (!resetsAt) {
        textElement.textContent = '';
        return;
    }

    const resetDate = new Date(resetsAt);
    const now = new Date();
    const diff = resetDate - now;

    if (diff <= 0) {
        textElement.textContent = 'Resetting...';
        return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    let timeStr;
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        timeStr = `${days}d ${remHours}h`;
    } else if (hours > 0) {
        timeStr = `${hours}h ${minutes}m`;
    } else {
        timeStr = `${minutes}m`;
    }

    // Get timezone name
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

    // Format reset date/time
    const resetTimeStr = resetDate.toLocaleString('en-GB', {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
        hour12: false
    });

    textElement.textContent = `Resets ${timeStr} \u00B7 ${resetTimeStr} (${tz})`;
}

// Update "Updated HH:MM" text
function updateLastUpdated() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    elements.lastUpdate.textContent = `Updated ${h}:${m}`;
}

// UI State Management
function showLoading() {
    elements.loadingContainer.style.display = 'flex';
    elements.loginContainer.style.display = 'none';
    elements.noUsageContainer.style.display = 'none';
    elements.autoLoginContainer.style.display = 'none';
    elements.mainContent.style.display = 'none';
}

function showLoginRequired() {
    elements.loadingContainer.style.display = 'none';
    elements.loginContainer.style.display = 'flex';
    elements.noUsageContainer.style.display = 'none';
    elements.autoLoginContainer.style.display = 'none';
    elements.mainContent.style.display = 'none';
    stopAutoUpdate();
}

function showNoUsage() {
    elements.loadingContainer.style.display = 'none';
    elements.loginContainer.style.display = 'none';
    elements.noUsageContainer.style.display = 'flex';
    elements.autoLoginContainer.style.display = 'none';
    elements.mainContent.style.display = 'none';
}

function showAutoLoginAttempt() {
    elements.loadingContainer.style.display = 'none';
    elements.loginContainer.style.display = 'none';
    elements.noUsageContainer.style.display = 'none';
    elements.autoLoginContainer.style.display = 'flex';
    elements.mainContent.style.display = 'none';
    stopAutoUpdate();
}

function showMainContent() {
    elements.loadingContainer.style.display = 'none';
    elements.loginContainer.style.display = 'none';
    elements.noUsageContainer.style.display = 'none';
    elements.autoLoginContainer.style.display = 'none';
    elements.mainContent.style.display = 'flex';
}

function showError(message) {
    console.error(message);
}

// Auto-update management
function startAutoUpdate() {
    stopAutoUpdate();
    updateInterval = setInterval(() => {
        fetchUsageData();
    }, UPDATE_INTERVAL);
}

function stopAutoUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

// Start the application
init();

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    stopAutoUpdate();
    if (countdownInterval) clearInterval(countdownInterval);
});
