// src/js/modals/users.js
import { apiGet, apiPost } from '../api.js';
import { showAlert, showConfirmAlert } from '../utils/alerts.js';

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
      .filter(u => !q
      || String(u.username).toLowerCase().includes(q)
      || String(u.role).toLowerCase().includes(q)
      || String(u.status || '').toLowerCase().includes(q)
    );

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
      const status = String(u.status || 'active').toLowerCase();
      const avId = String(u.avatar_id || '0');

      const roleClass = role === 'admin' ? 'is-admin' : 'is-user';

      const statusLabel =
        status === 'pending' ? 'pendente' :
        status === 'inactive' ? 'inativo' :
        'ativo';

      const statusClass =
        status === 'pending' ? 'is-pending' :
        status === 'inactive' ? 'is-inactive' :
        'is-active';

      const actionBtn = status === 'pending'
        ? `<button class="user-action user-action--allow" data-action="activate" data-username="${esc(u.username)}" type="button">
            <i data-lucide="badge-check"></i><span>Permitir</span>
          </button>`
        : status === 'inactive'
          ? `<button class="user-action user-action--activate" data-action="activate" data-username="${esc(u.username)}" type="button">
              <i data-lucide="power"></i><span>Ativar</span>
            </button>`
          : '';

      return `
        <div class="user-row" data-user='${esc(JSON.stringify(u))}'>
          <div class="user-left">
            <img class="user-avatar" alt="" src="./src/assets/img/profile-images/${avId}.jpg" />
            <div class="user-main">
              <div class="user-name">${name}</div>
              <div class="user-meta">
                <span class="role-badge ${roleClass}">${role}</span>
                <span class="status-badge ${statusClass}">${statusLabel}</span>
              </div>
            </div>
          </div>

          <div class="user-right">
            ${actionBtn}
            <i data-lucide="chevron-right"></i>
          </div>
        </div>
      `;
    }).join('');


    listEl.classList.remove('users-list--loading');
    listEl.innerHTML = rows;

    // Ações (permitir/ativar)
    listEl.querySelectorAll('.user-action').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        const username = btn.dataset.username || '';
        const action = btn.dataset.action || '';

        const label = btn.classList.contains('user-action--allow') ? 'Permitir' : 'Ativar';
        const ok = await showConfirmAlert({
          type: 'info',
          title: `${label} usuário`,
          message: `Tem certeza que deseja ${label.toLowerCase()} o usuário ${esc(username)}?`,
          confirmText: label,
          cancelText: 'Cancelar',
        });

        if (!ok) return;

        btn.disabled = true;
        btn.classList.add('is-loading');

        try {
          await apiPost('users/action', { username, action });
          await load();

          showAlert({
            type: 'success',
            title: 'Sucesso',
            message: `Usuário ${esc(username)} ativo com sucesso.`,
            durationMs: 3000
          });
        } catch (e) {
          btn.disabled = false;
          btn.classList.remove('is-loading');
          alert(e?.message || 'Falha ao executar ação.');
        }
      });
    });


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
