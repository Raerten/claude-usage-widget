import type { UsageData } from '../types/usage';
import type { Organization, Credentials } from '../types/store';
import type { LoginSuccessData } from '../types/ipc';
import '../types/electron-api.d.ts';

// Application state
let credentials: Credentials | null = null;
let organizations: Organization[] = [];
let updateInterval: ReturnType<typeof setInterval> | null = null;
let countdownInterval: ReturnType<typeof setInterval> | null = null;
let latestUsageData: UsageData | null = null;
let isCollapsed = false;
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Manual window drag (replaces -webkit-app-region: drag so clicks work)
let isDragging = false;
let dragStartScreen: { x: number; y: number } | null = null;
let dragStartWinPos: { x: number; y: number } | null = null;
const DRAG_THRESHOLD = 4;

function setupManualDrag(el: HTMLElement, onClick?: (e: MouseEvent) => void): void {
    el.addEventListener('mousedown', async (e: MouseEvent) => {
        // Ignore if clicking interactive children
        if ((e.target as HTMLElement).closest('button, input, select, .org-switcher, .top-controls, .collapsed-refresh-btn')) return;
        if (e.button !== 0) return;

        dragStartScreen = { x: e.screenX, y: e.screenY };
        isDragging = false;
        const bounds = await window.electronAPI.getWindowPosition();
        if (bounds) dragStartWinPos = { x: bounds.x, y: bounds.y };
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
        if (!dragStartScreen || !dragStartWinPos) return;
        const dx = e.screenX - dragStartScreen.x;
        const dy = e.screenY - dragStartScreen.y;
        if (!isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
            isDragging = true;
        }
        if (isDragging) {
            window.electronAPI.setWindowPosition({
                x: dragStartWinPos.x + dx,
                y: dragStartWinPos.y + dy
            });
        }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
        if (!dragStartScreen) return;
        if (!isDragging && onClick) {
            onClick(e);
        }
        dragStartScreen = null;
        dragStartWinPos = null;
        isDragging = false;
    });
}

// DOM elements
const elements = {
    widgetContainer: document.getElementById('widgetContainer') as HTMLDivElement,
    loadingContainer: document.getElementById('loadingContainer') as HTMLDivElement,
    loginContainer: document.getElementById('loginContainer') as HTMLDivElement,
    noUsageContainer: document.getElementById('noUsageContainer') as HTMLDivElement,
    autoLoginContainer: document.getElementById('autoLoginContainer') as HTMLDivElement,
    mainContent: document.getElementById('mainContent') as HTMLDivElement,
    loginBtn: document.getElementById('loginBtn') as HTMLButtonElement,

    // Org switcher
    orgSwitcher: document.getElementById('orgSwitcher') as HTMLDivElement,
    orgCurrentBtn: document.getElementById('orgCurrentBtn') as HTMLButtonElement,
    orgName: document.getElementById('orgName') as HTMLSpanElement,
    orgDropdown: document.getElementById('orgDropdown') as HTMLDivElement,

    // Session (five_hour)
    sessionPercentage: document.getElementById('sessionPercentage') as HTMLSpanElement,
    sessionProgress: document.getElementById('sessionProgress') as HTMLDivElement,
    sessionResetText: document.getElementById('sessionResetText') as HTMLSpanElement,

    // Weekly (seven_day)
    weeklyPercentage: document.getElementById('weeklyPercentage') as HTMLSpanElement,
    weeklyProgress: document.getElementById('weeklyProgress') as HTMLDivElement,
    weeklyResetText: document.getElementById('weeklyResetText') as HTMLSpanElement,

    // Sonnet (seven_day_sonnet)
    sonnetRow: document.getElementById('sonnetRow') as HTMLDivElement,
    sonnetPercentage: document.getElementById('sonnetPercentage') as HTMLSpanElement,
    sonnetProgress: document.getElementById('sonnetProgress') as HTMLDivElement,
    sonnetResetText: document.getElementById('sonnetResetText') as HTMLSpanElement,

    // Status indicators
    statusDot: document.getElementById('statusDot') as HTMLDivElement,
    updatedDot: document.querySelector('.updated-dot') as HTMLElement | null,

    // Footer
    lastUpdate: document.getElementById('lastUpdate') as HTMLSpanElement,
    footerRefreshBtn: document.getElementById('footerRefreshBtn') as HTMLButtonElement,

    // Collapsed bar
    collapsedBar: document.getElementById('collapsedBar') as HTMLDivElement,
    collapsedProgress: document.getElementById('collapsedProgress') as HTMLDivElement,
    collapsedPercent: document.getElementById('collapsedPercent') as HTMLSpanElement,
    collapsedReset: document.getElementById('collapsedReset') as HTMLSpanElement,
    collapsedRefreshBtn: document.getElementById('collapsedRefreshBtn') as HTMLButtonElement,

    // Opacity
    opacitySlider: document.getElementById('opacitySlider') as HTMLInputElement,

    // Log window
    logBtn: document.getElementById('logBtn') as HTMLButtonElement,
};

