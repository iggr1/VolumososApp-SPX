// src/js/modals/routeSelect.js
import { showAlert } from '../utils/alerts.js';
import { sendToLocalPallet } from '../utils/pallet.js';

export const meta = {
  title: 'Seleção de rota',
  size: 'sm',
  showBack: true,
  showClose: true,
  backdropClose: true,
  escToClose: true,
  initialFocus: '#route-root'
};

export default function render(props = {}, api) {
  // --- estado ---------------------------------------------------------------
  const ranges = readRanges();
  const brCode =
    String(props.brCode || document.querySelector('.brcode-input')?.value || '').trim();

  const state = {
    step: 'letter',
    letter: '',
    numberStr: '',
  };

  api.setBack((_handle) => {
    if (state.step === 'number') {
      state.step = 'letter';
      paint();
    } else {
      api.close('back');
    }
  });

  // --- DOM ------------------------------------------------------------------
  const el = document.createElement('div');
  el.id = 'route-root';
  el.className = 'route-select-modal';

  paint();
  return el;

  // ===== helpers de render ==================================================
  function paint() {
    el.innerHTML = template();
    bind();
    if (window.lucide?.createIcons) {
      lucide.createIcons({ attrs: { width: 22, height: 22 } });
    }
  }

  function template() {
    const routeStr = displayRoute(state.letter, state.numberStr);
    const canAdd = isValidRoute(state.letter, state.numberStr, ranges);

    return `
      <div class="route-header">
        <div class="route-br-badge">${escapeHtml(brCode || '—')}</div>
        <div class="route-display ${state.step === 'letter' ? 'is-letter' : 'is-number'}">
          <span class="route-letter">${state.letter || ''}</span>
          <span class="route-dash">−</span>
          <span class="route-number">${state.numberStr || ''}</span>
        </div>
      </div>

      <div class="route-kbd">
        ${state.step === 'letter' ? letterKeys() : numberKeys()}
      </div>

      <div class="route-footer">
        <button class="route-btn route-btn--primary" id="route-add" ${canAdd ? '' : 'disabled'}>
          <i data-lucide="forklift" aria-hidden="true"></i>
          <span>ADICIONAR PACOTE</span>
        </button>
      </div>
    `;
  }

  function letterKeys() {
    const letters = lettersFromRange(ranges.letterFrom, ranges.letterTo);
    // grid em 3 colunas; apenas gera os botões necessários
    return letters
      .map(
        (L) => `<button class="route-key" data-k="${L}" aria-label="Letra ${L}">${L}</button>`
      )
      .join('');
  }

  function numberKeys() {
    // keypad 1..9 / 0 + backspace
    const nums = ['1','2','3','4','5','6','7','8','9','0'];
    const grid = `
      <button class="route-key" data-k="1">1</button>
      <button class="route-key" data-k="2">2</button>
      <button class="route-key" data-k="3">3</button>
      <button class="route-key" data-k="4">4</button>
      <button class="route-key" data-k="5">5</button>
      <button class="route-key" data-k="6">6</button>
      <button class="route-key" data-k="7">7</button>
      <button class="route-key" data-k="8">8</button>
      <button class="route-key" data-k="9">9</button>
      <div class="route-key route-key--spacer" aria-hidden="true"></div>
      <button class="route-key" data-k="0">0</button>
      <button class="route-key route-key--icon" data-act="backspace" aria-label="Apagar">
        <i data-lucide="delete"></i>
      </button>
    `;
    return grid;
  }

  function bind() {
    // clique nas teclas
    el.querySelector('.route-kbd')?.addEventListener('click', onKeyClick);
    // adicionar
    el.querySelector('#route-add')?.addEventListener('click', onAddClick);
  }

  function onKeyClick(e) {
    const btn = e.target.closest('.route-key');
    if (!btn) return;

    if (state.step === 'letter') {
      const L = btn.dataset.k;
      if (!L) return;
      state.letter = L;
      // avança para números
      state.step = 'number';
      paint();
      return;
    }

    // step number
    if (btn.dataset.act === 'backspace') {
      state.numberStr = state.numberStr.slice(0, -1);
      paint();
      return;
    }
    const k = btn.dataset.k;
    if (!k) return;

    // concatena e checa range dinamicamente (não deixa passar do máximo)
    const next = (state.numberStr + k).replace(/^0+(?=\d)/, ''); // evita zeros à esquerda
    if (!withinTypingRange(next, ranges.numMin, ranges.numMax)) {
      // permitir que o usuário continue digitando e só valide no fim? aqui já bloqueamos
      // para seguir o layout/UX do keypad, apenas ignoramos fora de range
      return;
    }
    state.numberStr = next;
    paint();
  }

  async function onAddClick() {
    if (!isValidRoute(state.letter, state.numberStr, ranges)) {
      await showAlert({
        type: 'warning',
        title: 'Rota inválida',
        message: 'Escolha uma letra e um número dentro do intervalo permitido.'
      });
      return;
    }

    const packageToAdd = {
      brCode,
      route: `${state.letter}-${parseInt(state.numberStr, 10)}`,
      datetime: new Date().toISOString(),
      userToken: sessionStorage.getItem('authToken')
    };

    sendToLocalPallet(packageToAdd);

    showAlert({
      type: 'success',
      title: 'Adicionado ao pallet',
      message: `Pacote ${displayRoute(state.letter, state.numberStr)} adicionado ao pallet.`,
      buttons: [],
      durationMs: 1000,
      dismissible: false,
      collapseDelayMs: 100,
    });

    api.close('submit');
  }
}

