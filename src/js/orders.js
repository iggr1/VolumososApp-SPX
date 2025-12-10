import { apiGet } from './api.js';

const hubsSelect = document.getElementById('hubSelect');
const routesContainer = document.getElementById('routesContainer');
const statTotal = document.getElementById('statTotal');
const statRoutes = document.getElementById('statRoutes');
const statFiltered = document.getElementById('statFiltered');
const userChipValue = document.querySelector('.user-chip__value');
const userChipStatus = document.querySelector('.user-chip__status');
const searchInput = document.getElementById('searchInput');
const btnClearSearch = document.getElementById('btnClearSearch');
const btnFocusSearch = document.getElementById('btnFocusSearch');
const btnRefresh = document.getElementById('btnRefresh');
const btnCollapseAll = document.getElementById('btnCollapseAll');
const btnExpandAll = document.getElementById('btnExpandAll');
const filterChips = document.querySelectorAll('.chip');

const sampleFallback = [
  {
    route: 'A-1',
    brCode: 'BR0000000000001',
    recipient: 'Cliente de Exemplo',
    address: 'Rua A, 123 - Centro',
    status: 'pendente',
    updatedAt: '2025-03-15T10:00:00Z'
  },
  {
    route: 'A-2',
    brCode: 'BR0000000000002',
    recipient: 'Loja XPTO',
    address: 'Av. Brasil, 2000 - Bairro Azul',
    status: 'transito',
    updatedAt: '2025-03-15T10:10:00Z'
  },
  {
    route: 'B-10',
    brCode: 'BR0000000000003',
    recipient: 'Destinatário Beta',
    address: 'Rua das Flores, 45 - Jardim',
    status: 'entregue',
    updatedAt: '2025-03-15T10:20:00Z'
  }
];

const state = {
  hubs: [],
  packages: [],
  filtered: [],
  filter: 'all',
  search: '',
  expandedRoutes: new Set()
};

function parseRoute(route = '') {
  const [prefix, number] = String(route).split('-');
  return { prefix: prefix || '', number: Number(number) || 0 };
}

function sortRoutes(a, b) {
  const ra = parseRoute(a.route || a);
  const rb = parseRoute(b.route || b);
  if (ra.prefix === rb.prefix) return ra.number - rb.number;
  return ra.prefix.localeCompare(rb.prefix);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function setLoading(isLoading) {
  if (isLoading) {
    routesContainer.innerHTML = `
      <div class="route-group">
        <div class="route-group__header">
          <div class="route-group__title skeleton skeleton-line" style="width: 160px;"></div>
          <div class="route-group__pill skeleton skeleton-line" style="width: 80px;"></div>
        </div>
        <div class="route-group__body">
          ${'<div class="cell skeleton skeleton-line" style="height: 18px;"></div>'.repeat(8)}
        </div>
      </div>`;
  } else if (!state.packages.length) {
    routesContainer.innerHTML = `
      <div class="empty">
        <i data-lucide="package-x"></i>
        <p>Nenhum pedido encontrado para este hub.</p>
      </div>`;
  }
  lucide.createIcons();
}

function updateStats(filteredCount) {
  statTotal.textContent = state.packages.length;
  const uniqueRoutes = new Set(state.packages.map((p) => p.route)).size;
  statRoutes.textContent = uniqueRoutes;
  statFiltered.textContent = filteredCount;
}

function applyFilters() {
  const term = state.search.toLowerCase();
  const filtered = state.packages.filter((pkg) => {
    const matchesFilter = state.filter === 'all' || pkg.status === state.filter;
    const searchable = `${pkg.route} ${pkg.brCode} ${pkg.recipient || ''} ${pkg.address || ''}`.toLowerCase();
    const matchesSearch = !term || searchable.includes(term);
    return matchesFilter && matchesSearch;
  });

  state.filtered = filtered;
  updateStats(filtered.length);
  renderRoutes();
}

function buildRouteMap(list) {
  return list.reduce((acc, pkg) => {
    const route = pkg.route || 'Sem rota';
    if (!acc[route]) acc[route] = [];
    acc[route].push(pkg);
    return acc;
  }, {});
}

function renderRoutes() {
  if (!state.filtered.length) {
    routesContainer.innerHTML = `
      <div class="empty">
        <i data-lucide="search-x"></i>
        <p>Nenhum resultado para os filtros aplicados.</p>
      </div>`;
    lucide.createIcons();
    return;
  }

  const routeMap = buildRouteMap(state.filtered);
  const sortedRoutes = Object.keys(routeMap).sort((a, b) => sortRoutes({ route: a }, { route: b }));

  routesContainer.innerHTML = sortedRoutes
    .map((routeKey) => {
      const packages = routeMap[routeKey].sort(sortRoutes);
      const isExpanded = state.expandedRoutes.has(routeKey);
      return `
        <article class="route-group" data-route="${routeKey}">
          <header class="route-group__header" role="button" tabindex="0">
            <div class="route-group__title">
              <i data-lucide="map"></i>
              <span>${routeKey}</span>
              <span class="route-group__pill">${packages.length} pedido(s)</span>
            </div>
            <div class="route-group__meta">Última atualização: ${formatDate(packages[0].updatedAt)}</div>
          </header>
          <div class="route-group__body" style="display: ${isExpanded ? 'grid' : 'none'}">
            ${packages
              .map(
                (pkg) => `
                  <div class="row">
                    <div class="cell">
                      <span class="cell__label">BR Code</span>
                      <button class="tag" data-br="${pkg.brCode}">
                        <i data-lucide="copy"></i>
                        ${pkg.brCode}
                      </button>
                    </div>
                    <div class="cell">
                      <span class="cell__label">Destinatário</span>
                      ${pkg.recipient || '—'}<br><small class="cell__label">${pkg.address || 'Sem endereço'}</small>
                    </div>
                    <div class="cell">
                      <span class="cell__label">Status</span>
                      <span class="badge badge--${pkg.status || 'pendente'}">${pkg.status || 'pendente'}</span>
                    </div>
                    <div class="cell">
                      <span class="cell__label">Atualizado</span>
                      ${formatDate(pkg.updatedAt)}
                    </div>
                  </div>
                `
              )
              .join('')}
          </div>
        </article>
      `;
    })
    .join('');

  attachRouteEvents();
  lucide.createIcons();
}

function attachRouteEvents() {
  routesContainer.querySelectorAll('.route-group__header').forEach((header) => {
    header.addEventListener('click', toggleRoute);
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleRoute.call(header, e);
      }
    });
  });

  routesContainer.querySelectorAll('[data-br]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const br = btn.dataset.br;
      navigator.clipboard?.writeText(br);
      btn.textContent = `${br} copiado!`;
      setTimeout(() => (btn.textContent = br), 1200);
    });
  });
}

