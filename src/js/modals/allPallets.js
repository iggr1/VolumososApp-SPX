import { showConfirmAlert, showAlert } from '../utils/alerts.js';
import { getAllPallets, deletePallets, printPallets } from '../utils/pallet.js';

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
  el.tabIndex = -1; // permite keydown no container

  // Evita arrastar “ghost image” e seleção não intencional
  el.addEventListener('dragstart', (e) => e.preventDefault());
  el.addEventListener('selectstart', (e) => {
    if (!(e.target.closest && e.target.closest('.allow-select'))) e.preventDefault();
  });
  // bloqueia menu de contexto em long-press/right-click em tiles
  el.addEventListener('contextmenu', (e) => {
    if (e.target.closest && e.target.closest('.allpallets-item')) e.preventDefault();
  });

  let data = [];
  const selected = new Set();
  let longPressTimer = null;
  const LONG_MS = 350;
  let longPressFiredAt = 0;

  paintLoading();
  load().then(paint).catch((e) => paintError(e?.message || 'Falha ao carregar'));

  return el;

  // -------------------- Data --------------------
  async function load() {
    const res = await getAllPallets();
    data = Array.isArray(res?.pallets) ? res.pallets : [];
    // saneia seleção (remove ids inexistentes)
    const valid = new Set(data.map(p => Number(p.pallet)).filter(Number.isFinite));
    for (const id of Array.from(selected)) if (!valid.has(id)) selected.delete(id);
  }

  // -------------------- Paints --------------------
  function paintLoading() {
    el.innerHTML = `
      <div class="allpallets-grid allpallets-grid--loading" role="grid" aria-busy="true">
        ${Array.from({ length: 12 }).map(() => `<div class="allpallets-item skeleton" role="gridcell" aria-hidden="true"></div>`).join('')}
      </div>
      <div class="allpallets-footer">
        <button class="allpallets-modal-btn" id="allpallets-selectall" disabled>
          <i data-lucide="check-square"></i><span>SELECIONAR TODOS</span>
        </button>
        <button class="allpallets-modal-btn allpallets-modal-btn--danger" id="allpallets-delete" disabled>
        <i data-lucide="trash-2"></i><span>EXCLUIR SELECIONADOS</span>
        </button>
        <button class="allpallets-modal-btn allpallets-modal-btn--primary" id="allpallets-print" disabled>
          <i data-lucide="printer"></i><span>IMPRIMIR ETIQUETAS</span>
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
        <button class="allpallets-modal-btn" id="allpallets-retry">
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
      <div class="allpallets-grid" role="grid" aria-rowcount="${ids.length}">
        ${ids.map(id => `
          <button
            class="allpallets-item ${selected.has(id) ? 'is-selected' : ''}"
            role="gridcell"
            data-id="${id}"
            aria-label="Pallet ${id}"
            aria-pressed="${selected.has(id) ? 'true' : 'false'}"
          >
            <span class="allpallets-label">${id}</span>
          </button>
        `).join('')}
        ${!ids.length ? `
          <div class="allpallets-empty" role="note">
            <i data-lucide="package"></i>
            <p>Nenhum pallet encontrado.</p>
          </div>` : ''
        }
      </div>

      <div class="allpallets-footer">
        <button class="allpallets-modal-btn" id="allpallets-selectall" ${ids.length ? '' : 'disabled'}>
          <i data-lucide="check-square"></i>
          <span>${selected.size === ids.length && ids.length ? 'LIMPAR SELEÇÃO' : 'SELECIONAR TODOS'}</span>
        </button>
        <button class="allpallets-modal-btn allpallets-modal-btn--danger" id="allpallets-delete" ${selected.size ? '' : 'disabled'}>
        <i data-lucide="trash-2"></i><span>EXCLUIR SELECIONADOS${selected.size ? ` (${selected.size})` : ''}</span>
        </button>
        <button class="allpallets-modal-btn allpallets-modal-btn--primary" id="allpallets-print" ${selected.size ? '' : 'disabled'}>
          <i data-lucide="printer"></i><span>IMPRIMIR ETIQUETAS${selected.size ? ` (${selected.size})` : ''}</span>
        </button>
      </div>
    `;

    // eventos da grade
    const grid = el.querySelector('.allpallets-grid');
    if (grid) {
      grid.addEventListener('pointerdown', onPointerDown, { passive: true });
      grid.addEventListener('pointerup', onPointerUp, { passive: true });
      grid.addEventListener('pointercancel', clearLongPress, { passive: true });
      grid.addEventListener('pointerleave', clearLongPress, { passive: true });
      grid.addEventListener('click', onClick);
    }

    // botões de rodapé
    el.querySelector('#allpallets-selectall')?.addEventListener('click', onSelectAllToggle);
    el.querySelector('#allpallets-print')?.addEventListener('click', onPrintSelected);
    el.querySelector('#allpallets-delete')?.addEventListener('click', onDeleteSelected);

    // atalho Ctrl/Cmd + A
    el.addEventListener('keydown', (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'a' || ev.key === 'A')) {
        ev.preventDefault();
        onSelectAllToggle();
      }
    });

    if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
  }

  // -------------------- Interações --------------------
  function idFromEventTarget(node) {
    const btn = node && node.closest ? node.closest('.allpallets-item') : null;
    if (!btn) return null;
    const id = Number(btn.dataset.id);
    return Number.isFinite(id) ? id : null;
  }

  function onPointerDown(e) {
    if (e.button !== 0) return; // só botão primário
    const id = idFromEventTarget(e.target);
    if (id == null) return;
    clearLongPress();
    longPressTimer = setTimeout(() => {
      toggleSelect(id);
      updateTile(id);
      updateFooterButtons();
      longPressFiredAt = Date.now();
    }, LONG_MS);
  }

  function onPointerUp() { clearLongPress(); }
  function clearLongPress() { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } }

  function onClick(e) {
    // ignora o click “fantasma” logo após long-press
    if (Date.now() - longPressFiredAt < 300) { longPressFiredAt = 0; return; }

    const id = idFromEventTarget(e.target);
    if (id == null) return;

    const isModifier = e.ctrlKey || e.metaKey;
    const anySelected = selected.size > 0;

    if (isModifier || anySelected) {
      toggleSelect(id);
      updateTile(id);
      updateFooterButtons();
      return;
    }

    openDetails(id);
  }

  function toggleSelect(id) {
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
  }

  function updateTile(id) {
    const btn = el.querySelector(`.allpallets-item[data-id="${id}"]`);
    if (!btn) return;
    const on = selected.has(id);
    btn.classList.toggle('is-selected', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function updateFooterButtons() {
    const delBtn = el.querySelector('#allpallets-delete');
    if (delBtn) {
      if (selected.size) {
        delBtn.removeAttribute('disabled');
        delBtn.querySelector('span').textContent = `EXCLUIR SELECIONADOS (${selected.size})`;
      } else {
        delBtn.setAttribute('disabled', 'true');
        delBtn.querySelector('span').textContent = 'EXCLUIR SELECIONADOS';
      }
    }

    const printBtn = el.querySelector('#allpallets-print');
    if (printBtn) {
      if (selected.size) {
        printBtn.removeAttribute('disabled');
        printBtn.querySelector('span').textContent = `IMPRIMIR ETIQUETAS (${selected.size})`;
      } else {
        printBtn.setAttribute('disabled', 'true');
        printBtn.querySelector('span').textContent = 'IMPRIMIR ETIQUETAS';
      }
    }

    updateSelectAllButton();
  }

  function updateSelectAllButton() {
    const btn = el.querySelector('#allpallets-selectall');
    if (!btn) return;
    const total = el.querySelectorAll('.allpallets-item').length;
    if (!total) {
      btn.setAttribute('disabled', 'true');
      btn.querySelector('span').textContent = 'SELECIONAR TODOS';
      return;
    }
    btn.removeAttribute('disabled');
    const all = selected.size === total;
    btn.querySelector('span').textContent = all ? 'LIMPAR SELEÇÃO' : 'SELECIONAR TODOS';
  }

  function onSelectAllToggle() {
    const ids = Array.from(el.querySelectorAll('.allpallets-item'))
      .map(b => Number(b.dataset.id)).filter(Number.isFinite);
    if (!ids.length) return;

    const selectAll = selected.size !== ids.length;
    if (selectAll) {
      selected.clear();
      ids.forEach(id => selected.add(id));
    } else {
      selected.clear();
    }

    ids.forEach(updateTile);
    updateFooterButtons();
  }

  function openDetails(id) {
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
  }

  async function onPrintSelected() {
    if (!selected.size) return;
    const ids = Array.from(selected).sort((a, b) => a - b);
    try {
      await printPallets(ids);
      await showAlert({
        type: 'success',
        title: 'Impressão',
        message: `Etiquetas enviadas para ${ids.length} pallet(s).`,
        durationMs: 1600
      });
    } catch (e) {
      await showAlert({
        type: 'error',
        title: 'Falha ao imprimir',
        message: e?.message || 'Não foi possível imprimir as etiquetas.'
      });
    }
  }

  async function onDeleteSelected() {
    if (!selected.size) return;

    const ids = Array.from(selected).sort((a, b) => a - b);
    const ok = await showConfirmAlert({
      type: 'warning',
      title: 'Excluir selecionados?',
      message: `Isso excluirá ${ids.length} pallet(s): ${ids.join(', ')}.`,
      okLabel: 'Excluir',
      cancelLabel: 'Cancelar'
    });
    if (!ok) return;

    try {
      paintLoading();
      await deletePallets(ids);
      await showAlert({ type: 'success', title: 'Excluído', message: 'Pallet(s) removido(s).', durationMs: 1400 });
      selected.clear();
      await load();
      paint();
    } catch (e) {
      await showAlert({ type: 'error', title: 'Erro', message: e?.message || 'Falha ao excluir.' });
      paint();
    }
  }

  // -------------------- Normalização itens --------------------
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