/* ===================== utils ===================== */

function readRanges() {
  const letterRange = (localStorage.getItem('letterRange') || 'A-G').toUpperCase();
  const numberRange = String(localStorage.getItem('numberRange') || '1-40');
  const maxPackages = toInt(localStorage.getItem('maxPackages'), 14);

  const [lfRaw, ltRaw] = letterRange.split('-');
  let letterFrom = toLetter(lfRaw, 'A');
  let letterTo   = toLetter(ltRaw, letterFrom);
  // normaliza caso venham invertidas
  if (letterFrom.charCodeAt(0) > letterTo.charCodeAt(0)) {
    const t = letterFrom; letterFrom = letterTo; letterTo = t;
  }

  const [nMinRaw, nMaxRaw] = numberRange.split('-');
  let numMin = toInt(nMinRaw, 1);
  let numMax = toInt(nMaxRaw, numMin);
  if (numMin > numMax) { const t = numMin; numMin = numMax; numMax = t; }

  return { letterFrom, letterTo, numMin, numMax, maxPackages };
}

function lettersFromRange(from, to) {
  const a = from.charCodeAt(0), b = to.charCodeAt(0);
  const out = [];
  for (let i = a; i <= b; i++) out.push(String.fromCharCode(i));
  return out;
}

function withinTypingRange(str, min, max) {
  if (!str) return true;
  const n = Number(str);
  if (!Number.isFinite(n)) return false;
  // não permitir mais dígitos do que o máximo possui
  const maxLen = String(max).length;
  if (str.length > maxLen) return false;
  // se ainda não formou um número completo, aceitar prefixos que possam resultar válidos
  // regra simples: n <= max e (str sem digitos -> ok)
  return n <= max;
}

function isValidRoute(letter, numberStr, ranges) {
  if (!letter || !numberStr) return false;
  const L = letter.toUpperCase();
  const code = L.charCodeAt(0);
  const inLetters =
    code >= ranges.letterFrom.charCodeAt(0) &&
    code <= ranges.letterTo.charCodeAt(0);

  const n = Number(numberStr);
  const inNumbers = Number.isFinite(n) && n >= ranges.numMin && n <= ranges.numMax;

  return inLetters && inNumbers;
}

function displayRoute(letter, numberStr) {
  const l = letter || '–';
  const n = numberStr || '–';
  return `${l} - ${n}`;
}

function toInt(v, d) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
}
function toLetter(v, d) {
  const s = String(v || '').toUpperCase().replace(/[^A-Z]/g, '');
  return s ? s[0] : d;
}
function escapeHtml(v) {
  const d = document.createElement('div');
  d.textContent = String(v ?? '');
  return d.innerHTML;
}

