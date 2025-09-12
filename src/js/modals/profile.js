// src/js/modals/profile.js
import { apiGet, apiPut } from '../api.js';
import { showConfirmAlert, showAlert } from '../utils/alerts.js';

export const meta = {
  title: 'Minhas informações',
  size: 'sm',
  showBack: true,
  showClose: true,
  backdropClose: true,
  escToClose: true,
  initialFocus: '#profile-root'
};

export default function render(_props = {}, api) {
  api.setBackTo('settings');

  const el = document.createElement('div');
  el.id = 'profile-root';
  el.className = 'profile-modal';
  el.innerHTML = loadingView();

  let role = 'user';
  let currentUser = '';
  let dirty = false;

  const state = {
    username: '',
    newUsername: '',
    newPass: '',
    confirmPass: ''
  };
  let initial = null;

  init().catch(err => {
    el.innerHTML = errorView(err?.message || 'Falha ao carregar.');
    if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
  });

  api.setBeforeClose(async () => {
    if (!dirty || !hasChanges()) return true;

    const wantSave = await showConfirmAlert({
      type: 'warning',
      title: 'Salvar alterações?',
      message: 'Deseja aplicar as mudanças nas suas informações?',
      okLabel: 'Salvar',
      cancelLabel: 'Descartar'
    });

    if (!wantSave) return true;

    try {
      await saveChanges();
      return true;
    } catch (e) {
      await showAlert({
        type: 'error',
        title: 'Falha ao salvar',
        message: e?.message || 'Erro inesperado.',
        durationMs: 3000
      });
      return false;
    }
  });

  return el;

  async function init() {
    const res = await apiGet('config'); // { ok, profile:{username, avatar_id, role} }
    role = String(res?.profile?.role || 'user').toLowerCase();
    currentUser = String(res?.profile?.username || '');
    state.username = currentUser;
    state.newUsername = currentUser;

    el.innerHTML = formView({ role, username: currentUser });
    bindForm(el);

    initial = snapshot(state);
    if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
  }

  function bindForm(root) {
    const $ = s => root.querySelector(s);

    const inputUser = $('#pf-username');
    const inputNew  = $('#pf-newpass');
    const inputConf = $('#pf-confpass');

    if (inputUser) {
      inputUser.disabled = role !== 'admin';
      inputUser.addEventListener('input', () => { state.newUsername = inputUser.value.trim(); markDirty(); });
    }
    if (inputNew)  inputNew.addEventListener('input',  () => { state.newPass     = inputNew.value;  markDirty(); });
    if (inputConf) inputConf.addEventListener('input', () => { state.confirmPass = inputConf.value; markDirty(); });

    root.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const order = [inputUser, inputNew, inputConf].filter(Boolean);
      const i = order.indexOf(document.activeElement);
      if (i >= 0 && i < order.length - 1) { e.preventDefault(); order[i + 1].focus(); }
    });
  }

  function hasChanges() {
    if (role === 'admin' && state.newUsername && state.newUsername !== state.username) return true;
    if (state.newPass || state.confirmPass) return true;
    return false;
  }

  async function saveChanges() {
    const wantsPw = !!(state.newPass || state.confirmPass);

    if (wantsPw) {
      if (state.newPass.length < 6) throw new Error('Nova senha deve ter pelo menos 6 caracteres.');
      if (state.newPass !== state.confirmPass) throw new Error('Confirmação de senha não confere.');
    }

    if (role === 'admin' && state.newUsername && state.newUsername !== state.username) {
      await apiPut(`users/${encodeURIComponent(state.username)}`, { new_username: state.newUsername });
      currentUser = state.newUsername;
      state.username = state.newUsername;
      try {
        const usernameEl = document.querySelector('.username');
        if (usernameEl) {
          usernameEl.textContent = state.newUsername;
        }
      } catch {}
    }

    if (wantsPw) {
      if (role === 'admin') {
        await apiPut(`users/${encodeURIComponent(currentUser)}`, { password: state.newPass });
      } else {
        await apiPut('profile/password', { new_password: state.newPass });
      }
    }

    initial = snapshot(state);
    dirty = false;

    await showAlert({
      type: 'success',
      title: 'Salvo',
      message: 'Informações atualizadas.',
      durationMs: 1600
    });
  }

  function markDirty() { dirty = true; }
}

/* --------------------- Views --------------------- */

function loadingView() {
  return `
    <div style="display:grid;place-items:center;height:20vh">
      <svg width="56" height="56" viewBox="0 0 24 24" aria-label="carregando">
        <style>.s{animation:spin .9s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style>
        <g class="s" transform-origin="12 12">
          <path d="M12 2a10 10 0 1 0 10 10" fill="none" stroke="var(--orange)" stroke-width="1"/>
        </g>
      </svg>
    </div>
  `;
}

function formView({ role, username }) {
  const isAdmin = role === 'admin';
  return `
    <div class="settings-list" style="display:grid;gap:24rem">
      <div class="setting-row">
        <div class="setting-label">Nome de usuário:</div>
        <div class="setting-control">
          <input id="pf-username" class="pill-input" type="text" value="${escapeHtml(username)}" />
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-label">Nova senha:</div>
        <div class="setting-control">
          <input id="pf-newpass" class="pill-input" type="password" autocomplete="new-password" placeholder="Digite a nova senha" />
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-label">Confirmar nova senha:</div>
        <div class="setting-control">
          <input id="pf-confpass" class="pill-input" type="password" autocomplete="new-password" placeholder="Repita a nova senha" />
        </div>
      </div>
    </div>
  `;
}

function errorView(msg) {
  return `
    <div style="display:grid;gap:16rem;place-items:center;text-align:center">
      <div style="font-weight:700">Erro</div>
      <div>${escapeHtml(msg)}</div>
      <button class="settings-button" onclick="location.reload()">
        <span>Tentar novamente</span>
      </button>
    </div>
  `;
}

/* --------------------- Utils --------------------- */
function snapshot(s) { return JSON.parse(JSON.stringify(s)); }
function escapeHtml(v){ const d=document.createElement('div'); d.textContent=String(v??''); return d.innerHTML; }
