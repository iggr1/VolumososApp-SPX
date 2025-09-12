import { apiGet } from '../api.js';

export function updateCounts() {
    const current_el = document.querySelector('.current-pallet-count');
    if (current_el) {
        const items = JSON.parse(localStorage.getItem('currentPallet')) || [];
        const n = items.length;
        current_el.textContent = `${n} pacote${n === 1 ? '' : 's'}`;
    }

    const all_el = document.querySelector('.all-pallets-count');
    if (!all_el) return;

    (async () => {
        try {
            const res = await apiGet('pallets/count');
            const c = toInt(res?.count, 0);
            all_el.textContent = `${c} pallet${c === 1 ? '' : 's'}`;
        } catch (_) {
        }
    })();
}

function toInt(v, d = 0) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : d;
}