// Initialize
async function init(): Promise<void> {
    setupEventListeners();
    loadOpacity();
    credentials = await window.electronAPI.getCredentials();
    organizations = await window.electronAPI.getOrganizations();

    if (credentials.sessionKey && credentials.organizationId) {
        const savedCollapsed = await window.electronAPI.getCollapsed();
        renderOrgSwitcher();
        if (savedCollapsed) {
            showCollapsed();
        } else {
            showMainContent();
        }
        elements.footerRefreshBtn.classList.add('spinning');
        await fetchUsageData();
        elements.footerRefreshBtn.classList.remove('spinning');
        startAutoUpdate();
    } else {
        showLoginRequired();
    }
}

// Event Listeners
function setupEventListeners(): void {
    elements.loginBtn.addEventListener('click', () => {
        window.electronAPI.openLogin();
    });

    elements.logBtn.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        window.electronAPI.openLogWindow();
    });

    elements.footerRefreshBtn.addEventListener('click', () => doRefresh());

    // Opacity slider
    elements.opacitySlider.addEventListener('input', (e: Event) => {
        const value = parseInt((e.target as HTMLInputElement).value, 10);
        applyOpacity(value);
        window.electronAPI.saveOpacity(value);
    });

    // Manual drag + collapse/expand on click (for both header and collapsed bar)
    setupManualDrag(elements.widgetContainer, (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const inHeader = target.closest('.drag-handle');
        const inCollapsed = target.closest('.collapsed-bar');
        if (!inHeader && !inCollapsed) return;
        if (target.closest('button, input, select, .org-switcher, .top-controls, .collapsed-refresh-btn')) return;
        // Only toggle when main content is showing or already collapsed
        if (elements.mainContent.style.display === 'none' && !isCollapsed) return;
        toggleCollapse();
    });

    // Collapsed refresh button
    elements.collapsedRefreshBtn.addEventListener('click', () => doCollapsedRefresh());

    // Org switcher toggle
    elements.orgCurrentBtn.addEventListener('click', () => {
        if (organizations.length > 1) {
            elements.orgSwitcher.classList.toggle('open');
        }
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e: Event) => {
        if (!elements.orgSwitcher.contains(e.target as Node)) {
            elements.orgSwitcher.classList.remove('open');
        }
    });

    // Listen for logout from tray
    window.electronAPI.onLogout(() => {
        credentials = { sessionKey: undefined, organizationId: undefined };
        organizations = [];
        showLoginRequired();
    });

    // Listen for login success
    window.electronAPI.onLoginSuccess(async (data: LoginSuccessData) => {
        credentials = { sessionKey: data.sessionKey, organizationId: data.organizationId };
        organizations = data.organizations || [];
        await window.electronAPI.saveCredentials({
            sessionKey: data.sessionKey,
            organizationId: data.organizationId,
        });
        const savedCollapsed = await window.electronAPI.getCollapsed();
        renderOrgSwitcher();
        if (savedCollapsed) {
            showCollapsed();
        } else {
            showMainContent();
        }
        await fetchUsageData();
        startAutoUpdate();
    });

    // Listen for refresh requests from tray
    window.electronAPI.onRefreshUsage(async () => {
        await fetchUsageData();
    });

    // Listen for session expiration events
    window.electronAPI.onSessionExpired(() => {
        credentials = { sessionKey: undefined, organizationId: undefined };
        showLoginRequired();
    });

    // Listen for silent login attempts
    window.electronAPI.onSilentLoginStarted(() => {
        showAutoLoginAttempt();
    });

    window.electronAPI.onSilentLoginFailed(() => {
        showLoginRequired();
    });

    // Listen for API retry progress from main process
    window.electronAPI.onFetchRetry(() => {
        totalAttempts++;
        showRetryStatus();
    });

    // Listen for org switch from tray
    window.electronAPI.onOrgSwitched(async (orgId: string) => {
        // Stop auto-update FIRST to prevent stale fetches for the old org
        stopAutoUpdate();
        latestUsageData = null;
        retryCount = 0;
        totalAttempts = 0;
        if (credentials) credentials.organizationId = orgId;
        renderOrgSwitcher();
        showSwitchingStatus('Switching...');
        await fetchUsageData({ skipRelogin: true });
        startAutoUpdate();
    });
}

