import { apiGet, apiPost } from './api.js';
import { enhanceSelect } from './utils/uiSelect.js';

const hubSelect = document.getElementById('hub-select');
const refreshBtn = document.getElementById('refresh-btn');
const packagesEl = document.getElementById('packages');
const filtersEl = document.getElementById('filters');
const hubBadge = document.getElementById('hub-badge');
const statsBadge = document.getElementById('stats-pill');
const searchInput = document.getElementById('search');
const clearSearchBtn = document.getElementById('clear-search');
const routeSearchInput = document.getElementById('route-search');
const clearRouteSearchBtn = document.getElementById('clear-route-search');
const tvModeBtn = document.getElementById('tv-mode-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const exportBtn = document.getElementById('export-btn');
const emptyState = document.getElementById('empty-state');
const hubModal = document.getElementById('hub-modal');
const hubModalClose = document.getElementById('hub-modal-close');
const hubModalRecent = document.getElementById('hub-modal-recent');
const hubModalList = document.getElementById('hub-modal-list');
const hubSelectNice = enhanceSelect(document, 'hub-select', { searchPlaceholder: 'Buscar HUB...' });
const hubSelectButton = document.querySelector('.ui-select[data-for="hub-select"] .ui-select-btn');

const HUB_HISTORY_KEY = 'hubHistory';
const HUB_HISTORY_LIMIT = 6;
const THEME_KEY = 'theme';

const state = {
  hubs: [],
  packages: [],
  filterLetter: 'all',
  search: '',
  routeSearch: '',
  hubHistory: [],
};

function setLoading(isLoading) {
  packagesEl.classList.toggle('loading', isLoading);
}

function updateBadges(hubLabel = '', count = 0) {
  hubBadge.textContent = hubLabel || 'Selecione um HUB';
  statsBadge.textContent = `${count} pedidos`;
}

function updateTvLink(hubCode = '') {
  if (!tvModeBtn) return;
  const url = new URL(tvModeBtn.getAttribute('href'), window.location.href);
  if (hubCode) {
    url.searchParams.set('hub', hubCode);
  } else {
    url.searchParams.delete('hub');
  }
  tvModeBtn.href = url.toString();
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
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(THEME_KEY, nextTheme);
  updateThemeToggle(nextTheme);
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const theme = stored || 'light';
  applyTheme(theme);
}

function getHubHistory() {
  try {
    const raw = localStorage.getItem(HUB_HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn('Erro ao ler histórico de hubs', err);
    return [];
  }
}

function saveHubHistory(list) {
  localStorage.setItem(HUB_HISTORY_KEY, JSON.stringify(list));
}

function updateHubHistory(hubCode) {
  if (!hubCode) return;
  const current = state.hubHistory.length ? [...state.hubHistory] : getHubHistory();
  const next = [hubCode, ...current.filter(code => code !== hubCode)].slice(0, HUB_HISTORY_LIMIT);
  state.hubHistory = next;
  saveHubHistory(next);
}

function getHubLabel(code) {
  return state.hubs.find(hub => hub.code === code)?.label || code;
}

function parseRoute(route = '') {
  const match = String(route)
    .toUpperCase()
    .match(/([A-Z]+)[-\s]*(\d+)/);
  if (!match) return { letter: route || '', number: Number.POSITIVE_INFINITY, raw: route };
  return { letter: match[1], number: Number(match[2]), raw: route };
}

function sortPackages(list) {
  return [...list].sort((a, b) => {
    const ra = parseRoute(a.route);
    const rb = parseRoute(b.route);
    if (ra.letter !== rb.letter) return ra.letter.localeCompare(rb.letter);
    return ra.number - rb.number;
  });
}

function buildFilterButtons(list) {
  filtersEl.innerHTML = '';
  const letters = Array.from(new Set(list.map(p => parseRoute(p.route).letter)))
    .filter(Boolean)
    .sort();

  const addBtn = (label, value) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `filter-btn ${state.filterLetter === value ? 'active' : ''}`;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      state.filterLetter = value;
      buildFilterButtons(state.packages);
      renderRows();
    });
    filtersEl.appendChild(btn);
  };

  addBtn('Todas as rotas', 'all');
  letters.forEach(letter => addBtn(`Rota ${letter}`, letter));
}

function formatDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatStatus(status = '') {
  const normalized = status.toLowerCase().replace(/\s+/g, '');
  switch (normalized) {
    case 'assigned':
      return { label: 'Entregue', className: 'status-assigned' };
    case 'removed':
      return { label: 'Removido', className: 'status-removed' };
    case 'onpallet':
    default:
      return { label: 'Em pallet', className: 'status-onpallet' };
  }
}

function buildUserImage(userImg) {
  const id = userImg ? String(userImg).replace(/\D/g, '') : '0';
  return `./src/assets/img/profile-images/${id || '0'}.jpg`;
}

function applyFilters(list) {
  const search = state.search.trim().toLowerCase();
  const normalizedRouteSearch = state.routeSearch.trim().toUpperCase().replace(/\s+/g, '');

  return list.filter(item => {
    const routeInfo = parseRoute(item.route);
    if (state.filterLetter !== 'all' && routeInfo.letter !== state.filterLetter) return false;

    if (normalizedRouteSearch) {
      const normalizedItemRoute = String(item.route || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');
      if (normalizedItemRoute !== normalizedRouteSearch) return false;
    }

    if (!search) return true;
    const haystack = [
      item.route,
      item.brCode,
      item.hubCode,
      String(item.pallet),
      item.userName,
      item.dateTime,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(search);
  });
}

function getPriorityInfo(priorityValue = '') {
  const normalized = String(priorityValue).toLowerCase();
  if (normalized === 'super expedite') {
    return {
      type: 'max',
      rowClass: 'priority-super',
      flagLabel: 'Prioridade Máxima',
      tooltip: 'Super expedite: atender antes dos demais',
      textClass: 'priority-text-max',
      valueLabel: 'Máxima',
    };
  }
  if (normalized === 'expedite') {
    return {
      type: 'high',
      rowClass: 'priority-expedite',
      flagLabel: 'Prioridade',
      tooltip: 'Expedite: priorize esta entrega',
      textClass: 'priority-text-high',
      valueLabel: 'Alta',
    };
  }
  return {
    type: 'normal',
    rowClass: '',
    flagLabel: '',
    tooltip: '',
    textClass: 'priority-text-normal',
    valueLabel: 'Normal',
  };
}

function renderRows() {
  packagesEl.innerHTML = '';
  const sorted = sortPackages(applyFilters(state.packages));
  updateBadges(hubSelect.options[hubSelect.selectedIndex]?.textContent || '', sorted.length);
  if (exportBtn) exportBtn.disabled = sorted.length === 0;

  if (!sorted.length) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  sorted.forEach(pkg => {
    const row = document.createElement('div');
    row.className = 'row';

    const priorityInfo = getPriorityInfo(pkg.priority);
    if (priorityInfo.rowClass) {
      row.classList.add(priorityInfo.rowClass);
    }

    const route = document.createElement('div');
    route.className = 'route';
    route.innerHTML = `
      <span class="route-badge">${pkg.route || '-'}</span>
      <span class="priority-label ${priorityInfo.textClass}">
        <span class="priority-title">Prioridade</span>
        <span class="priority-value">${priorityInfo.valueLabel}</span>
      </span>
    `;

    const br = document.createElement('div');
    br.className = 'brcode';
    br.textContent = pkg.brCode || '-';

    const pallet = document.createElement('div');
    pallet.className = 'pallet-chip';
    pallet.textContent = `Pallet ${pkg.pallet ?? '-'}`;

    const date = document.createElement('div');
    date.className = 'datetime';
    date.textContent = formatDate(pkg.dateTime);

    const user = document.createElement('div');
    user.className = 'user';
    const img = document.createElement('img');
    img.src = buildUserImage(pkg.userImg);
    img.alt = 'Foto do operador';
    img.loading = 'lazy';
    const info = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = pkg.userName || 'Operador não informado';
    info.appendChild(name);
    user.appendChild(img);
    user.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const statusInfo = formatStatus(pkg.status);
    const statusBadge = document.createElement('span');
    statusBadge.className = `status-badge ${statusInfo.className}`;
    statusBadge.textContent = statusInfo.label;

    const deliverBtn = document.createElement('button');
    deliverBtn.type = 'button';
    deliverBtn.className = 'action-btn primary';
    deliverBtn.textContent = 'Entregar';
    deliverBtn.disabled = statusInfo.label === 'Entregue';
    deliverBtn.addEventListener('click', () => updatePackageStatus(pkg, 'assigned'));

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'action-btn';
    removeBtn.textContent = '🗑';
    removeBtn.disabled = statusInfo.label === '🗑';
    removeBtn.addEventListener('click', () => updatePackageStatus(pkg, 'removed'));

    actions.append(statusBadge, deliverBtn, removeBtn);

    row.append(route, br, pallet, date, user, actions);
    packagesEl.appendChild(row);
  });
}

function formatCsvValue(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildExportFilename(hubCode) {
  const date = new Date();
  const stamp = date.toISOString().slice(0, 10);
  const safeHub = hubCode ? hubCode.replace(/[^a-z0-9_-]+/gi, '-') : 'hub';
  return `pallets_${safeHub}_${stamp}.csv`;
}

function exportFilteredData() {
  const filtered = sortPackages(applyFilters(state.packages));
  if (!filtered.length) {
    alert('Não há dados filtrados para exportar.');
    return;
  }

  const hubLabel = hubSelect.options[hubSelect.selectedIndex]?.textContent || '';
  const header = [
    'HUB',
    'Rota',
    'BR Code',
    'Pallet',
    'Data/Hora',
    'Operador',
    'Status',
    'Prioridade',
  ];

  const rows = filtered.map(pkg => [
    hubLabel,
    pkg.route || '',
    pkg.brCode || '',
    pkg.pallet ?? '',
    formatDate(pkg.dateTime),
    pkg.userName || '',
    formatStatus(pkg.status).label,
    getPriorityInfo(pkg.priority).valueLabel,
  ]);

  const csvContent = [header, ...rows]
    .map(row => row.map(formatCsvValue).join(','))
    .join('\n');

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildExportFilename(hubSelect.value);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openHubModal() {
  if (!hubModal) return;
  hubModal.classList.add('is-open');
  hubModal.setAttribute('aria-hidden', 'false');
}

function closeHubModal() {
  if (!hubModal) return;
  hubModal.classList.remove('is-open');
  hubModal.setAttribute('aria-hidden', 'true');
}

function selectHub(code) {
  if (!code) return;
  const label = getHubLabel(code);
  if (hubSelectNice) {
    hubSelectNice.pick(code, label);
  } else {
    hubSelect.value = code;
    hubSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }
  updateHubHistory(code);
  buildHubModal();
  closeHubModal();
}

function buildHubModal() {
  if (!hubModalRecent || !hubModalList) return;
  hubModalRecent.innerHTML = '';
  hubModalList.innerHTML = '';

  const selectedCode = hubSelect.value;
  const recentHubs = state.hubHistory
    .map(code => state.hubs.find(hub => hub.code === code))
    .filter(Boolean);

  if (!recentHubs.length) {
    const empty = document.createElement('p');
    empty.className = 'hub-empty';
    empty.textContent = 'Nenhum hub recente.';
    hubModalRecent.appendChild(empty);
  } else {
    recentHubs.forEach(hub => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `hub-option ${hub.code === selectedCode ? 'active' : ''}`;
      btn.textContent = hub.label;
      btn.addEventListener('click', () => selectHub(hub.code));
      hubModalRecent.appendChild(btn);
    });
  }

  const sortedHubs = [...state.hubs].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  sortedHubs.forEach(hub => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `hub-option ${hub.code === selectedCode ? 'active' : ''}`;
    btn.textContent = hub.label;
    btn.addEventListener('click', () => selectHub(hub.code));
    hubModalList.appendChild(btn);
  });
}

async function updatePackageStatus(pkg, status) {
  const hub = hubSelect.value;
  if (!hub) return;

  const brCode = pkg.brCode;
  try {
    const payload = { hub, brCode, status };
    await apiPost('public/package/status', payload);

    state.packages = state.packages.map(item =>
      item.brCode === brCode ? { ...item, status } : item
    );
    renderRows();
  } catch (err) {
    console.error('Erro ao atualizar status', err);
    alert('Não foi possível atualizar o status do pacote. Tente novamente.');
  }
}

async function loadPackages(hubCode) {
  if (!hubCode) {
    state.packages = [];
    renderRows();
    return;
  }

  setLoading(true);
  try {
    const res = await apiGet('public/pallets', { hub: hubCode });
    const { ok, packages = [], hub } = res || {};
    if (!ok) throw new Error(res?.error || 'Erro ao carregar pallets');

    state.packages = Array.isArray(packages) ? packages : [];
    buildFilterButtons(state.packages);
    updateBadges(hub || hubCode, state.packages.length);
    updateTvLink(hubCode);
    renderRows();
  } catch (err) {
    console.error('Erro ao buscar pallets', err);
    hubBadge.textContent = 'Erro ao carregar pallets';
    statsBadge.textContent = '--';
    state.packages = [];
    renderRows();
  } finally {
    setLoading(false);
  }
}

async function loadHubs() {
  hubSelect.innerHTML = '';
  const loadingOpt = document.createElement('option');
  loadingOpt.textContent = 'Carregando hubs...';
  hubSelect.appendChild(loadingOpt);

  try {
    const data = await apiGet('hubs');
    if (!data?.ok || !Array.isArray(data.hubs)) throw new Error('Resposta inválida');

    state.hubs = data.hubs;
    state.hubHistory = getHubHistory();
    hubSelect.innerHTML = '';
    data.hubs.forEach(hub => {
      const opt = document.createElement('option');
      opt.value = hub.code;
      opt.textContent = hub.label;
      hubSelect.appendChild(opt);
    });

    hubSelectNice?.refreshOptions();

    const saved = localStorage.getItem('hubCode');
    const first = saved && data.hubs.find(h => h.code === saved) ? saved : data.hubs[0]?.code;
    if (first) {
      hubSelect.value = first;
      updateHubHistory(first);
      updateTvLink(first);
      const label = hubSelect.options[hubSelect.selectedIndex]?.textContent || first;
      if (hubSelectNice) {
        hubSelectNice.pick(first, label);
      } else {
        hubBadge.textContent = label;
        await loadPackages(first);
      }
    } else {
      updateBadges('Nenhum HUB encontrado', 0);
    }
    buildHubModal();
    openHubModal();
  } catch (err) {
    console.error('Erro ao carregar hubs', err);
    hubBadge.textContent = 'Erro ao carregar hubs';
    statsBadge.textContent = '--';
  }
}

function handleSearch(value) {
  state.search = value;
  renderRows();
}

function handleRouteSearch(value) {
  state.routeSearch = value;
  renderRows();
}

function registerEvents() {
  hubSelect.addEventListener('change', ev => {
    const hubCode = ev.target.value;
    localStorage.setItem('hubCode', hubCode);
    updateHubHistory(hubCode);
    buildHubModal();
    updateTvLink(hubCode);
    loadPackages(hubCode);
  });

  refreshBtn.addEventListener('click', () => loadPackages(hubSelect.value));

  searchInput.addEventListener('input', ev => handleSearch(ev.target.value));

  routeSearchInput.addEventListener('input', ev => handleRouteSearch(ev.target.value));

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    handleSearch('');
    searchInput.focus();
  });

  clearRouteSearchBtn.addEventListener('click', () => {
    routeSearchInput.value = '';
    handleRouteSearch('');
    routeSearchInput.focus();
  });

  exportBtn?.addEventListener('click', exportFilteredData);

  hubModalClose?.addEventListener('click', closeHubModal);

  hubModal?.addEventListener('click', ev => {
    if (ev.target?.matches?.('[data-modal-close]')) {
      closeHubModal();
    }
  });

  hubSelectButton?.addEventListener(
    'click',
    ev => {
      ev.preventDefault();
      ev.stopPropagation();
      hubSelectNice?.close();
      buildHubModal();
      openHubModal();
    },
    true
  );

  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && hubModal?.classList.contains('is-open')) {
      closeHubModal();
      return;
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'f') {
      ev.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  themeToggleBtn?.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

async function init() {
  initTheme();
  registerEvents();
  await loadHubs();
  loadPackages(hubSelect.value);
}

init();
