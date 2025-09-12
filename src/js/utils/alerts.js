// Cores e ícones
const ALERT_COLORS = {
    success: '#28a745',
    error: '#dc3545',
    warning: '#ffc107',
    info: '#2266ff',
};
const ALERT_ICONS = {
    success: 'circle-check-big',
    error: 'ban',
    warning: 'triangle-alert',
    info: 'info',
};

let ALERTS_CSS_HREF = new URL('../../css/alerts.css', import.meta.url).href;
let cssReady = null;

export function configAlerts({ cssPath } = {}) {
  if (cssPath) ALERTS_CSS_HREF = cssPath;
}

function ensureAlertsCss() {
  if (cssReady) return cssReady;

  // já carregado?
  const exists =
    document.querySelector('link[data-alerts-style="true"]') ||
    [...document.querySelectorAll('link[rel="stylesheet"]')].some(l => l.href === ALERTS_CSS_HREF);

  if (exists) {
    cssReady = Promise.resolve();
    return cssReady;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = ALERTS_CSS_HREF;
  link.dataset.alertsStyle = 'true';

  cssReady = new Promise(res => { link.onload = res; link.onerror = res; });
  document.head.appendChild(link);
  return cssReady;
}

// Utilidades
function sanitize(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
}
function ensureContainer() {
    let c = document.querySelector('.notification-container');
    if (!c) {
        c = document.createElement('div');
        c.className = 'notification-container';
        c.setAttribute('aria-live', 'polite');
        document.body.appendChild(c);
    }
    return c;
}

// API
export async function showAlert({
    type = 'info',
    title = '',
    message = '',
    buttons = [],
    durationMs = 5000,
    dismissible = true,
    collapseDelayMs = 150,
} = {}) {
    const container = ensureContainer();
    await ensureAlertsCss();

    const el = document.createElement('div');
    el.className = 'notification-alert';
    el.setAttribute('role', 'alert');

    const color = ALERT_COLORS[type] || '#4ea1ff';
    el.style.setProperty('--color', color);
    el.style.setProperty('--progress-duration', `${durationMs / 1000}s`);

    if (type === 'error') {
        playAudio('error');
    } else if (type === 'warning') {
        playAudio('info');
    } else if (type === 'success') {
        playAudio('success');
    } else {
        playAudio('info');
    }

    el.innerHTML = `
    <div class="notification-title">
      <i data-lucide="${ALERT_ICONS[type] || 'info'}"></i>
      <span>${sanitize(title)}</span>
      ${dismissible ? '<button class="notification-close" aria-label="Fechar">×</button>' : ''}
    </div>
    <div class="notification-message">${sanitize(message)}</div>
    ${buttons.length ? '<div class="notification-buttons"></div>' : ''}
  `;

    container.prepend(el);

    if (window.lucide?.createIcons) {
        lucide.createIcons({ attrs: { stroke: color, width: 24, height: 24 } });
    }

    const btnWrap = el.querySelector('.notification-buttons');
    buttons.forEach(({ text, className, onClick }) => {
        const b = document.createElement('button');
        b.textContent = text;
        if (className) b.className = className;
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            close('action');
            onClick?.();
        });
        btnWrap?.appendChild(b);
    });

    const closeBtn = el.querySelector('.notification-close');
    closeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        close('close-button');
    });

    let timeoutId = null;
    let running = false;
    function startTimer() {
        if (durationMs <= 0 || running) return;
        running = true;
        el.classList.remove('paused');
        timeoutId = setTimeout(() => close('timeout'), durationMs);
    }
    function pauseTimer() {
        if (!running) return;
        running = false;
        el.classList.add('paused');
        clearTimeout(timeoutId);
    }

    el.addEventListener('mouseenter', pauseTimer);
    el.addEventListener('focusin', pauseTimer);
    el.addEventListener('mouseleave', startTimer);
    el.addEventListener('focusout', () => {
        if (!el.contains(document.activeElement)) startTimer();
    });

    if (durationMs > 0) startTimer();

    function close(_reason = 'manual') {
        pauseTimer();

        const cs = getComputedStyle(el);
        const h = el.offsetHeight;
        const mt = parseFloat(cs.marginTop) || 0;
        const mb = parseFloat(cs.marginBottom) || 0;
        const pt = parseFloat(cs.paddingTop) || 0;
        const pb = parseFloat(cs.paddingBottom) || 0;

        el.style.overflow = 'hidden';
        el.style.maxHeight = `${h}px`;
        el.style.transition = 'max-height .28s ease, margin .28s ease, padding .28s ease, opacity .2s ease';

        // reflow
        void el.offsetHeight;

        setTimeout(() => {
            el.style.maxHeight = '0px';
            el.style.marginTop = (mt ? '0px' : cs.marginTop);
            el.style.marginBottom = (mb ? '0px' : cs.marginBottom);
            el.style.paddingTop = (pt ? '0px' : cs.paddingTop);
            el.style.paddingBottom = (pb ? '0px' : cs.paddingBottom);
            el.style.opacity = '0';
        }, collapseDelayMs);

        el.addEventListener('transitionend', (e) => {
            if (e.propertyName === 'max-height') el.remove();
        }, { once: true });
    }

    return el;
}

export async function showConfirmAlert({
    title = '',
    message = '',
    type = 'info',
    yesText = 'Sim',
    noText = 'Não',
} = {}) {
    return new Promise((resolve) => {
        showAlert({
            type, title, message,
            durationMs: 0,
            dismissible: false,
            buttons: [
                { text: yesText, onClick: () => resolve(true) },
                { text: noText, onClick: () => resolve(false) },
            ],
        });
    });
}

function playAudio(type) {
    const audioMap = {
        success: './src/assets/audios/success.mp3',
        error: './src/assets/audios/error.mp3',
        info: './src/assets/audios/info.mp3'
    };
    const audioSrc = audioMap[type];
    if (!audioSrc) return;
    const audio = new Audio(audioSrc);
    audio.play().catch(() => { });
}