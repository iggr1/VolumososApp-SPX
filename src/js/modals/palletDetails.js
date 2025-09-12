// palletDetails.js
import { deletePackagesByIndices, dropItemsByIndices } from '../utils/package.js';
import { showConfirmAlert, showAlert } from '../utils/alerts.js';

export const meta = {
    title: 'Pallet',
    size: 'sm',
    showBack: true,
    showClose: true,
    backdropClose: true,
    escToClose: true,
    initialFocus: '#pallet-view-root'
};

export default function render(props = {}, _api) {
    _api.setBackTo('allPallets');

    const el = document.createElement('div');
    el.id = 'pallet-view-root';
    el.className = 'pallet-modal'; // reutiliza o CSS do currentPallet

    const palletId = Number(props.pallet || 0);
    let items = Array.isArray(props.items) ? props.items.slice() : [];

    // estado de seleção (igual currentPallet)
    let selecting = false;
    let selected = new Set();
    let longPressTimer = null;

    paint();

    if (window.lucide?.createIcons) {
        lucide.createIcons({ attrs: { width: 22, height: 22 } });
    }
    return el;

    function paint() {
        el.innerHTML = `
      <div class="pallet-head">
        <div class="pallet-badge">PALLET ${palletId || ''}</div>
      </div>

      <div class="pallet-table ${selecting ? 'is-selecting' : ''}">
        <div class="pallet-thead">
          ${selecting ? `<div class="th th-check">
              <label class="pchk">
                <input id="chk-all" type="checkbox" ${selected.size && selected.size === items.length ? 'checked' : ''}/>
                <span aria-hidden="true"></span>
              </label>
            </div>` : ''}
          <div class="th th-br">Código BR</div>
          <div class="th th-route">Rota</div>
        </div>

        <div class="pallet-tbody">
          ${items.length ? items.map(rowTpl).join('') : emptyTpl()}
        </div>
      </div>

      <div class="pallet-footer">
        <button id="pallet-del" class="pallet-btn ${canDelete() ? 'pallet-btn--danger' : ''}" ${canDelete() ? '' : 'disabled'}>
          <i data-lucide="x-circle"></i>
          <span>EXCLUIR SELECIONADOS</span>
        </button>
      </div>
    `;

        bind();
        if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
    }

    function rowTpl(row, i) {
        const checked = selected.has(i) ? 'checked' : '';
        return `
      <div class="tr" data-i="${i}">
        ${selecting ? `<div class="td td-check">
          <label class="pchk">
            <input type="checkbox" data-i="${i}" ${checked}/>
            <span aria-hidden="true"></span>
          </label>
        </div>` : ''}
        <div class="td td-br">${esc(row.brcode)}</div>
        <div class="td td-route">${esc(row.route)}</div>
      </div>
    `;
    }

    function emptyTpl() {
        return `
      <div class="pallet-empty">
        <i data-lucide="package-open"></i>
        <p>Nenhum pacote neste pallet.</p>
      </div>
    `;
    }

    function bind() {
        const tbody = el.querySelector('.pallet-tbody');

        // long-press p/ entrar em modo seleção
        tbody.addEventListener('pointerdown', onPressStart);
        tbody.addEventListener('pointerup', onPressEnd);
        tbody.addEventListener('pointercancel', onPressEnd);
        tbody.addEventListener('pointerleave', onPressEnd);
        tbody.addEventListener('click', onRowClick);

        // header "selecionar tudo"
        el.querySelector('#chk-all')?.addEventListener('change', (e) => {
            if (e.target.checked) selected = new Set(items.map((_, i) => i));
            else selected.clear();
            paint();
        });

        // excluir
        el.querySelector('#pallet-del')?.addEventListener('click', onDelete);
    }

    function onPressStart(e) {
        const row = e.target.closest('.tr');
        if (!row) return;
        const idx = Number(row.dataset.i);
        clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
            selecting = true;
            selected.add(idx);
            paint();
        }, 450);
    }
    function onPressEnd() { clearTimeout(longPressTimer); }

    function onRowClick(e) {
        const row = e.target.closest('.tr');
        if (!row) return;
        const idx = Number(row.dataset.i);

        if (!selecting) return;
        if (selected.has(idx)) selected.delete(idx);
        else selected.add(idx);

        if (selected.size === 0) selecting = false;
        paint();
    }

    async function onDelete() {
        if (!canDelete()) return;

        const qtt = selected.size;
        const ok = await showConfirmAlert({
            type: 'warning',
            title: 'Excluir selecionados?',
            message: `Excluir ${qtt} pacote${qtt > 1 ? 's' : ''} do pallet ${palletId}?`,
            okLabel: 'Excluir',
            cancelLabel: 'Cancelar'
        });
        if (!ok) return;

        try {
            const result = await deletePackagesByIndices(items, selected, palletId);
            const { items: nextItems } = dropItemsByIndices(items, Array.from(selected).sort((a, b) => a - b));
            items = nextItems;
            selected.clear();
            selecting = false;

            paint();

            const msg =
                result.failed.length === 0
                    ? 'Itens removidos.'
                    : `Removidos: ${result.ok}/${result.total}. Falhas: ${result.failed.length}.`;

            await showAlert({ type: result.failed.length ? 'warning' : 'success', title: 'Excluir', message: msg, durationMs: 1500 });
        } catch (e) {
            await showAlert({ type: 'error', title: 'Erro', message: e?.message || 'Falha ao excluir.' });
        }
    }

    function canDelete() { return selecting && selected.size > 0; }
    function esc(v) { const d = document.createElement('div'); d.textContent = String(v ?? ''); return d.innerHTML; }
}