// Org switcher
function renderOrgSwitcher(): void {
    if (!organizations || organizations.length === 0) {
        elements.orgSwitcher.style.display = 'none';
        return;
    }

    elements.orgSwitcher.style.display = 'block';

    // Set current org name
    const current = organizations.find(o => o.id === credentials?.organizationId);
    elements.orgName.textContent = current ? current.name : '\u2014';

    if (organizations.length <= 1) {
        // Single org — show name but hide chevron, no dropdown
        elements.orgCurrentBtn.style.cursor = 'default';
        const chevron = elements.orgCurrentBtn.querySelector('.org-chevron') as HTMLElement | null;
        if (chevron) chevron.style.display = 'none';
        return;
    }

    elements.orgCurrentBtn.style.cursor = 'pointer';
    const chevron = elements.orgCurrentBtn.querySelector('.org-chevron') as HTMLElement | null;
    if (chevron) chevron.style.display = '';

    // Build dropdown options
    elements.orgDropdown.innerHTML = '';
    for (const org of organizations) {
        const btn = document.createElement('button');
        btn.className = 'org-option' + (org.id === credentials?.organizationId ? ' active' : '');
        btn.textContent = org.name;
        btn.addEventListener('click', () => switchOrg(org.id));
        elements.orgDropdown.appendChild(btn);
    }
}

async function switchOrg(orgId: string): Promise<void> {
    if (orgId === credentials?.organizationId) {
        elements.orgSwitcher.classList.remove('open');
        return;
    }

    // Stop auto-update FIRST to prevent stale fetches for the old org
    stopAutoUpdate();
    latestUsageData = null;
    retryCount = 0;
    totalAttempts = 0;

    if (credentials) credentials.organizationId = orgId;
    elements.orgSwitcher.classList.remove('open');
    renderOrgSwitcher();
    showSwitchingStatus('Switching...');

    await window.electronAPI.setSelectedOrg(orgId);
    await fetchUsageData({ skipRelogin: true });
    startAutoUpdate();
}

// Collapse/expand
const COLLAPSED_HEIGHT = 39;

function showCollapsed(): void {
    isCollapsed = true;
    (document.getElementById('dragHandle') as HTMLElement).style.display = 'none';
    elements.loadingContainer.style.display = 'none';
    elements.loginContainer.style.display = 'none';
    elements.noUsageContainer.style.display = 'none';
    elements.autoLoginContainer.style.display = 'none';
    elements.mainContent.style.display = 'none';
    elements.collapsedBar.style.display = 'flex';
    elements.widgetContainer.style.border = 'none';
    window.electronAPI.resizeToContent(COLLAPSED_HEIGHT);
}

function toggleCollapse(): void {
    const willCollapse = !isCollapsed;
    window.electronAPI.saveCollapsed(willCollapse);
    if (willCollapse) {
        showCollapsed();
        updateCollapsedBar();
    } else {
        isCollapsed = false;
        (document.getElementById('dragHandle') as HTMLElement).style.display = '';
        elements.collapsedBar.style.display = 'none';
        elements.mainContent.style.display = 'flex';
        elements.widgetContainer.style.border = '';
        renderOrgSwitcher();
        fitWindow();
    }
}

function updateCollapsedBar(): void {
    if (!latestUsageData) return;
    const sessionUtil = latestUsageData.five_hour?.utilization || 0;
    const pct = Math.min(Math.max(sessionUtil, 0), 100);

    elements.collapsedProgress.style.width = `${pct}%`;
    if (pct > 0) {
        elements.collapsedProgress.style.setProperty('--gradient-size', `${(100 / pct) * 100}%`);
    }

    elements.collapsedPercent.textContent = `${Math.round(pct)}%`;

    // Short reset time
    const resetsAt = latestUsageData.five_hour?.resets_at;
    if (resetsAt) {
        const diff = new Date(resetsAt).getTime() - new Date().getTime();
        if (diff <= 0) {
            elements.collapsedReset.textContent = 'resetting...';
        } else {
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            elements.collapsedReset.textContent = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }
    } else {
        elements.collapsedReset.textContent = '';
    }
}

