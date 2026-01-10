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

  let dirty = false;

  const state = {
    username: '',
    changePwOpen: false,
    newPass: '',
    confirmPass: ''
  };

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
    // aqui só carrega dados. sem role/admin/user
    const res = await apiGet('config'); // { ok, profile:{username, avatar_id, role?} }
    state.username = String(res?.profile?.username || '');

    el.innerHTML = formView({ username: state.username, changePwOpen: state.changePwOpen });
    bindForm(el);

    if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
  }

  function bindForm(root) {
    const $ = s => root.querySelector(s);

    const inputUser = $('#pf-username');
    const btnChangePw = $('#pf-change-pw');
    const btnAvatar = $('#pf-avatar');

    // username SEMPRE bloqueado
    if (inputUser) inputUser.disabled = true;

    // Foto de perfil (abre modal avatar)
    if (btnAvatar) {
      btnAvatar.onclick = () => import('../modal.js').then(m => m.openModal({ type: 'avatar' }));
    }

    // Abrir área de senha
    if (btnChangePw) {
      btnChangePw.onclick = () => {
        state.changePwOpen = true;
        renderPwBlock(root);
        setTimeout(() => root.querySelector('#pf-newpass')?.focus(), 0);
      };
    }

    // Enter navega e salva senha no último campo
    root.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;

      const np = root.querySelector('#pf-newpass');
      const cp = root.querySelector('#pf-confpass');
      const sp = root.querySelector('#pf-save-pw');

      if (!np || !cp || !sp) return;

      const order = [np, cp];
      const i = order.indexOf(document.activeElement);

      if (i >= 0 && i < order.length - 1) {
        e.preventDefault();
        order[i + 1].focus();
        return;
      }

      if (document.activeElement === cp) {
        e.preventDefault();
        sp.click();
      }
    });

    function renderPwBlock(root) {
      const container = root.querySelector('#pf-pw-container');
      if (!container) return;

      container.innerHTML = pwBlockView({ open: state.changePwOpen });
      if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
      wirePwInputs(root);
    }

    function wirePwInputs(root) {
      const np = root.querySelector('#pf-newpass');
      const cp = root.querySelector('#pf-confpass');
      const sp = root.querySelector('#pf-save-pw');

      if (np) np.addEventListener('input', () => { state.newPass = np.value; markDirty(); syncSavePwBtn(root); });
      if (cp) cp.addEventListener('input', () => { state.confirmPass = cp.value; markDirty(); syncSavePwBtn(root); });

      if (sp) {
        syncSavePwBtn(root);
        sp.onclick = async () => {
          try {
            await savePasswordOnly();

            // fecha bloco e limpa
            state.changePwOpen = false;
            state.newPass = '';
            state.confirmPass = '';
            dirty = false;

            const container = root.querySelector('#pf-pw-container');
            if (container) container.innerHTML = pwBlockView({ open: false });
            if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
          } catch (e) {
            await showAlert({
              type: 'error',
              title: 'Falha ao salvar',
              message: e?.message || 'Erro inesperado.',
              durationMs: 3000
            });
          }
        };
      }
    }

    function syncSavePwBtn(root) {
      const sp = root.querySelector('#pf-save-pw');
      if (!sp) return;
      const wantsPw = !!(state.newPass || state.confirmPass);
      sp.disabled = !wantsPw;
    }
  }

  function hasChanges() {
    // só senha (e só se bloco foi aberto)
    return state.changePwOpen && (state.newPass || state.confirmPass);
  }

  async function savePasswordOnly() {
    if (state.newPass.length < 6) throw new Error('Nova senha deve ter pelo menos 6 caracteres.');
    if (state.newPass !== state.confirmPass) throw new Error('Confirmação de senha não confere.');

    // aqui é onde o backend valida permissões/autorização
    await apiPut('profile/password', { new_password: state.newPass });

    await showAlert({
      type: 'success',
      title: 'Salvo',
      message: 'Senha atualizada.',
      durationMs: 1600
    });
  }

  async function saveChanges() {
    // usado no beforeClose
    if (!hasChanges()) return;

    await savePasswordOnly();
    dirty = false;
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

function formView({ username, changePwOpen }) {
  return `
    <div class="settings-list">
      <div class="setting-row">
        <div class="setting-label">Login/User:</div>
        <div class="setting-control">
          <input id="pf-username" class="pill-input" type="text" value="${escapeHtml(username)}" disabled />
        </div>
      </div>

      <div id="pf-pw-container">
        ${pwBlockView({ open: !!changePwOpen })}
      </div>

      <button id="pf-avatar" class="settings-button">
        <i data-lucide="image" aria-hidden="true"></i>
        <span>Foto de perfil</span>
        <i data-lucide="chevron-right" class="chev" aria-hidden="true"></i>
      </button>
    </div>
  `;
}

function pwBlockView({ open }) {
  if (!open) {
    return `
      <button id="pf-change-pw" class="settings-button">
        <i data-lucide="key-round" aria-hidden="true"></i>
        <span>Alterar senha</span>
        <i data-lucide="chevron-right" class="chev" aria-hidden="true"></i>
      </button>
    `;
  }

  return `
    <div id="pf-pw-area">
      <div class="setting-row">
        <div class="setting-label">Nova senha:</div>
        <div class="setting-control">
          <input id="pf-newpass" class="pill-input" type="password" autocomplete="new-password" placeholder="Digite a nova senha" />
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-label">Confirmar:</div>
        <div class="setting-control">
          <input id="pf-confpass" class="pill-input" type="password" autocomplete="new-password" placeholder="Repita a nova senha" />
        </div>
      </div>

      <button id="pf-save-pw" class="save-pass-button" disabled>
        <i data-lucide="save" aria-hidden="true"></i>
        <span>Salvar senha</span>
      </button>
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
function escapeHtml(v){ const d=document.createElement('div'); d.textContent=String(v??''); return d.innerHTML; }
