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
  initialFocus: '#pallet-view-root',
};

export default function render(props = {}, _api) {
  _api.setBackTo('allPallets');

  const el = document.createElement('div');
  el.id = 'pallet-view-root';
  el.className = 'pallet-modal';

  const palletId = Number(props.pallet || 0);
  let items = Array.isArray(props.items) ? props.items.slice() : [];

  let selecting = false;
  let selected = new Set();
  let longPressTimer = null;
  let loading = false; // <<< novo estado

  paint();

  if (window.lucide?.createIcons) {
    lucide.createIcons({ attrs: { width: 22, height: 22 } });
  }
  return el;

  function setLoading(v, label = 'Excluindo') {
    loading = !!v;
    paint(label);
  }

  function snapshotScroll() {
    const body = el.querySelector('.pallet-tbody');
    const table = el.querySelector('.pallet-table');
    return {
      bodyTop: body?.scrollTop || 0,
      bodyLeft: body?.scrollLeft || 0,
      tableTop: table?.scrollTop || 0,
      tableLeft: table?.scrollLeft || 0,
    };
  }

  function restoreScroll(snap) {
    requestAnimationFrame(() => {
      const body = el.querySelector('.pallet-tbody');
      const table = el.querySelector('.pallet-table');
      if (body) {
        body.scrollTop = snap.bodyTop;
        body.scrollLeft = snap.bodyLeft;
      }
      if (table) {
        table.scrollTop = snap.tableTop;
        table.scrollLeft = snap.tableLeft;
      }
    });
  }

  function paint(loadingLabel = 'Excluindo…') {
    const snap = snapshotScroll();

    el.className = `pallet-modal${loading ? ' is-loading' : ''}`;
    const canDel = canDelete() && !loading;

    el.innerHTML = `
      <div class="pallet-head">
        <div class="pallet-badge">PALLET ${palletId || ''}</div>
      </div>

      <div class="pallet-table ${selecting ? 'is-selecting' : ''}">
        <div class="pallet-thead">
          ${
            selecting
              ? `<div class="th th-check">
              <label class="pchk">
                <input id="chk-all" type="checkbox" ${selected.size && selected.size === items.length ? 'checked' : ''} ${loading ? 'disabled' : ''}/>
                <span aria-hidden="true"></span>
              </label>
            </div>`
              : ''
          }
          <div class="th th-br">Código BR</div>
          <div class="th th-route">Rota</div>
        </div>

        <div class="pallet-tbody">
          ${items.length ? items.map(rowTpl).join('') : emptyTpl()}
        </div>

        ${
          loading
            ? `
          <div class="pallet-loading-overlay" aria-busy="true" aria-live="polite">
            <div class="spinner" role="status" aria-label="${esc(loadingLabel)}"></div>
            <span class="loading-text">${esc(loadingLabel)}</span>
          </div>
        `
            : ''
        }
      </div>

      <div class="pallet-footer">
        <button id="pallet-del" class="pallet-btn ${canDel ? 'pallet-btn--danger' : ''}" ${canDel ? '' : 'disabled'}>
          ${loading ? `<span class="btn-spinner"></span>` : `<i data-lucide="x-circle"></i>`}
          <span>${loading ? esc(loadingLabel) : 'EXCLUIR SELECIONADOS'}</span>
        </button>
      </div>
    `;

    bind();

    if (window.lucide?.createIcons) {
      lucide.createIcons({ attrs: { width: 22, height: 22 } });
    }

    restoreScroll(snap);
  }

  function rowTpl(row, i) {
    const checked = selected.has(i) ? 'checked' : '';
    return `
      <div class="tr" data-i="${i}">
        ${
          selecting
            ? `<div class="td td-check">
          <label class="pchk">
            <input type="checkbox" data-i="${i}" ${checked} ${loading ? 'disabled' : ''}/>
            <span aria-hidden="true"></span>
          </label>
        </div>`
            : ''
        }
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
    const table = el.querySelector('.pallet-table');

    if (table) {
      table.addEventListener('selectstart', e => e.preventDefault(), { passive: false });
      table.addEventListener('dragstart', e => e.preventDefault(), { passive: false });
    }
    if (loading) return; // enquanto carregando, não liga handlers de interação

    // Long-press para entrar no modo seleção (ignora cliques no checkbox)
    tbody.addEventListener('pointerdown', onPressStart);
    tbody.addEventListener('pointerup', onPressEnd);
    tbody.addEventListener('pointercancel', onPressEnd);
    tbody.addEventListener('pointerleave', onPressEnd);

    // Clique na linha (ignora cliques em checkbox/label)
    tbody.addEventListener('click', onRowClick);

    // Clique/troca no checkbox da linha
    tbody.addEventListener('change', e => {
      const cb = e.target;
      if (!(cb instanceof HTMLInputElement)) return;
      if (!cb.matches('input[type="checkbox"][data-i]')) return;

      const idx = Number(cb.dataset.i);
      if (Number.isNaN(idx)) return;

      if (cb.checked) selected.add(idx);
      else selected.delete(idx);

      if (selected.size === 0) selecting = false;
      paint();
    });

    // Previne bubbling do label/checkbox
    tbody.addEventListener('click', e => {
      if (e.target.closest('.pchk')) e.stopPropagation();
    });

    // Header "selecionar tudo"
    el.querySelector('#chk-all')?.addEventListener('change', e => {
      if (e.target.checked) selected = new Set(items.map((_, i) => i));
      else selected.clear();
      paint();
    });

    // Excluir
    el.querySelector('#pallet-del')?.addEventListener('click', onDelete);
  }

  function onPressStart(e) {
    if (e.target.closest('.pchk')) return;
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
  function onPressEnd() {
    clearTimeout(longPressTimer);
  }

  function onRowClick(e) {
    if (e.target.closest('.pchk')) return;
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
      cancelLabel: 'Cancelar',
    });
    if (!ok) return;

    setLoading(true, 'Excluindo…');

    try {
      const result = await deletePackagesByIndices(items, selected, palletId);

      const { items: nextItems } = dropItemsByIndices(
        items,
        Array.from(selected).sort((a, b) => a - b)
      );
      items = nextItems;
      selected.clear();
      selecting = false;

      setLoading(false);
      paint();

      const msg =
        result.failed.length === 0
          ? 'Itens removidos.'
          : `Removidos: ${result.ok}/${result.total}. Falhas: ${result.failed.length}.`;

      await showAlert({
        type: result.failed.length ? 'warning' : 'success',
        title: 'Excluir',
        message: msg,
        durationMs: 1500,
      });
    } catch (e) {
      setLoading(false);
      await showAlert({ type: 'error', title: 'Erro', message: e?.message || 'Falha ao excluir.' });
    }
  }

  function canDelete() {
    return selecting && selected.size > 0;
  }
  function esc(v) {
    const d = document.createElement('div');
    d.textContent = String(v ?? '');
    return d.innerHTML;
  }
}
