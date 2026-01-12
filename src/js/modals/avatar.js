import { showConfirmAlert, showAlert } from '../utils/alerts.js';
import { fetchConfig } from '../utils/config.js';
import { updateAvatar } from '../utils/user.js';

export const meta = {
  title: 'Escolher foto de perfil',
  size: 'sm',
  showBack: true,
  showClose: true,
  backdropClose: true,
  escToClose: true,
  initialFocus: '#avatar-root',
};

export default function render(_props = {}, api) {
  api.setBackTo('settings');

  const el = document.createElement('div');
  el.id = 'avatar-root';
  el.className = 'avatar-modal';
  el.innerHTML = loadingView();

  const avatarImg = document.querySelector('img.avatar');
  let currentIdPath = avatarImg ? avatarImg.src : '';
  let currentId = toId(currentIdPath?.match(/profile-images\/(\d+)\.jpg$/)?.[1]);
  let selectedId = currentId;
  let dirty = false;

  init().catch(e => {
    el.innerHTML = errorView(e?.message || 'Falha ao carregar seu perfil.');
    if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
  });

  // confirma ao sair (back, esc, x, backdrop)
  api.setBeforeClose(async () => {
    if (!dirty || selectedId === currentId) return true;

    const wantSave = await showConfirmAlert({
      type: 'warning',
      title: 'Salvar nova foto?',
      message: 'Deseja aplicar esta foto de perfil?',
      okLabel: 'Salvar',
      cancelLabel: 'Descartar',
    });

    if (!wantSave) return true;

    try {
      await updateAvatar(selectedId);
      currentId = selectedId;
      dirty = false;

      const avatarImg = document.querySelector('.avatar img');
      if (avatarImg) {
        avatarImg.src = `./src/assets/img/profile-images/${selectedId}.jpg`;
      }

      return true;
    } catch (e) {
      await showAlert({
        type: 'error',
        title: 'Falha ao salvar',
        message: e?.message || 'Erro inesperado.',
        durationMs: 3000,
      });
      return false;
    }
  });

  return el;

  async function init() {
    // garante id atual do servidor
    try {
      const res = await fetchConfig();
      const pid = toId(res?.profile?.avatar_id ?? currentId);
      currentId = pid;
      selectedId = pid;
    } catch {}

    // monta grid
    const ids = AVATAR_IDS;
    el.innerHTML = gridView(ids, selectedId);

    const grid = el.querySelector('.avatar-grid');
    grid.addEventListener('click', onPick);
    grid.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const btn = e.target?.closest?.('.avatar-item');
        if (btn) {
          e.preventDefault();
          pick(btn);
        }
      }
    });

    if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
    // foco no selecionado
    el.querySelector('.avatar-item[aria-selected="true"]')?.focus();
  }

  function onPick(e) {
    const btn = e.target?.closest?.('.avatar-item');
    if (!btn) return;
    pick(btn);
  }

  function pick(btn) {
    const id = toId(btn.dataset.id);
    if (id === selectedId) return;
    selectedId = id;
    dirty = selectedId !== currentId;

    // atualiza seleção visual
    el.querySelectorAll('.avatar-item').forEach(b => {
      const sel = toId(b.dataset.id) === selectedId;
      b.classList.toggle('selected', sel);
      b.setAttribute('aria-selected', sel ? 'true' : 'false');
    });
  }
}

/* ---------------------- VIEWS ---------------------- */

const AVATAR_IDS = Array.from({ length: 185 }, (_, i) => i); // ajuste conforme disponível

function gridView(ids, selected) {
  const items = ids
    .map(id => {
      const sel = Number(id) === Number(selected);
      return `
      <button class="avatar-item${sel ? ' selected' : ''}" 
              role="option" aria-selected="${sel ? 'true' : 'false'}"
              data-id="${id}" tabindex="0">
        <img src="./src/assets/img/profile-images/${id}.jpg" alt="Avatar ${id}" />
        <i data-lucide="check-circle-2" class="checkmark" aria-hidden="true"></i>
      </button>
    `;
    })
    .join('');

  return `
    <div class="avatar-explain" style="margin-bottom:24rem;color:var(--dark-gray);font-size:var(--text-small)">
      Toque para selecionar sua nova foto de perfil.
    </div>
    <div class="avatar-grid" role="listbox" aria-label="Escolha um avatar">
      ${items}
    </div>
  `;
}

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
      <button class="settings-button" onclick="location.reload()">
        <span>Tentar novamente</span>
      </button>
    </div>
  `;
}

/* ---------------------- UTILS ---------------------- */
function toId(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}
function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}
