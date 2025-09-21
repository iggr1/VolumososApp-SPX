const REGISTRY = new Map();
let CURRENT = null;
let BASE_PATH = './modals';
let CSS_PATH = './src/css/modals';
const BASE_CSS = './src/css/modal.css';
const STYLE_REGISTRY = new Map();

function sanitize(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
}
function ensureRoot() {
    let root = document.querySelector('.modal-root');
    if (!root) {
        root = document.createElement('div');
        root.className = 'modal-root';
        root.innerHTML = `<div class="modal-backdrop"></div><div class="modal-wrap"></div>`;
        document.body.appendChild(root);
    }
    return root;
}
function lockScroll(lock) {
    document.documentElement.style.overflow = lock ? 'hidden' : '';
}
function focusTrap(modalEl) {
    const sel = [
        'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
        'input:not([disabled])', 'select:not([disabled])', '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    const getNodes = () => Array.from(modalEl.querySelectorAll(sel)).filter(el => !el.hasAttribute('inert'));
    function onKey(e) {
        if (e.key !== 'Tab') return;
        const nodes = getNodes(); if (!nodes.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    modalEl.addEventListener('keydown', onKey);
    return () => modalEl.removeEventListener('keydown', onKey);
}
function uid() { return 'm' + Math.random().toString(36).slice(2, 9); }

export function define(type, render, meta = {}) {
    if (!type || typeof render !== 'function') throw new Error('define(type, renderFn)');
    REGISTRY.set(type, { render, meta });
}

async function ensureDefined(type) {
    if (REGISTRY.has(type)) return REGISTRY.get(type);
    const mod = await import(`${BASE_PATH}/${type}.js`);
    const render = mod.default;
    const meta = mod.meta || {};
    if (typeof render !== 'function') throw new Error(`Modal "${type}" não exporta default function`);
    define(type, render, meta);
    return REGISTRY.get(type);
}

function ensureBaseCss() {
    if (document.querySelector('link[data-modal-base="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = BASE_CSS;
    link.dataset.modalBase = 'true';
    document.head.appendChild(link);
}

async function ensureCss(type) {
    ensureBaseCss();

    if (STYLE_REGISTRY.has(type)) return STYLE_REGISTRY.get(type);

    const href = `${CSS_PATH}/${type}.css`;
    // evita duplicar se já existir no <head>
    const existing = [...document.querySelectorAll('link[rel="stylesheet"]')]
        .find(l => l.getAttribute('href') === href || l.dataset.modalStyle === type);
    if (existing) { STYLE_REGISTRY.set(type, existing); return existing; }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.modalStyle = type;

    const p = new Promise((resolve, reject) => {
        link.onload = () => resolve(link);
        link.onerror = () => {
            console.warn(`CSS do modal "${type}" não encontrado em ${href}`);
            resolve(link); // não bloqueia abertura do modal se falhar
        };
    });

    document.head.appendChild(link);
    await p;
    STYLE_REGISTRY.set(type, link);
    return link;
}

function buildModalDOM(opts, api) {
    const {
        title = '',
        showBack = true,
        showClose = true,
        size = 'md',
        iconColor = '#2266ff',
    } = opts;

    const root = ensureRoot();
    root.classList.add('show');
    const wrap = root.querySelector('.modal-wrap');

    const dialog = document.createElement('div');
    dialog.className = `modal modal--${size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md'}`;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const labelId = uid();
    dialog.setAttribute('aria-labelledby', labelId);

    dialog.innerHTML = `
    <div class="modal-header">
      <button class="modal-btn modal-back" aria-label="Voltar"${!showBack ? ' data-ghost="true" aria-hidden="true" tabindex="-1"' : ''}>
        <i data-lucide="arrow-left"></i>
      </button>
      <div id="${labelId}" class="modal-title">${sanitize(title)}</div>
      <button class="modal-btn modal-close" aria-label="Fechar"${!showClose ? ' data-ghost="true" aria-hidden="true" tabindex="-1"' : ''}>
        <i data-lucide="x"></i>
      </button>
    </div>
    <div class="modal-body"></div>
  `;
    wrap.appendChild(dialog);

    if (window.lucide?.createIcons) {
        lucide.createIcons({ attrs: { width: 22, height: 22, stroke: iconColor } });
    }

    requestAnimationFrame(() => dialog.classList.add('show'));

    const backBtn = dialog.querySelector('.modal-back');
    const closeBtn = dialog.querySelector('.modal-close');
    (backBtn?.hidden ? closeBtn : backBtn)?.focus();

    return { root, dialog, backBtn, closeBtn, body: dialog.querySelector('.modal-body') };
}

function renderContent(bodyEl, content, props, api) {
    bodyEl.textContent = '';
    const nodeOrHtml = typeof content === 'function' ? content(props, api) : content;
    if (nodeOrHtml instanceof Node) bodyEl.appendChild(nodeOrHtml);
    else if (typeof nodeOrHtml === 'string') bodyEl.innerHTML = nodeOrHtml; // use apenas suas strings
    else if (nodeOrHtml != null) bodyEl.textContent = String(nodeOrHtml);

    if (window.lucide?.createIcons) {
        lucide.createIcons({ attrs: { width: 22, height: 22 } });
    }
}

export function open(options = {}) {
  const {
    title = '', content = '', props = {},
    showBack = true, showClose = true, size = 'md',
    escToClose = true, backdropClose = true,
    onBack = null, onClose = null, onOpen = null,
    initialFocus = null, iconColor = '#2266ff',
  } = options;

  if (CURRENT?.el?.isConnected) {
    CURRENT.close('replace', { instant: true, bypassBefore: true });
  } else {
    document.querySelector('.modal-root')?.remove();
  }

  let backHandler = onBack;
  let beforeCloseHandler = null; // <- NOVO

  const api = { close, back, setTitle, setContent, setBack, setBackTo, swap, setBeforeClose };

  const { root, dialog, backBtn, closeBtn, body } =
    buildModalDOM({ title, showBack, showClose, size, iconColor }, api);

  const openedAt = performance.now();
  const untrap = focusTrap(dialog);
  renderContent(body, content, props, api);

  if (initialFocus) dialog.querySelector(initialFocus)?.focus();

  const prevActive = document.activeElement;
  lockScroll(true);

  function keyHandler(e) { if (e.key === 'Escape' && escToClose) close('escape'); }
  function backdropHandler(e) {
    if (!backdropClose) return;
    if (performance.now() - openedAt < 180) return;
    if (dialog.contains(e.target)) return;
    const bk = root.querySelector('.modal-backdrop');
    const wrap = root.querySelector('.modal-wrap');
    if (e.target === root || e.target === bk || e.target === wrap) close('backdrop');
  }
  document.addEventListener('keydown', keyHandler);
  root.addEventListener('click', backdropHandler);

  backBtn?.addEventListener('click', () => back());
  closeBtn?.addEventListener('click', () => close('close'));

  const handle = { el: dialog, close, back, setTitle, setContent, setBack, setBackTo, swap, setBeforeClose };
  CURRENT = handle;
  onOpen?.(handle);
  return handle;

  // ---- API exposta ----
  function setTitle(t){ dialog.querySelector('.modal-title').textContent = t ?? ''; }
  function setContent(c){ renderContent(body, c, props, api); }
  function setBack(fn){ backHandler = (typeof fn === 'function') ? fn : null; }
  function setBackTo(type, p = {}){ setBack(() => openModal({ type, props: p })); }
  function swap(type, p = {}){ return openModal({ type, props: p }); }
  function setBeforeClose(fn){ beforeCloseHandler = (typeof fn === 'function') ? fn : null; }

  async function runBeforeClose(reason){
    if (!beforeCloseHandler) return true;
    try {
      const ok = await Promise.resolve(beforeCloseHandler({ reason, dialog, api }));
      return ok !== false;
    } catch (e) {
      console.error('beforeClose error:', e);
      return false; // erro => não fecha
    }
  }

  async function back(){
    const ok = await runBeforeClose('back'); // <- pega Back
    if (!ok) return;
    if (typeof backHandler === 'function') { backHandler(handle); return; }
    await close('back', { bypassBefore: true }); // já passou no beforeClose
  }

  async function close(reason = 'manual', opts = {}){
    // opts: { instant = false, bypassBefore = false }

    if (!dialog.isConnected) return;
    if (!opts.bypassBefore) {
      const ok = await runBeforeClose(reason); // <- pega Esc/Close/Backdrop
      if (!ok) return; // bloquear fechamento em erro
    }

    document.removeEventListener('keydown', keyHandler);
    root.removeEventListener('click', backdropHandler);
    untrap();

    const backdrop = root.querySelector('.modal-backdrop');
    const finalize = () => {
      dialog.remove();
      CURRENT = null;
      document.querySelector('.modal-root')?.remove();
      lockScroll(false);
      try { prevActive?.focus(); } catch {}
      onClose?.(reason);
    };

    if (opts.instant) { finalize(); return; }

    dialog.classList.remove('show');
    await waitTransition(dialog, 220);
    root.classList.remove('show');
    await waitTransition(backdrop, 220);
    finalize();
  }
}

export async function openModal({ type, props = {}, overrides = {} } = {}) {

    if (!type) throw new Error('openModal requer { type }');

    const [{ render, meta }] = await Promise.all([
        ensureDefined(type),
        ensureCss(type)
    ]).then(([reg]) => [reg]);

    const opts = {
        title: meta.title ?? '',
        content: render,
        props,
        showBack: meta.showBack ?? true,
        showClose: meta.showClose ?? true,
        size: meta.size ?? 'md',
        escToClose: meta.escToClose ?? true,
        backdropClose: meta.backdropClose ?? true,
        initialFocus: meta.initialFocus ?? null,
        iconColor: meta.iconColor ?? '#2266ff',
        ...overrides,
    };
    return open(opts);
}

function waitTransition(el, ms = 250) {
    return new Promise((resolve) => {
        if (!el) return resolve();
        let done = false;
        const finish = () => { if (done) return; done = true; el.removeEventListener('transitionend', finish); resolve(); };
        el.addEventListener('transitionend', finish, { once: true });
        if (ms) setTimeout(finish, ms);
    });
}

window.openModal = openModal;
