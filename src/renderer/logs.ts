import type { LogEntry } from '../types/ipc';
import '../types/electron-api.d.ts';

let allLogs: LogEntry[] = [];
let filteredLogs: LogEntry[] = [];
let currentFilter = 'all';
let searchQuery = '';
let autoScroll = true;

const elements = {
  logList: document.getElementById('logList') as HTMLDivElement,
  logCount: document.getElementById('logCount') as HTMLSpanElement,
  filterAll: document.getElementById('filterAll') as HTMLButtonElement,
  filterInfo: document.getElementById('filterInfo') as HTMLButtonElement,
  filterWarn: document.getElementById('filterWarn') as HTMLButtonElement,
  filterError: document.getElementById('filterError') as HTMLButtonElement,
  searchInput: document.getElementById('searchInput') as HTMLInputElement,
  autoScrollBtn: document.getElementById('autoScrollBtn') as HTMLButtonElement,
  clearBtn: document.getElementById('clearBtn') as HTMLButtonElement,
  closeBtn: document.getElementById('closeBtn') as HTMLButtonElement,
};

const filterButtons = [elements.filterAll, elements.filterInfo, elements.filterWarn, elements.filterError];

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function applyFilters(): void {
  const query = searchQuery.toLowerCase();
  filteredLogs = allLogs.filter(log => {
    if (currentFilter !== 'all' && log.level !== currentFilter) return false;
    if (query && !log.message.toLowerCase().includes(query)) return false;
    return true;
  });
}

function createLogElement(log: LogEntry): HTMLDivElement {
  const div = document.createElement('div');
  div.className = `log-entry ${log.level}`;
  div.innerHTML =
    `<span class="log-timestamp">${formatTimestamp(log.timestamp)}</span>` +
    `<span class="log-level ${log.level}">${log.level}</span>` +
    `<span class="log-message">${escapeHtml(log.message)}</span>`;
  return div;
}

function renderLogs(): void {
  const count = filteredLogs.length;
  elements.logCount.textContent = `${count} ${count === 1 ? 'entry' : 'entries'}`;

  elements.logList.innerHTML = '';

  if (count === 0) {
    const empty = document.createElement('div');
    empty.className = 'log-empty';
    empty.textContent = searchQuery ? 'No matching logs' : 'No logs yet';
    elements.logList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const log of filteredLogs) {
    fragment.appendChild(createLogElement(log));
  }
  elements.logList.appendChild(fragment);

  if (autoScroll) {
    elements.logList.scrollTop = elements.logList.scrollHeight;
  }
}

function appendLog(log: LogEntry): void {
  const query = searchQuery.toLowerCase();
  const matchesFilter = currentFilter === 'all' || log.level === currentFilter;
  const matchesSearch = !query || log.message.toLowerCase().includes(query);

  if (!matchesFilter || !matchesSearch) return;

  filteredLogs.push(log);

  // Remove empty state if present
  const empty = elements.logList.querySelector('.log-empty');
  if (empty) empty.remove();

  elements.logList.appendChild(createLogElement(log));
  elements.logCount.textContent = `${filteredLogs.length} ${filteredLogs.length === 1 ? 'entry' : 'entries'}`;

  if (autoScroll) {
    elements.logList.scrollTop = elements.logList.scrollHeight;
  }
}

async function init(): Promise<void> {
  allLogs = await window.logsAPI.getBufferedLogs() as LogEntry[];
  applyFilters();
  renderLogs();

  window.logsAPI.onNewLog((logEntry) => {
    const entry = logEntry as LogEntry;
    allLogs.push(entry);
    appendLog(entry);
  });

  // Filter buttons
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = (btn as HTMLElement).dataset.level || 'all';
      applyFilters();
      renderLogs();
    });
  });

  // Search
  let searchTimeout: ReturnType<typeof setTimeout>;
  elements.searchInput.addEventListener('input', (e: Event) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchQuery = (e.target as HTMLInputElement).value.trim();
      applyFilters();
      renderLogs();
    }, 300);
  });

  // Auto-scroll toggle
  elements.autoScrollBtn.addEventListener('click', () => {
    autoScroll = !autoScroll;
    elements.autoScrollBtn.classList.toggle('active', autoScroll);
    elements.autoScrollBtn.title = autoScroll ? 'Auto-scroll (on)' : 'Auto-scroll (off)';
    if (autoScroll) {
      elements.logList.scrollTop = elements.logList.scrollHeight;
    }
  });

  // Disable auto-scroll on manual scroll up
  elements.logList.addEventListener('scroll', () => {
    if (!autoScroll) return;
    const atBottom = elements.logList.scrollHeight - elements.logList.scrollTop <= elements.logList.clientHeight + 20;
    if (!atBottom) {
      autoScroll = false;
      elements.autoScrollBtn.classList.remove('active');
      elements.autoScrollBtn.title = 'Auto-scroll (off)';
    }
  });

  // Clear
  elements.clearBtn.addEventListener('click', async () => {
    await window.logsAPI.clearLogs();
    allLogs = [];
    filteredLogs = [];
    renderLogs();
  });

  // Close
  elements.closeBtn.addEventListener('click', () => {
    window.logsAPI.closeWindow();
  });
}

init();
