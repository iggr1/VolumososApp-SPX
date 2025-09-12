import { showConfirmAlert, showAlert } from '../utils/alerts.js';
import { getAllPallets, clearAllPallets } from '../utils/pallet.js';

export const meta = {
    title: 'Pallets enviados',
    size: 'sm',
    showBack: false,
    showClose: true,
    backdropClose: true,
    escToClose: true,
    initialFocus: '#all-pallets-root'
};

export default function render(_props = {}, api) {
    const el = document.createElement('div');
    el.id = 'all-pallets-root';
    el.className = 'allpallets-modal';

    let data = [];

    paintLoading();
    load().then(paint).catch((e) => paintError(e?.message || 'Falha ao carregar'));

    return el;

    async function load() {
        const res = await getAllPallets();
        data = Array.isArray(res?.pallets) ? res.pallets : [];
    }

    function paintLoading() {
        el.innerHTML = `
      <div class="allpallets-grid allpallets-grid--loading">
        ${Array.from({ length: 12 }).map(() => `<div class="allpallets-item skeleton"></div>`).join('')}
      </div>
      <div class="allpallets-footer">
        <button class="allpallets-btn allpallets-btn--danger" id="allpallets-clear" disabled>
          <i data-lucide="trash-2"></i><span>LIMPAR PLANILHA</span>
        </button>
      </div>
    `;
        if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
    }

    function paintError(msg) {
        el.innerHTML = `
      <div class="allpallets-error">
        <i data-lucide="alert-triangle"></i>
        <p>${esc(msg)}</p>
      </div>
      <div class="allpallets-footer">
        <button class="allpallets-btn" id="allpallets-retry">
          <i data-lucide="refresh-cw"></i><span>TENTAR NOVAMENTE</span>
        </button>
      </div>
    `;
        el.querySelector('#allpallets-retry')?.addEventListener('click', async () => {
            paintLoading();
            try { await load(); paint(); } catch (e) { paintError(e?.message || 'Erro'); }
        });
        if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
    }

    function paint() {
        const ids = data.map(p => Number(p.pallet)).filter(Number.isFinite).sort((a, b) => a - b);

        el.innerHTML = `
      <div class="allpallets-grid" role="list">
        ${ids.map(id => `
          <button class="allpallets-item" role="listitem" data-id="${id}" aria-label="Pallet ${id}">
            ${id}
          </button>
        `).join('')}
        ${!ids.length ? `
          <div class="allpallets-empty">
            <i data-lucide="package"></i>
            <p>Nenhum pallet encontrado.</p>
          </div>` : ''
            }
      </div>

      <div class="allpallets-footer">
        <button class="allpallets-btn allpallets-btn--danger" id="allpallets-clear" ${ids.length ? '' : 'disabled'}>
          <i data-lucide="trash-2"></i><span>LIMPAR PLANILHA</span>
        </button>
      </div>
    `;

        el.querySelector('.allpallets-grid')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.allpallets-item');
            if (!btn) return;
            const id = Number(btn.dataset.id);
            const grp = data.find(p => Number(p.pallet) === id);
            if (!grp) return;

            import('../modal.js').then(m => m.openModal({
                type: 'palletDetails',
                props: {
                    pallet: id,
                    items: (grp.packages || []).map(normalizeItem),
                    onChanged: (newItems) => {
                        const idx = data.findIndex(p => Number(p.pallet) === id);
                        if (idx >= 0) data[idx] = { pallet: id, packages: newItems.map(denormalizeItem) };
                        paint();
                    }
                }
            }));
        });

        el.querySelector('#allpallets-clear')?.addEventListener('click', onClearAll);

        if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
    }

    async function onClearAll() {
        if (!data.length) return;
        const ok = await showConfirmAlert({
            type: 'warning',
            title: 'Limpar planilha?',
            message: `Isso excluirá ${data.length} pallet(s) e todos os seus pacotes.`,
            okLabel: 'Limpar',
            cancelLabel: 'Cancelar'
        });
        if (!ok) return;

        try {
            paintLoading();
            await clearAllPallets();
            await showAlert({ type: 'success', title: 'Planilha limpa', message: 'Todos os pallets foram excluídos.', durationMs: 1400 });
            await load();
            paint();
        } catch (e) {
            await showAlert({ type: 'error', title: 'Erro', message: e?.message || 'Falha ao limpar.' });
        }
    }

    function normalizeItem(p) {
        return {
            brcode: p.brCode || p.brcode || '',
            route: p.route || '',
            pallet: p.pallet || '',
            datetime: p.dateTime || p.datetime || '',
            user: p.userName || p.user || ''
        };
    }
    function denormalizeItem(p) {
        return {
            brCode: p.brcode,
            route: p.route,
            pallet: p.pallet,
            dateTime: p.datetime,
            userName: p.user
        };
    }
    function esc(v) { const d = document.createElement('div'); d.textContent = String(v ?? ''); return d.innerHTML; }
}
