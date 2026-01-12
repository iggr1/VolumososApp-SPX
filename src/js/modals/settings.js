import { apiGet } from '../api.js';

export const meta = {
  title: 'Configurações',
  size: 'sm',
  showBack: true,
  showClose: true,
  backdropClose: true,
  escToClose: true,
  initialFocus: '#settings-root',
};

export default function render(_props = {}, api) {
  api.setBackTo('menu');

  const el = document.createElement('div');
  el.id = 'settings-root';
  el.className = 'settings-modal';
  el.innerHTML = loadingView();

  init().catch(e => {
    el.innerHTML = errorView(e?.message || 'Falha ao carregar dados.');
    if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
  });

  return el;

  async function init() {
    const res = await apiGet('config'); // { ok, profile{...}, hub? }
    const profile = res?.profile || {};
    const role = String(profile.role || '').toLowerCase();

    if (role === 'admin') {
      el.innerHTML = adminMenuView();
      if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
      bindAdminMenu(el, api);
      return;
    }

    if (role === 'user') {
      el.innerHTML = userMenuView();
      if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
      bindUserMenu(el, api);
      return;
    }

    // guest ou indefinido
    el.innerHTML = errorView(
      'Acesso negado: usuários convidados não podem acessar as configurações.'
    );
    if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
  }
}

/* ---------------------- VIEWS ---------------------- */

function loadingView() {
  return `
    <div class="center" style="display:grid;place-items:center;height:20vh">
      <svg width="56" height="56" viewBox="0 0 24 24" aria-label="carregando">
        <style>.s{animation:spin .9s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style>
        <g class="s" transform-origin="12 12">
          <path d="M12 2a10 10 0 1 0 10 10" fill="none" stroke="var(--orange)" stroke-width="1"/>
        </g>
      </svg>
    </div>
  `;
}

function errorView(msg) {
  return `
    <div style="display:grid;gap:16rem;place-items:center;text-align:center">
      <div style="font-weight:700">Erro</div>
      <div>${escapeHtml(msg)}</div>
    </div>
  `;
}

function adminMenuView() {
  return `
  <div class="settings-list">
    <button id="myData" class="settings-button">
      <i data-lucide="id-card" aria-hidden="true"></i>
      <span>Minhas informações</span>
      <i data-lucide="chevron-right" class="chev" aria-hidden="true"></i>
    </button>

    <button id="manageUsers" class="settings-button">
      <i data-lucide="users" aria-hidden="true"></i>
      <span>Gerenciar contas e usuários</span>
      <i data-lucide="chevron-right" class="chev" aria-hidden="true"></i>
    </button>

    <button id="hubSettings" class="settings-button">
      <i data-lucide="sliders-horizontal" aria-hidden="true"></i>
      <span>Configurações de HUB</span>
      <i data-lucide="chevron-right" class="chev" aria-hidden="true"></i>
    </button>

    <button id="opDocs" class="settings-button">
      <i data-lucide="file-text" aria-hidden="true"></i>
      <span>Documentos operacionais</span>
      <i data-lucide="chevron-right" class="chev" aria-hidden="true"></i>
    </button>
  </div>
  `;
}

function userMenuView() {
  return `
  <div class="settings-list">
    <button id="myData" class="settings-button">
      <i data-lucide="id-card" aria-hidden="true"></i>
      <span>Minhas informações</span>
      <i data-lucide="chevron-right" class="chev" aria-hidden="true"></i>
    </button>
  </div>
  `;
}

/* ---------------------- BINDINGS ---------------------- */

function bindAdminMenu(root, api) {
  root.querySelector('#myData').onclick = () =>
    import('../modal.js').then(m => m.openModal({ type: 'profile' }));

  root.querySelector('#manageUsers').onclick = () =>
    import('../modal.js').then(m => m.openModal({ type: 'users' }));

  root.querySelector('#hubSettings').onclick = () =>
    import('../modal.js').then(m => m.openModal({ type: 'hub_settings' }));

  // vamos implementar depois — por enquanto só avisa ou não faz nada
  root.querySelector('#opDocs').onclick = () =>
    import('../modal.js').then(m => m.openModal({ type: 'opdocs' }));
}

function bindUserMenu(root, _api) {
  root.querySelector('#myData').onclick = () =>
    import('../modal.js').then(m => m.openModal({ type: 'profile' }));
}

/* ---------------------- UTILS ---------------------- */

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}