async function doCollapsedRefresh(): Promise<void> {
    if (!credentials?.sessionKey || !credentials?.organizationId) return;
    elements.collapsedRefreshBtn.classList.add('spinning');
    try {
        const data = await window.electronAPI.fetchUsageData();
        updateUI(data);
    } catch (error) {
        console.error('Refresh failed:', error);
    }
    elements.collapsedRefreshBtn.classList.remove('spinning');
}

// Opacity management
async function loadOpacity(): Promise<void> {
    try {
        const saved = await window.electronAPI.getOpacity();
        const value = saved || 90;
        elements.opacitySlider.value = String(value);
        applyOpacity(value);
    } catch {
        applyOpacity(90);
    }
}

function applyOpacity(_value: number): void {
    // Opacity is applied to the Electron window via IPC, not CSS
}

// Manual refresh (footer button) — just re-fetch, don't trigger login flow on error
async function doRefresh(): Promise<void> {
    if (!credentials?.sessionKey || !credentials?.organizationId) return;

    elements.footerRefreshBtn.classList.add('spinning');
    try {
        const data = await window.electronAPI.fetchUsageData();
        updateUI(data);
    } catch (error) {
        console.error('Refresh failed:', error);
    }
    elements.footerRefreshBtn.classList.remove('spinning');
}

// Switching/retrying status indicator
let pendingRetryTimeout: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;       // renderer-level retry rounds
let totalAttempts = 0;    // total failed attempts across all layers
let isSwitching = false;  // true while org-switch retry flow is active

function showSwitchingStatus(text?: string): void {
    isSwitching = true;
    elements.statusDot.classList.add('switching');
    if (elements.updatedDot) elements.updatedDot.classList.add('switching');
    elements.lastUpdate.textContent = text || 'Switching...';
    elements.footerRefreshBtn.classList.add('spinning');
}

function showRetryStatus(): void {
    if (!isSwitching) return; // ignore stale retry events after switching ended
    showSwitchingStatus(`Retrying (${totalAttempts})...`);
}

function clearSwitchingStatus(): void {
    isSwitching = false;
    elements.statusDot.classList.remove('switching');
    if (elements.updatedDot) elements.updatedDot.classList.remove('switching');
    elements.footerRefreshBtn.classList.remove('spinning');
    retryCount = 0;
    totalAttempts = 0;
    updateLastUpdated();
}

// Fetch usage data from Claude API
interface FetchOpts {
    skipRelogin?: boolean;
}

async function fetchUsageData(opts: FetchOpts = {}): Promise<void> {
    if (!credentials?.sessionKey || !credentials?.organizationId) {
        showLoginRequired();
        return;
    }

    // Clear any pending retry when a new fetch starts
    if (pendingRetryTimeout) {
        clearTimeout(pendingRetryTimeout);
        pendingRetryTimeout = null;
    }

    if (opts.skipRelogin && retryCount === 0) {
        showSwitchingStatus('Switching...');
    }

    try {
        const data = await window.electronAPI.fetchUsageData();
        clearSwitchingStatus();
        updateUI(data);
    } catch (error: unknown) {
        console.error('Error fetching usage data:', error);
        const errorMessage = (error as Error).message || '';
        if (errorMessage.includes('SessionExpired') || errorMessage.includes('Unauthorized')) {
            if (opts.skipRelogin) {
                // Org switch 403 — API retries exhausted but session is likely fine.
                retryCount++;
                totalAttempts++;
                showRetryStatus();
                console.log(`Org switch fetch failed, round #${retryCount}, total attempts: ${totalAttempts}`);
                pendingRetryTimeout = setTimeout(() => fetchUsageData(
                    retryCount < 3 ? { skipRelogin: true } : {}
                ), 5000);
                return;
            }
            clearSwitchingStatus();
            showAutoLoginAttempt();
            window.electronAPI.attemptSilentLogin();
        } else {
            clearSwitchingStatus();
            showError('Failed to fetch usage data');
        }
    }
}

