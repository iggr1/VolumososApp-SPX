// hubPicker.js
//
// Uso esperado:
// import { initHubPicker } from './hubPicker.js';
//
// const pickerLogin = initHubPicker({
//   rootEl: modalEl.querySelector('[data-hub-picker]'),
//   hubs: hubsArray,
//   savedHubId: localStorage.getItem('preferredHub') || ''
// });
//
// pickerLogin.onChange((hub) => {
//   console.log('hub escolhido', hub);
//   localStorage.setItem('preferredHub', hub.id);
// });

export function initHubPicker({ rootEl, hubs, savedHubId = '' }) {
  if (!rootEl) throw new Error('rootEl obrigatório em initHubPicker');

  const nativeSelect = rootEl.querySelector('.hub-native-select');
  const displayBtn   = rootEl.querySelector('[data-hub-display]');
  const displayLbl   = rootEl.querySelector('[data-hub-display-label]');
  const listEl       = rootEl.querySelector('[data-hub-list]');

  if (!nativeSelect || !displayBtn || !displayLbl || !listEl) {
    throw new Error('markup inválido para HubPicker');
  }

  // estado interno
  let isOpen = false;
  let activeIndex = -1;
  let currentValue = '';

  // monta <option> dentro do <select> nativo + <li> na lista custom
  function buildOptions() {
    // limpa
    nativeSelect.innerHTML = '';
    listEl.innerHTML = '';

    // placeholder sempre primeiro
    const placeholderOpt = document.createElement('option');
    placeholderOpt.value = '';
    placeholderOpt.disabled = true;
    placeholderOpt.selected = true;
    placeholderOpt.textContent = 'Selecione uma opção';
    nativeSelect.appendChild(placeholderOpt);

    hubs.forEach((hub, idx) => {
      // option nativo
      const opt = document.createElement('option');
      opt.value = hub.id; // ex: "LSC-05"
      opt.textContent = hub.name; // ex: "LSC-05 • Chapecó (LM Hub SC)"
      nativeSelect.appendChild(opt);

      // item visual
      const li = document.createElement('li');
      li.className = 'hub-option';
      li.id = makeOptionId(hub.id);
      li.setAttribute('role', 'option');
      li.setAttribute('data-index', String(idx));
      li.setAttribute('data-value', hub.id);
      li.setAttribute('tabindex', '-1');

      // conteúdo principal/secundário (ajusta aqui de acordo com teu hubs.json)
      const main = document.createElement('div');
      main.className = 'hub-option-main';
      main.textContent = hub.name;

      const sub = document.createElement('div');
      sub.className = 'hub-option-sub';
      sub.textContent = hub.desc || hub.region || ''; // opcional

      li.appendChild(main);
      if (sub.textContent.trim() !== '') {
        li.appendChild(sub);
      }

      li.addEventListener('click', () => {
        if (li.getAttribute('aria-disabled') === 'true') return;
        pickByIndex(idx);
        closeList();
        displayBtn.focus();
      });

      listEl.appendChild(li);
    });
  }

  function makeOptionId(value) {
    return `hub-opt-${value.replace(/\s+/g, '_')}`;
  }

  function openList() {
    if (isOpen) return;
    isOpen = true;
    listEl.hidden = false;
    displayBtn.setAttribute('aria-expanded', 'true');

    // define activeIndex no item selecionado atual, senão 0
    const selIdx = findIndexByValue(currentValue);
    setActiveIndex(selIdx >= 0 ? selIdx : 0);

    // foca a UL pra receber setas
    listEl.focus({ preventScroll: true });
  }

  function closeList() {
    if (!isOpen) return;
    isOpen = false;
    listEl.hidden = true;
    displayBtn.setAttribute('aria-expanded', 'false');
    listEl.removeAttribute('aria-activedescendant');
  }

  function toggleList() {
    if (isOpen) closeList(); else openList();
  }

  function setActiveIndex(idx) {
    const opts = getOptionEls();
    if (!opts.length) {
        activeIndex = -1;
        return;
    }
    if (idx < 0) idx = 0;
    if (idx >= opts.length) idx = opts.length - 1;
    activeIndex = idx;

    opts.forEach((li, i) => {
      if (i === activeIndex) {
        li.setAttribute('data-active', 'true');
        listEl.setAttribute('aria-activedescendant', li.id);
        ensureVisible(li, listEl);
      } else {
        li.removeAttribute('data-active');
      }
    });
  }

  function getOptionEls() {
    return Array.from(listEl.querySelectorAll('.hub-option'));
  }

  function findIndexByValue(val) {
    const opts = getOptionEls();
    return opts.findIndex(li => li.getAttribute('data-value') === val);
  }

  function pickByIndex(idx) {
    const opts = getOptionEls();
    if (!opts[idx]) return;
    const li = opts[idx];
    const val = li.getAttribute('data-value');
    const labelText = li.querySelector('.hub-option-main')?.textContent?.trim() || val;

    // atualiza estado interno
    currentValue = val;

    // atualiza nativo
    nativeSelect.value = val;

    // atualiza visual (texto no botão)
    displayLbl.textContent = labelText;
    displayBtn.dataset.placeholder = 'false';

    // marca selecionado
    opts.forEach(o => o.removeAttribute('data-selected'));
    li.setAttribute('data-selected', 'true');

    // dispara callback externa
    callbacks.forEach(fn => fn(getCurrentHub()));
  }

  function getCurrentHub() {
    return hubs.find(h => h.id === currentValue) || null;
  }

  function ensureVisible(child, container) {
    const cTop = container.scrollTop;
    const cBot = cTop + container.clientHeight;
    const oTop = child.offsetTop;
    const oBot = oTop + child.offsetHeight;
    if (oTop < cTop) {
      container.scrollTop = oTop;
    } else if (oBot > cBot) {
      container.scrollTop = oBot - container.clientHeight;
    }
  }

  // Eventos de teclado no botão fechado
  displayBtn.addEventListener('click', toggleList);

  displayBtn.addEventListener('keydown', (ev) => {
    switch (ev.key) {
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        ev.preventDefault();
        openList();
        break;
      default:
        // nada
        break;
    }
  });

  // Eventos de teclado na lista aberta
  listEl.addEventListener('keydown', (ev) => {
    switch (ev.key) {
      case 'ArrowDown':
        ev.preventDefault();
        setActiveIndex(activeIndex + 1);
        break;
      case 'ArrowUp':
        ev.preventDefault();
        setActiveIndex(activeIndex - 1);
        break;
      case 'Home':
        ev.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        ev.preventDefault();
        setActiveIndex(getOptionEls().length - 1);
        break;
      case 'Enter':
        ev.preventDefault();
        pickByIndex(activeIndex);
        closeList();
        displayBtn.focus();
        break;
      case 'Escape':
        ev.preventDefault();
        closeList();
        displayBtn.focus();
        break;
      case 'Tab':
        // deixa o Tab sair naturalmente, mas fecha
        closeList();
        break;
      default:
        break;
    }
  });

  // Fecha se clicar fora
  document.addEventListener('mousedown', (ev) => {
    if (!rootEl.contains(ev.target)) {
      closeList();
    }
  });

  // monta tudo inicialmente
  buildOptions();

  // se existir um savedHubId, aplica
  if (savedHubId) {
    const idx = findIndexByValue(savedHubId);
    if (idx >= 0) {
      pickByIndex(idx);
    } else {
      // não achou o salvo, deixa placeholder
      displayBtn.dataset.placeholder = 'true';
    }
  } else {
    // nenhum salvo ainda
    displayBtn.dataset.placeholder = 'true';
  }

  // lista de callbacks externos
  const callbacks = [];

  function onChange(fn) {
    if (typeof fn === 'function') callbacks.push(fn);
  }

  return {
    onChange,
    getValue() {
      return currentValue;
    },
    setValue(hubId) {
      const idx = findIndexByValue(hubId);
      if (idx >= 0) pickByIndex(idx);
    },
    focus() {
      displayBtn.focus();
    }
  };
}
