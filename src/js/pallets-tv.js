import { apiGet } from './api.js';

const hubLabelEl = document.getElementById('tv-hub');
const updatedEl = document.getElementById('tv-updated');
const totalEl = document.getElementById('tv-total');
const onPalletEl = document.getElementById('tv-onpallet');
const assignedEl = document.getElementById('tv-assigned');
const removedEl = document.getElementById('tv-removed');
const lettersEl = document.getElementById('tv-letters');
const palletsEl = document.getElementById('tv-pallets');
const emptyEl = document.getElementById('tv-empty');
const themeToggleBtn = document.getElementById('tv-theme-toggle');

const REFRESH_INTERVAL = 60000;
const THEME_KEY = 'theme';

const state = {
  packages: [],
  hubCode: '',
};

function parseRoute(route = '') {
  const match = String(route).toUpperCase().match(/([A-Z]+)[-\s]*(\d+)/);
  if (!match) return { letter: route || '', number: Number.POSITIVE_INFINITY, raw: route };
  return { letter: match[1], number: Number(match[2]), raw: route };
}

function formatUpdatedLabel(date = new Date()) {
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function updateThemeToggle(theme) {
  if (!themeToggleBtn) return;
  const icon = themeToggleBtn.querySelector('.theme-icon');
  const label = themeToggleBtn.querySelector('.theme-label');
  const isDark = theme === 'dark';
  if (icon) icon.textContent = isDark ? '☀️' : '🌙';
  if (label) label.textContent = isDark ? 'Claro' : 'Escuro';
}

function applyTheme(theme) {
  const nextTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(THEME_KEY, nextTheme);
  updateThemeToggle(nextTheme);
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const theme = stored || 'dark';
  applyTheme(theme);
}

function setEmpty(isEmpty) {
  emptyEl.hidden = !isEmpty;
}

function updateSummary() {
  const total = state.packages.length;
  const statusCounts = state.packages.reduce(
    (acc, pkg) => {
      const status = String(pkg.status || 'onpallet').toLowerCase();
      if (status === 'assigned') acc.assigned += 1;
      else if (status === 'removed') acc.removed += 1;
      else acc.onpallet += 1;
      return acc;
    },
    { onpallet: 0, assigned: 0, removed: 0 },
  );

  totalEl.textContent = total;
  onPalletEl.textContent = statusCounts.onpallet;
  assignedEl.textContent = statusCounts.assigned;
  removedEl.textContent = statusCounts.removed;
}

function buildBars(container, items, max) {
  container.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'tv-bar-row';
    empty.innerHTML = '<span class="tv-bar-label">--</span><div class="tv-bar-track"></div><span class="tv-bar-value">0</span>';
    container.appendChild(empty);
    return;
  }

  items.forEach(({ label, value }) => {
    const row = document.createElement('div');
    row.className = 'tv-bar-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'tv-bar-label';
    labelEl.textContent = label;

    const track = document.createElement('div');
    track.className = 'tv-bar-track';

    const fill = document.createElement('div');
    fill.className = 'tv-bar-fill';
    fill.style.width = `${Math.max(8, Math.round((value / max) * 100))}%`;
    track.appendChild(fill);

    const valueEl = document.createElement('span');
    valueEl.className = 'tv-bar-value';
    valueEl.textContent = value;

    row.append(labelEl, track, valueEl);
    container.appendChild(row);
  });
}

function renderCharts() {
  updateSummary();

  if (!state.packages.length) {
    setEmpty(true);
    lettersEl.innerHTML = '';
    palletsEl.innerHTML = '';
    return;
  }

  setEmpty(false);

  const letters = new Map();
  const pallets = new Map();

  state.packages.forEach((pkg) => {
    const routeInfo = parseRoute(pkg.route || '');
    const letter = routeInfo.letter || 'Outros';
    letters.set(letter, (letters.get(letter) || 0) + 1);

    const pallet = pkg.pallet ?? '---';
    pallets.set(pallet, (pallets.get(pallet) || 0) + 1);
  });

  const letterList = [...letters.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  const palletList = [...pallets.entries()]
    .map(([label, value]) => ({ label: String(label), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const maxLetters = Math.max(...letterList.map((item) => item.value));
  const maxPallets = Math.max(...palletList.map((item) => item.value));

  buildBars(lettersEl, letterList, maxLetters || 1);
  buildBars(palletsEl, palletList, maxPallets || 1);
}

async function loadPackages() {
  if (!state.hubCode) {
    hubLabelEl.textContent = 'Selecione um HUB';
    state.packages = [];
    renderCharts();
    return;
  }

  try {
    const res = await apiGet('public/pallets', { hub: state.hubCode });
    if (!res?.ok) throw new Error(res?.error || 'Erro ao carregar pallets');

    state.packages = Array.isArray(res.packages) ? res.packages : [];
    hubLabelEl.textContent = res.hub || state.hubCode;
    updatedEl.textContent = formatUpdatedLabel();
    renderCharts();
  } catch (err) {
    console.error('Erro ao carregar dados do modo TV', err);
    hubLabelEl.textContent = 'Erro ao carregar dados';
    state.packages = [];
    renderCharts();
  }
}

function initHubFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const hub = params.get('hub') || localStorage.getItem('hubCode') || '';
  state.hubCode = hub;
  if (hub) {
    localStorage.setItem('hubCode', hub);
  }
}

function init() {
  initHubFromQuery();
  initTheme();
  themeToggleBtn?.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
  loadPackages();
  window.setInterval(loadPackages, REFRESH_INTERVAL);
}

init();
