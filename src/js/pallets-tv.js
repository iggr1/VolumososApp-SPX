import { apiGet } from './api.js';

const hubLabelEl = document.getElementById('tv-hub');
const updatedEl = document.getElementById('tv-updated');
const totalEl = document.getElementById('tv-total');
const onPalletEl = document.getElementById('tv-onpallet');
const assignedEl = document.getElementById('tv-assigned');
const removedEl = document.getElementById('tv-removed');

const prioritiesEl = document.getElementById('tv-priorities');
const routesEl = document.getElementById('tv-routes');
const emptyEl = document.getElementById('tv-empty');
const themeToggleBtn = document.getElementById('tv-theme-toggle');

const REFRESH_INTERVAL = 60000;
const THEME_KEY = 'theme';

const state = {
  packages: [],
  hubCode: '',
};

function parseRoute(route = '') {
  const match = String(route)
    .toUpperCase()
    .match(/([A-Z]+)[-\s]*(\d+)/);
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
  if (!emptyEl) return;
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
    { onpallet: 0, assigned: 0, removed: 0 }
  );

  if (totalEl) totalEl.textContent = total;
  if (onPalletEl) onPalletEl.textContent = statusCounts.onpallet;
  if (assignedEl) assignedEl.textContent = statusCounts.assigned;
  if (removedEl) removedEl.textContent = statusCounts.removed;
}

/* ===== BARRAS ===== */
function buildBars(container, items, max) {
  if (!container) return;
  container.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'tv-bar-row';
    empty.innerHTML =
      '<span class="tv-bar-label">--</span><div class="tv-bar-track"></div><span class="tv-bar-value">0</span>';
    container.appendChild(empty);
    return;
  }

  items.forEach(({ label, value, color }) => {
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
    if (color) fill.style.background = color;
    track.appendChild(fill);

    const valueEl = document.createElement('span');
    valueEl.className = 'tv-bar-value';
    valueEl.textContent = value;

    row.append(labelEl, track, valueEl);
    container.appendChild(row);
  });
}

function normalizePriority(priorityValue = '') {
  const normalized = String(priorityValue).toLowerCase();
  if (normalized === 'super expedite') return 'max';
  if (normalized === 'expedite') return 'high';
  return 'normal';
}

/* ===== ROTAS POR LETRA ===== */
function routeLabelFromPkg(pkg) {
  const info = parseRoute(pkg.route || '');
  if (!info.letter) return 'OUTROS';
  if (!Number.isFinite(info.number)) return info.letter;
  return `${info.letter}-${info.number}`;
}

function buildRouteColumns(container, groupedByLetter) {
  if (!container) return;
  container.innerHTML = '';

  const letters = [...groupedByLetter.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  if (!letters.length) {
    const empty = document.createElement('div');
    empty.className = 'tv-route-col';
    empty.innerHTML = `
      <div class="tv-route-head">
        <span class="tv-route-letter">--</span>
        <span class="tv-route-total">0</span>
      </div>
      <div class="tv-route-list"></div>
    `;
    container.appendChild(empty);
    return;
  }

  letters.forEach(letter => {
    const routesMap = groupedByLetter.get(letter);

    const list = [...routesMap.entries()]
      .map(([label, value]) => ({ label, value, info: parseRoute(label) }))
      .sort((a, b) => {
        const an = a.info.number;
        const bn = b.info.number;
        if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
        return a.label.localeCompare(b.label, 'pt-BR');
      });

    const total = list.reduce((sum, item) => sum + item.value, 0);

    const col = document.createElement('div');
    col.className = 'tv-route-col';

    const head = document.createElement('div');
    head.className = 'tv-route-head';
    head.innerHTML = `
      <span class="tv-route-letter">${letter}</span>
      <span class="tv-route-total">${total}</span>
    `;

    const ul = document.createElement('div');
    ul.className = 'tv-route-list';

    // lista somente com rotas tipo "C-12", "D-1" (igual ao print)
    list
      .filter(item => item.label.includes('-'))
      .forEach(({ label, value }) => {
        const row = document.createElement('div');
        row.className = 'tv-route-row';
        row.innerHTML = `
          <span class="tv-route-name">${label}</span>
          <span class="tv-route-count">${value}</span>
        `;
        ul.appendChild(row);
      });

    col.append(head, ul);
    container.appendChild(col);
  });
}

function renderCharts() {
  updateSummary();

  if (!state.packages.length) {
    setEmpty(true);
    if (prioritiesEl) prioritiesEl.innerHTML = '';
    if (routesEl) routesEl.innerHTML = '';
    return;
  }

  setEmpty(false);

  // ===== barras por prioridade =====
  const priorityCounts = {
    normal: 0,
    high: 0,
    max: 0,
  };
  // ===== rotas por letra (C-12, D-1...) =====
  const grouped = new Map();

  state.packages.forEach(pkg => {
    const routeInfo = parseRoute(pkg.route || '');
    const letter = routeInfo.letter || 'OUTROS';
    const routeLabel = routeLabelFromPkg(pkg);
    const priority = normalizePriority(pkg.priority);

    priorityCounts[priority] += 1;

    if (!grouped.has(letter)) grouped.set(letter, new Map());
    const routesMap = grouped.get(letter);
    routesMap.set(routeLabel, (routesMap.get(routeLabel) || 0) + 1);
  });

  const priorityList = [
    { label: 'Normal', value: priorityCounts.normal, color: 'var(--priority-normal)' },
    { label: 'Alta', value: priorityCounts.high, color: 'var(--priority-high)' },
    { label: 'Máxima', value: priorityCounts.max, color: 'var(--priority-max)' },
  ];

  const maxPriority = Math.max(...priorityList.map(item => item.value));
  buildBars(prioritiesEl, priorityList, maxPriority || 1);

  buildRouteColumns(routesEl, grouped);
}

async function loadPackages() {
  if (!state.hubCode) {
    if (hubLabelEl) hubLabelEl.textContent = 'Selecione um HUB';
    state.packages = [];
    renderCharts();
    return;
  }

  try {
    const res = await apiGet('public/pallets', { hub: state.hubCode });
    if (!res?.ok) throw new Error(res?.error || 'Erro ao carregar pallets');

    state.packages = Array.isArray(res.packages) ? res.packages : [];
    if (hubLabelEl) hubLabelEl.textContent = res.hub || state.hubCode;
    if (updatedEl) updatedEl.textContent = formatUpdatedLabel();
    renderCharts();
  } catch (err) {
    console.error('Erro ao carregar dados do modo TV', err);
    if (hubLabelEl) hubLabelEl.textContent = 'Erro ao carregar dados';
    state.packages = [];
    renderCharts();
  }
}

function initHubFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const hub = params.get('hub') || localStorage.getItem('hubCode') || '';
  state.hubCode = hub;
  if (hub) localStorage.setItem('hubCode', hub);
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
