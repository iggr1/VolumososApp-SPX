// helper.js
import { apiGet } from '../api.js';

export function updateCounts() {
    setCountsLoading(true);

    const currentEl = document.querySelector('.current-pallet-count');
    const allEl = document.querySelector('.all-pallets-count');

    // ----- contador do pallet atual (localStorage) -----
    let n = 0;
    try {
        const items = JSON.parse(localStorage.getItem('currentPallet')) || [];
        n = Array.isArray(items) ? items.length : 0;
    } catch (_) {
        n = 0;
    }

    // troca o spinner pelo texto do pallet atual
    if (currentEl) {
        currentEl.textContent = `${n} pacote${n === 1 ? '' : 's'}`;
    }

    // ----- contador de todos os pallets (API) -----
    if (allEl) {
        (async () => {
            try {
                const res = await apiGet('pallets/count');
                const c = toInt(res?.count, 0);
                allEl.textContent = `${c} pallet${c === 1 ? '' : 's'}`;
            } catch (_) {
                // fallback visual simples em caso de erro de rede/servidor
                allEl.textContent = '—';
            } finally {
                // nada a desfazer aqui: quem escreve o número já substitui o spinner
                setCountsLoading(false);
            }
        })();
    } else {
        setCountsLoading(false);
    }
}

function toInt(v, d = 0) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : d;
}

// Coloca/retoma o SVG de loading nos dois contadores.
// Quando isLoading=true, injeta o mesmo SVG inline usado no index.html.
// Quando isLoading=false, não faz nada: quem finaliza é quem escreve o texto.
function setCountsLoading(isLoading) {
    const currentEl = document.querySelector('.current-pallet-count');
    const allEl = document.querySelector('.all-pallets-count');

    if (!isLoading) return;

    if (currentEl) currentEl.innerHTML = counterSpinnerSVG();
    if (allEl) allEl.innerHTML = counterSpinnerSVG();
}

// SVG idêntico ao usado no index.html para os contadores de pallets
function counterSpinnerSVG() {
    return `
    <svg width="24" height="24" fill="var(--orange)" viewBox="0 0 24 24"
         xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <style>
        .spinner_I8Q1 { animation: spinner_qhi1 .75s linear infinite }
        .spinner_vrS7 { animation-delay: -.375s }
        @keyframes spinner_qhi1 {
          0%,100% { r: 1.5px }
          50%     { r: 3px   }
        }
      </style>
      <circle class="spinner_I8Q1" cx="4"  cy="12" r="1.5" />
      <circle class="spinner_I8Q1 spinner_vrS7" cx="12" cy="12" r="3" />
      <circle class="spinner_I8Q1" cx="20" cy="12" r="1.5" />
    </svg>
  `.trim();
}

export function isModalOpenOnScreen() {
    const el = document.querySelector('body > .modal-root.show')
        || document.querySelector('.modal-backdrop.show');

    if (!el) return false;

    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;

    const r = el.getBoundingClientRect();

    return r.width > 0 && r.height > 0 &&
        r.bottom > 0 && r.right > 0 &&
        r.top < innerHeight && r.left < innerWidth;
}
