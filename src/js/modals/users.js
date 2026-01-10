// src/js/modals/users.js
import { apiGet } from '../api.js';

export const meta = {
  title: 'Usuários',
  size: 'lg',
  showBack: true,
  showClose: true,
  backdropClose: true,
  escToClose: true,
};

export default function render(_props = {}, api) {
  api.setBackTo('settings');

  const el = document.createElement('div');
  el.className = 'users-modal';
  el.innerHTML = `
    <div class="users-toolbar">
      <input id="users-search" class="users-search" type="search" placeholder="Buscar usuário..." />
      <button id="users-refresh" class="users-btn" aria-label="Atualizar">
        <i data-lucide="refresh-ccw"></i>
      </button>
    </div>

    <div class="users-list users-list--loading" id="users-list">
      <div class="users-skel">
        <div class="sk-row"></div>
        <div class="sk-row"></div>
        <div class="sk-row"></div>
        <div class="sk-row"></div>
      </div>
    </div>
  `;

  if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });

  const $ = s => el.querySelector(s);
  const searchEl = $('#users-search');
  const listEl = $('#users-list');

  let raw = [];
  let q = '';

  init();

  searchEl.addEventListener('input', () => {
    q = searchEl.value.trim().toLowerCase();
    renderList();
  });

  $('#users-refresh').addEventListener('click', load);

  return el;

  async function init() {
    await load();
  }

  async function load() {
    listEl.classList.add('users-list--loading');
    listEl.innerHTML = skeleton();
    try {
      // espera que o backend tenha GET /users -> [{username, role, created_at, avatar_id}]
      const data = await apiGet('users');
      raw = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : []);
    } catch (e) {
      raw = [];
      listEl.innerHTML = `<div class="users-empty">
        <i data-lucide="shield-alert"></i>
        <div>Não foi possível listar usuários.</div>
        <small>${e?.message || ''}</small>
      </div>`;
      if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
      return;
    }
    renderList();
  }

  function renderList() {
    const items = raw
      .slice()
      .sort((a, b) => String(a.username).localeCompare(String(b.username)))
      .filter(u => !q || String(u.username).toLowerCase().includes(q) || String(u.role).toLowerCase().includes(q));

    if (!items.length) {
      listEl.classList.remove('users-list--loading');
      listEl.innerHTML = `<div class="users-empty">
        <i data-lucide="users"></i>
        <div>Nenhum usuário encontrado</div>
      </div>`;
      if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
      return;
    }

    const rows = items.map(u => {
      const name = esc(u.username);
      const role = esc(u.role || '');
      const avId = String(u.avatar_id || '0');
      return `
        <button class="user-row" data-user='${esc(JSON.stringify(u))}'>
          <img class="user-avatar" alt="" src="./src/assets/img/profile-images/${avId}.jpg" />
          <div class="user-main">
            <div class="user-name">${name}</div>
            <div class="user-meta">
              <span class="role-badge ${role === 'admin' ? 'is-admin' : 'is-user'}">${role}</span>
            </div>
          </div>
          <i data-lucide="chevron-right" class="chev"></i>
        </button>
      `;
    }).join('');

    listEl.classList.remove('users-list--loading');
    listEl.innerHTML = rows;

    listEl.querySelectorAll('.user-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = JSON.parse(btn.dataset.user || '{}');
        openEditor({ mode: 'edit', user: u });
      });
    });

    if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
  }

  function openEditor(props) {
    import('../modal.js').then(m => m.openModal({ type: 'userEdit', props: {
      ...props,
      onChanged: () => load()
    }}));
  }

  function skeleton() {
    return `<div class="users-skel">
      <div class="sk-row"></div><div class="sk-row"></div><div class="sk-row"></div><div class="sk-row"></div>
    </div>`;
  }

  function esc(v){ const d=document.createElement('div'); d.textContent=String(v??''); return d.innerHTML; }
}