// Check if there's no usage data
function hasNoUsage(data: UsageData): boolean {
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
function updateUI(data: UsageData): void {
    latestUsageData = data;

    if (hasNoUsage(data)) {
        showNoUsage();
        return;
    }

    if (isCollapsed) {
        // Stay collapsed, just update data
        updateCollapsedBar();
    } else {
        showMainContent();
    }
    refreshTimers();
    startCountdown();
    updateLastUpdated();
    fitWindow();
}

// Track if we've already triggered a refresh for expired timers
let sessionResetTriggered = false;
let weeklyResetTriggered = false;

function refreshTimers(): void {
    if (!latestUsageData) return;

    // Update collapsed bar if collapsed
    if (isCollapsed) updateCollapsedBar();

    // Session (five_hour)
    const sessionUtil = latestUsageData.five_hour?.utilization || 0;
    const sessionResetsAt = latestUsageData.five_hour?.resets_at;

    if (sessionResetsAt) {
        const diff = new Date(sessionResetsAt).getTime() - new Date().getTime();
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
        const diff = new Date(weeklyResetsAt).getTime() - new Date().getTime();
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

function startCountdown(): void {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        refreshTimers();
    }, 1000);
}

// Update progress bar
function updateProgressBar(progressElement: HTMLElement, percentageElement: HTMLElement, value: number): void {
    const percentage = Math.min(Math.max(value, 0), 100);
    progressElement.style.width = `${percentage}%`;
    percentageElement.textContent = `${Math.round(percentage)}% used`;

    // Scale gradient so it spans the full track width
    if (percentage > 0) {
        progressElement.style.setProperty('--gradient-size', `${(100 / percentage) * 100}%`);
    }
}

// Format reset text like "Resets 2h 15m (Europe/London)"
function updateResetText(textElement: HTMLElement, resetsAt: string | null | undefined, _totalMinutes: number): void {
    if (!resetsAt) {
        textElement.textContent = '';
        return;
    }

    const resetDate = new Date(resetsAt);
    const now = new Date();
    const diff = resetDate.getTime() - now.getTime();

    if (diff <= 0) {
        textElement.textContent = 'Resetting...';
        return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    let timeStr: string;
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
function updateLastUpdated(): void {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    elements.lastUpdate.textContent = `Updated ${h}:${m}`;
}

// Resize window to fit content
function fitWindow(): void {
    // Double rAF ensures DOM reflow is fully complete before measuring
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const container = document.getElementById('widgetContainer');
            if (container) {
                const height = container.getBoundingClientRect().height;
                window.electronAPI.resizeToContent(Math.ceil(height));
            }
        });
    });
}

// UI State Management
function showLoginRequired(): void {
    isCollapsed = false;
    elements.collapsedBar.style.display = 'none';
    elements.loadingContainer.style.display = 'none';
    elements.loginContainer.style.display = 'flex';
    elements.noUsageContainer.style.display = 'none';
    elements.autoLoginContainer.style.display = 'none';
    elements.mainContent.style.display = 'none';
    elements.orgSwitcher.style.display = 'none';
    stopAutoUpdate();
    fitWindow();
}

function showNoUsage(): void {
    isCollapsed = false;
    elements.collapsedBar.style.display = 'none';
    elements.loadingContainer.style.display = 'none';
    elements.loginContainer.style.display = 'none';
    elements.noUsageContainer.style.display = 'flex';
    elements.autoLoginContainer.style.display = 'none';
    elements.mainContent.style.display = 'none';
    fitWindow();
}

function showAutoLoginAttempt(): void {
    isCollapsed = false;
    elements.collapsedBar.style.display = 'none';
    elements.loadingContainer.style.display = 'none';
    elements.loginContainer.style.display = 'none';
    elements.noUsageContainer.style.display = 'none';
    elements.autoLoginContainer.style.display = 'flex';
    elements.mainContent.style.display = 'none';
    stopAutoUpdate();
    fitWindow();
}

function showMainContent(): void {
    elements.collapsedBar.style.display = 'none';
    elements.loadingContainer.style.display = 'none';
    elements.loginContainer.style.display = 'none';
    elements.noUsageContainer.style.display = 'none';
    elements.autoLoginContainer.style.display = 'none';
    elements.mainContent.style.display = 'flex';
}

function showError(message: string): void {
    console.error(message);
}

// Auto-update management
function startAutoUpdate(): void {
    stopAutoUpdate();
    updateInterval = setInterval(() => {
        fetchUsageData();
    }, UPDATE_INTERVAL);
}

function stopAutoUpdate(): void {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
    if (pendingRetryTimeout) {
        clearTimeout(pendingRetryTimeout);
        pendingRetryTimeout = null;
    }
}

// Start the application
init();

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    stopAutoUpdate();
    if (countdownInterval) clearInterval(countdownInterval);
});
