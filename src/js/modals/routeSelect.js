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
  initialFocus: '#route-root',
};

export default function render(props = {}, api) {
  // --- estado ---------------------------------------------------------------
  const ranges = readRanges();
  const brCode = String(
    props.brCode || document.querySelector('.brcode-input')?.value || ''
  ).trim();

  const onClose = typeof props.onClose === 'function' ? props.onClose : null;

  const state = {
    step: 'letter',
    letter: '',
    numberStr: '',
  };

  api.setBack(_handle => {
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

  // 🔑 torna o root focável (para o initialFocus funcionar e para podermos forçar foco)
  el.tabIndex = -1;

  // --- teclado --------------------------------------------------------------
  const onKeyDown = ev => {
    // não interferir se o usuário estiver digitando em algum input/textarea
    const t = ev.target;
    const tag = (t?.tagName || '').toUpperCase();
    const isTypingField = tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable;

    if (isTypingField) return;

    // Ignora combinações com Ctrl/Alt/Meta (atalhos do navegador/sistema)
    if (ev.ctrlKey || ev.altKey || ev.metaKey) return;

    // ESC: deixa o modal lidar (escToClose)
    if (ev.key === 'Escape') return;

    // ENTER: confirma no passo número se válido
    if (ev.key === 'Enter' || ev.key === 'NumpadEnter') {
      if (state.step === 'number') {
        const canAdd = isValidRoute(state.letter, state.numberStr, ranges);
        if (canAdd) {
          ev.preventDefault();
          onAddClick();
        }
      }
      return;
    }

    // BACKSPACE / DELETE
    if (ev.key === 'Backspace' || ev.key === 'Delete') {
      ev.preventDefault();

      if (state.step === 'number') {
        if (state.numberStr) {
          state.numberStr = state.numberStr.slice(0, -1);
          paint();
        } else {
          // se não tem número, volta para letra
          state.step = 'letter';
          paint();
        }
      } else {
        // no passo letra: limpa letra
        if (state.letter) {
          state.letter = '';
          paint();
        }
      }
      return;
    }

    // LETRAS A-Z
    if (/^[a-zA-Z]$/.test(ev.key)) {
      const L = ev.key.toUpperCase();

      // Só aceita letra dentro do intervalo do HUB
      const code = L.charCodeAt(0);
      const inLetters =
        code >= ranges.letterFrom.charCodeAt(0) &&
        code <= ranges.letterTo.charCodeAt(0);

      if (!inLetters) return;

      ev.preventDefault();

      state.letter = L;
      state.step = 'number';
      paint();
      return;
    }

    // NÚMEROS 0-9
    if (/^\d$/.test(ev.key)) {
      if (state.step !== 'number') return;

      const next = (state.numberStr + ev.key).replace(/^0+(?=\d)/, '');
      if (!withinTypingRange(next, ranges.numMin, ranges.numMax)) return;

      ev.preventDefault();
      state.numberStr = next;
      paint();
      return;
    }
  };

  // registra quando abrir
  window.addEventListener('keydown', onKeyDown, { capture: true });

  // guarda o foco anterior, para devolver ao fechar (opcional, mas ajuda UX)
  const previouslyFocused = document.activeElement;

  // remove ao fechar (pra não acumular listeners)
  const _close = api.close.bind(api);
  api.close = reason => {
    window.removeEventListener('keydown', onKeyDown, { capture: true });

    try { onClose?.(reason); } catch {}

    return _close(reason);
  };

  paint();

  // ✅ força foco no modal (após entrar no DOM)
  // microtask > evita setTimeout e reduz flicker
  queueMicrotask(() => {
    try {
      el.focus({ preventScroll: true });
    } catch {
      try {
        el.focus();
      } catch {}
    }
  });

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
    const canAdd = isValidRoute(state.letter, state.numberStr, ranges);

    return `
      <div class="route-header">
        <div class="route-br-badge">${escapeHtml(brCode || '—')}</div>
        <div class="route-display ${
          state.step === 'letter' ? 'is-letter' : 'is-number'
        }">
          <span class="route-letter">${state.letter || ''}</span>
          <span class="route-dash">−</span>
          <span class="route-number">${state.numberStr || ''}</span>
        </div>
      </div>

      <div class="route-kbd">
        ${state.step === 'letter' ? letterKeys() : numberKeys(canAdd)}
      </div>
    `;
  }

  function letterKeys() {
    const letters = lettersFromRange(ranges.letterFrom, ranges.letterTo);
    return letters
      .map(
        L =>
          `<button class="route-key" data-k="${L}" aria-label="Letra ${L}">${L}</button>`
      )
      .join('');
  }

  function numberKeys(canAdd) {
    // Layout final da última linha: [Backspace] [0] [Adicionar]
    // -> Sem spacer, para ocupar as 3 colunas naturalmente
    return `
      <button class="route-key" data-k="1">1</button>
      <button class="route-key" data-k="2">2</button>
      <button class="route-key" data-k="3">3</button>
      <button class="route-key" data-k="4">4</button>
      <button class="route-key" data-k="5">5</button>
      <button class="route-key" data-k="6">6</button>
      <button class="route-key" data-k="7">7</button>
      <button class="route-key" data-k="8">8</button>
      <button class="route-key" data-k="9">9</button>

      <button class="route-key route-key--icon" data-act="backspace" aria-label="Apagar">
        <i data-lucide="delete"></i>
      </button>
      <button class="route-key" data-k="0">0</button>
      <button
        class="route-key route-key--icon route-key--add"
        data-act="add"
        aria-label="Adicionar pacote" ${canAdd ? '' : 'disabled'}>
        <i data-lucide="package-plus"></i>
      </button>
    `;
  }

  function bind() {
    // Como re-renderiza o innerHTML, o listener precisa ser re-registrado
    el.querySelector('.route-kbd')?.addEventListener('click', onKeyClick);
    // (Teclado do notebook está global em window para não depender de foco no modal)
  }

  function onKeyClick(e) {
    const btn = e.target.closest('.route-key');
    if (!btn || btn.disabled) return;

    if (state.step === 'letter') {
      const L = btn.dataset.k;
      if (!L) return;
      state.letter = L;
      state.step = 'number';
      paint();
      return;
    }

    // passo de número
    const act = btn.dataset.act;
    if (act === 'backspace') {
      state.numberStr = state.numberStr.slice(0, -1);
      paint();
      return;
    }
    if (act === 'add') {
      onAddClick();
      return;
    }

    const k = btn.dataset.k;
    if (!k) return;

    const next = (state.numberStr + k).replace(/^0+(?=\d)/, '');
    if (!withinTypingRange(next, ranges.numMin, ranges.numMax)) {
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
        message: 'Escolha uma letra e um número dentro do intervalo permitido.',
      });
      return;
    }

    const packageToAdd = {
      brCode,
      route: `${state.letter}-${parseInt(state.numberStr, 10)}`,
      datetime: new Date().toISOString(),
      userToken: localStorage.getItem('authToken'),
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
  let letterTo = toLetter(ltRaw, letterFrom);
  if (letterFrom.charCodeAt(0) > letterTo.charCodeAt(0)) {
    const t = letterFrom;
    letterFrom = letterTo;
    letterTo = t;
  }

  const [nMinRaw, nMaxRaw] = numberRange.split('-');
  let numMin = toInt(nMinRaw, 1);
  let numMax = toInt(nMaxRaw, numMin);
  if (numMin > numMax) {
    const t = numMin;
    numMin = numMax;
    numMax = t;
  }

  return { letterFrom, letterTo, numMin, numMax, maxPackages };
}

function lettersFromRange(from, to) {
  const a = from.charCodeAt(0),
    b = to.charCodeAt(0);
  const out = [];
  for (let i = a; i <= b; i++) out.push(String.fromCharCode(i));
  return out;
}

function withinTypingRange(str, min, max) {
  if (!str) return true;
  const n = Number(str);
  if (!Number.isFinite(n)) return false;
  const maxLen = String(max).length;
  if (str.length > maxLen) return false;
  return n <= max; // prefix válido enquanto não exceder o máximo
}

function isValidRoute(letter, numberStr, ranges) {
  if (!letter || !numberStr) return false;
  const L = letter.toUpperCase();
  const code = L.charCodeAt(0);
  const inLetters =
    code >= ranges.letterFrom.charCodeAt(0) && code <= ranges.letterTo.charCodeAt(0);

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
  const s = String(v || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  return s ? s[0] : d;
}
function escapeHtml(v) {
  const d = document.createElement('div');
  d.textContent = String(v ?? '');
  return d.innerHTML;
}