function toggleRoute(event) {
  const group = event.target.closest('.route-group');
  const body = group.querySelector('.route-group__body');
  const routeKey = group.dataset.route;
  const isOpen = body.style.display === 'grid';
  body.style.display = isOpen ? 'none' : 'grid';
  if (!isOpen) state.expandedRoutes.add(routeKey); else state.expandedRoutes.delete(routeKey);
}

async function loadHubs() {
  try {
    const res = await apiGet('public/hubs');
    state.hubs = res?.hubs || res || [];
  } catch (error) {
    console.warn('Erro ao buscar hubs remotos, tentando fallback local', error);
    try {
      const local = await fetch('./data/hubs.json').then((r) => r.json());
      state.hubs = local?.hubs || [];
    } catch (fallbackError) {
      console.warn('Fallback local indisponível', fallbackError);
      state.hubs = [];
    }
  }

  if (!state.hubs.length) {
    hubsSelect.innerHTML = '<option value="" disabled selected>Nenhum hub encontrado</option>';
    return;
  }

  hubsSelect.innerHTML = '<option value="" disabled selected>Selecione um hub</option>' +
    state.hubs.map((hub) => `<option value="${hub.code || hub.id}">${hub.name || hub.code}</option>`).join('');
}

async function loadPackages() {
  const hub = hubsSelect.value;
  if (!hub) return;
  userChipValue.textContent = hub;
  userChipStatus.style.background = 'var(--success)';
  userChipStatus.style.boxShadow = '0 0 0 6px rgba(102, 224, 163, 0.16)';

  setLoading(true);
  try {
    const res = await apiGet('public/pallets', { hub });
    const packages = res?.packages || [];
    state.packages = packages.length ? packages : sampleFallback;
  } catch (error) {
    console.warn('Erro ao buscar pallets, usando fallback', error);
    state.packages = sampleFallback;
  }

  state.expandedRoutes = new Set(state.packages.map((p) => p.route));
  applyFilters();
}

function bindControls() {
  hubsSelect?.addEventListener('change', loadPackages);

  btnRefresh?.addEventListener('click', () => loadPackages());

  searchInput?.addEventListener('input', (e) => {
    state.search = e.target.value;
    applyFilters();
  });

  btnClearSearch?.addEventListener('click', () => {
    state.search = '';
    searchInput.value = '';
    applyFilters();
  });

  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      filterChips.forEach((c) => c.classList.remove('chip--active'));
      chip.classList.add('chip--active');
      state.filter = chip.dataset.filter;
      applyFilters();
    });
  });

  btnFocusSearch?.addEventListener('click', focusSearch);

  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'f' && e.ctrlKey) {
      e.preventDefault();
      focusSearch();
    }
  });

  btnCollapseAll?.addEventListener('click', () => {
    routesContainer.querySelectorAll('.route-group__body').forEach((body) => (body.style.display = 'none'));
    state.expandedRoutes.clear();
  });

  btnExpandAll?.addEventListener('click', () => {
    routesContainer.querySelectorAll('.route-group__body').forEach((body) => (body.style.display = 'grid'));
    state.expandedRoutes = new Set(state.packages.map((p) => p.route));
  });
}

function focusSearch() {
  searchInput?.focus();
  searchInput?.select();
  const rect = searchInput?.getBoundingClientRect();
  if (rect?.top < 0 || rect?.bottom > window.innerHeight) {
    searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

async function init() {
  setLoading(true);
  bindControls();
  await loadHubs();
  setLoading(false);
}

document.addEventListener('DOMContentLoaded', init);
