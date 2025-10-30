import { apiGet, apiPut } from '../api.js';
import { showConfirmAlert, showAlert } from '../utils/alerts.js';

export const meta = {
  title: 'Configurações',
  size: 'sm',
  showBack: true,
  showClose: true,
  backdropClose: true,
  escToClose: true,
  initialFocus: '#settings-root'
};

export default function render(_props = {}, api) {
  api.setBackTo('menu');

  const el = document.createElement('div');
  el.id = 'settings-root';
  el.className = 'settings-modal';
  el.innerHTML = loadingView();

  init().catch((e) => {
    el.innerHTML = errorView(e?.message || 'Falha ao carregar dados.');
    if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
  });

  return el;

  async function init() {
    const res = await apiGet('config'); // { ok, profile{username,avatar_id,role}, hub? }
    const profile = res?.profile || {};
    const role = String(profile.role || '').toLowerCase();

    if (role === 'admin') {
      const hub = res?.hub || {};
      el.innerHTML = adminView();              // UI admin com 3 botões
      if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
      bindAdmin(el, api, hub);
    } else if (role === 'user') {
      el.innerHTML = userView(profile);        // UI user com 2 botões
      if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
      bindUser(el, api);
    } else if (role === 'guest' || !role) {
      el.innerHTML = errorView('Acesso negado: usuários convidados não podem acessar as configurações.');
      if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
    }
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

function adminView() {
  return `
  <div class="settings-list">
    <div class="setting-row">
      <div class="setting-label">Pacotes por pallet:</div>
      <div class="setting-control">
        <div class="stepper">
          <button class="step minus" aria-label="Diminuir" data-act="pallet-dec">−</button>
          <span class="step-val" id="palletVal">0</span>
          <button class="step plus" aria-label="Aumentar" data-act="pallet-inc">+</button>
        </div>
      </div>
    </div>

    <div class="setting-row">
      <div class="setting-label">Intervalo de letras:</div>
      <div class="setting-control">
        <div class="pill-range">
          <input id="letterStart" class="pill-input letter" inputmode="text" maxlength="1" value="" />
          <span class="dash">−</span>
          <input id="letterEnd" class="pill-input letter" inputmode="text" maxlength="1" value="" />
        </div>
      </div>
    </div>

    <div class="setting-row">
      <div class="setting-label">Intervalo numérico:</div>
      <div class="setting-control">
        <div class="pill-range">
          <input id="numStart" class="pill-input num" type="text" inputmode="numeric" pattern="[0-9]*" min="0" value="1" />
          <span class="dash">−</span>
          <input id="numEnd" class="pill-input num" type="text" inputmode="numeric" pattern="[0-9]*" min="0" value="1" />
        </div>
      </div>
    </div>

    <!-- Botões do admin: 1) Minhas info  2) Escolher foto  3) Gerenciar usuários -->
    <button id="myData" class="settings-button">
      <i data-lucide="id-card" aria-hidden="true"></i>
      <span>Minhas informações</span>
      <i data-lucide="chevron-right" class="chev" aria-hidden="true"></i>
    </button>

    <button id="changeAvatar" class="settings-button">
      <i data-lucide="image" aria-hidden="true"></i>
      <span>Escolher minha foto de perfil</span>
      <i data-lucide="chevron-right" class="chev" aria-hidden="true"></i>
    </button>

    <button id="manageUsers" class="settings-button">
      <i data-lucide="users" aria-hidden="true"></i>
      <span>Gerenciar contas e usuários</span>
      <i data-lucide="chevron-right" class="chev" aria-hidden="true"></i>
    </button>
  </div>
  `;
}

function userView(_profile) {
  return `
  <div class="settings-list">
    <!-- Botões do user: 1) Minhas info  2) Escolher foto -->
    <button id="myData" class="settings-button">
      <i data-lucide="id-card" aria-hidden="true"></i>
      <span>Minhas informações</span>
      <i data-lucide="chevron-right" class="chev" aria-hidden="true"></i>
    </button>

    <button id="changeAvatar" class="settings-button">
      <i data-lucide="image" aria-hidden="true"></i>
      <span>Escolher minha foto de perfil</span>
      <i data-lucide="chevron-right" class="chev" aria-hidden="true"></i>
    </button>
  </div>
  `;
}

/* ---------------------- BINDINGS ---------------------- */

function bindAdmin(root, api, hub) {
  let cfg = {
    max_packages: toInt(hub?.max_packages, 0),
    letter_from: toLetter((hub?.letter_range || '').split('-')[0], 'A'),
    letter_to: toLetter((hub?.letter_range || '').split('-')[1], 'A'),
    num_from: toInt((hub?.number_range || '').split('-')[0], 1),
    num_to: toInt((hub?.number_range || '').split('-')[1], 1),
  };
  let initial = { ...cfg };
  let dirty = false;

  const $ = (s) => root.querySelector(s);
  const palletVal = $('#palletVal');
  const letterStart = $('#letterStart');
  const letterEnd = $('#letterEnd');
  const numStart = $('#numStart');
  const numEnd = $('#numEnd');

  renderVals();

  root.addEventListener('click', (e) => {
    const act = e.target?.dataset?.act;
    if (!act) return;
    if (act === 'pallet-inc') cfg.max_packages = clamp(cfg.max_packages + 1, 1, 999);
    if (act === 'pallet-dec') cfg.max_packages = clamp(cfg.max_packages - 1, 1, 999);
    renderVals(); if (initial.max_packages !== cfg.max_packages) dirty = true;
  });

  makeEditableLetter(letterStart, () => cfg.letter_from, (v, prev) => { cfg.letter_from = v; renderVals(); if (v !== prev) dirty = true; });
  makeEditableLetter(letterEnd, () => cfg.letter_to, (v, prev) => { cfg.letter_to = v; renderVals(); if (v !== prev) dirty = true; });
  makeEditableNumber(numStart, () => cfg.num_from, (v, prev) => { cfg.num_from = v; fixNum(); renderVals(); if (v !== prev) dirty = true; });
  makeEditableNumber(numEnd, () => cfg.num_to, (v, prev) => { cfg.num_to = v; fixNum(); renderVals(); if (v !== prev) dirty = true; });

  function fixNum() { if (cfg.num_from > cfg.num_to) [cfg.num_from, cfg.num_to] = [cfg.num_to, cfg.num_from]; }
  function renderVals() {
    palletVal.textContent = cfg.max_packages;
    letterStart.value = cfg.letter_from;
    letterEnd.value = cfg.letter_to;
    numStart.value = cfg.num_from;
    numEnd.value = cfg.num_to;
  }

  // botões finais
  $('#myData').onclick = () => import('../modal.js').then(m => m.openModal({ type: 'profile' }));
  $('#changeAvatar').onclick = () => import('../modal.js').then(m => m.openModal({ type: 'avatar' }));
  $('#manageUsers').onclick = () => import('../modal.js').then(m => m.openModal({ type: 'users' }));

  // salvar somente ao sair
  api.setBeforeClose(async () => {
    if (!dirty || JSON.stringify(cfg) === JSON.stringify(initial)) return true;

    const wantSave = await showConfirmAlert({
      type: 'warning',
      title: 'Salvar alterações?',
      message: 'Você fez alterações nas configurações.',
      okLabel: 'Salvar',
      cancelLabel: 'Descartar'
    });

    if (!wantSave) return true;

    try {
      apiPut('config', {
        max_packages: cfg.max_packages,
        letter_range: `${cfg.letter_from}-${cfg.letter_to}`,
        number_range: `${cfg.num_from}-${cfg.num_to}`
      });
      initial = { ...cfg };
      dirty = false;
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
}

function bindUser(root, _api) {
  root.querySelector('#myData').onclick =
    () => import('../modal.js').then(m => m.openModal({ type: 'profile' }));
  root.querySelector('#changeAvatar').onclick =
    () => import('../modal.js').then(m => m.openModal({ type: 'avatar' }));
}

/* ---------------------- INPUT HELPERS ---------------------- */

function makeEditableLetter(inputEl, getVal, setVal) {
  inputEl.setAttribute('autocapitalize', 'characters');
  inputEl.addEventListener('focus', () => {
    inputEl.dataset.prev = getVal();
    inputEl.value = '';
    setTimeout(() => { inputEl.focus(); inputEl.select?.(); }, 0);
  });
  inputEl.addEventListener('input', () => {
    const v = inputEl.value.toUpperCase().replace(/[^A-Z]/g, '');
    inputEl.value = v.slice(0, 1);
  });
  inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') inputEl.blur(); });
  inputEl.addEventListener('blur', () => {
    const prev = inputEl.dataset.prev ?? getVal();
    let v = inputEl.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1);
    if (!v) v = prev;
    setVal(v, prev);
    delete inputEl.dataset.prev;
  });
}

function makeEditableNumber(inputEl, getVal, setVal) {
  inputEl.addEventListener('focus', () => {
    inputEl.dataset.prev = String(getVal());
    inputEl.value = '';
    setTimeout(() => { inputEl.focus(); inputEl.select?.(); }, 0);
  });
  inputEl.addEventListener('input', () => {
    const v = inputEl.value.replace(/\D/g, '');
    inputEl.value = v;
  });
  inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') inputEl.blur(); });
  inputEl.addEventListener('blur', () => {
    const prevStr = inputEl.dataset.prev ?? String(getVal());
    const prevNum = toInt(prevStr, 0);
    let vStr = inputEl.value.replace(/\D/g, '');
    if (!vStr) {
      setVal(prevNum, prevNum);
    } else {
      let v = toInt(vStr, prevNum);
      if (v < 0) v = 0;
      setVal(v, prevNum);
    }
    delete inputEl.dataset.prev;
  });
}

/* ---------------------- UTILS ---------------------- */

function clamp(v, a, b) { return Math.max(a, Math.min(b, Number(v) || 0)); }
function toInt(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; }
function toLetter(v, d) { const s = String(v || '').toUpperCase().replace(/[^A-Z]/g, ''); return s ? s[0] : d; }
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = String(s ?? ''); return d.innerHTML; }