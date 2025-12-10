import { apiGet } from './api.js';

const hubSelect = document.getElementById('hub-select');
const refreshBtn = document.getElementById('refresh-btn');
const packagesEl = document.getElementById('packages');
const filtersEl = document.getElementById('filters');
const hubBadge = document.getElementById('hub-badge');
const statsBadge = document.getElementById('stats-pill');
const searchInput = document.getElementById('search');
const clearSearchBtn = document.getElementById('clear-search');
const emptyState = document.getElementById('empty-state');

const state = {
  hubs: [],
  packages: [],
  filterLetter: 'all',
  search: '',
};

function setLoading(isLoading) {
  packagesEl.classList.toggle('loading', isLoading);
}

function updateBadges(hubLabel = '', count = 0) {
  hubBadge.textContent = hubLabel || 'Selecione um HUB';
  statsBadge.textContent = `${count} pedidos`;
}

function parseRoute(route = '') {
  const match = String(route).toUpperCase().match(/([A-Z]+)[-\s]*(\d+)/);
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
  const letters = Array.from(new Set(list.map((p) => parseRoute(p.route).letter))).filter(Boolean).sort();

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
  letters.forEach((letter) => addBtn(`Rota ${letter}`, letter));
}

function formatDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function buildUserImage(userImg) {
  const id = userImg ? String(userImg).replace(/\D/g, '') : '0';
  return `./src/assets/img/profile-images/${id || '0'}.jpg`;
}

function applyFilters(list) {
  const search = state.search.trim().toLowerCase();

  return list.filter((item) => {
    const routeInfo = parseRoute(item.route);
    if (state.filterLetter !== 'all' && routeInfo.letter !== state.filterLetter) return false;

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

function renderRows() {
  packagesEl.innerHTML = '';
  const sorted = sortPackages(applyFilters(state.packages));
  updateBadges(hubSelect.options[hubSelect.selectedIndex]?.textContent || '', sorted.length);

  if (!sorted.length) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  sorted.forEach((pkg) => {
    const row = document.createElement('div');
    row.className = 'row';

    const route = document.createElement('div');
    route.className = 'route';
    route.innerHTML = `<span class="route-badge">${pkg.route || '-'}</span><span>${pkg.hub || pkg.hubCode || ''}</span>`;

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
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = pkg.userImg ? `Avatar #${pkg.userImg}` : 'Sem avatar';
    info.appendChild(name);
    info.appendChild(hint);
    user.appendChild(img);
    user.appendChild(info);

    row.append(route, br, pallet, date, user);
    packagesEl.appendChild(row);
  });
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
    hubSelect.innerHTML = '';
    data.hubs.forEach((hub) => {
      const opt = document.createElement('option');
      opt.value = hub.code;
      opt.textContent = hub.label;
      hubSelect.appendChild(opt);
    });

    const saved = localStorage.getItem('hubCode');
    const first = saved && data.hubs.find((h) => h.code === saved) ? saved : data.hubs[0]?.code;
    if (first) {
      hubSelect.value = first;
      hubBadge.textContent = hubSelect.options[hubSelect.selectedIndex]?.textContent || first;
      await loadPackages(first);
    } else {
      updateBadges('Nenhum HUB encontrado', 0);
    }
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

function registerEvents() {
  hubSelect.addEventListener('change', (ev) => {
    const hubCode = ev.target.value;
    localStorage.setItem('hubCode', hubCode);
    loadPackages(hubCode);
  });

  refreshBtn.addEventListener('click', () => loadPackages(hubSelect.value));

  searchInput.addEventListener('input', (ev) => handleSearch(ev.target.value));

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    handleSearch('');
    searchInput.focus();
  });

  document.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'f') {
      ev.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
}

async function init() {
  registerEvents();
  await loadHubs();
}

init();
