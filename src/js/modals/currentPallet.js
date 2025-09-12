import { showConfirmAlert, showAlert } from '../utils/alerts.js';
import { addIntoQueue } from '../utils/pallet.js';
import { updateCounts } from '../utils/helper.js';

export const meta = {
    title: 'Pacotes do pallet',
    size: 'sm',
    showBack: false,
    showClose: true,
    backdropClose: true,
    escToClose: true,
    initialFocus: '#pallet-root'
};

const LS_KEY = 'currentPallet';

export default function render(_props = {}, api) {
    const el = document.createElement('div');
    el.id = 'pallet-root';
    el.className = 'pallet-modal';

    // ---- state --------------------------------------------------------------
    let items = loadItems();     
    let selecting = false;          
    let selected = new Set();      
    let longPressTimer = null;

    paint();
    refreshIcons();

    return el;

    // ---- render -------------------------------------------------------------
    function paint() {
        el.innerHTML = `
      <div class="pallet-head">
        <div class="pallet-badge">PALLET ATUAL</div>
      </div>

      <div class="pallet-table ${selecting ? 'is-selecting' : ''}">
        ${tableHeader(selecting)}
        <div class="pallet-tbody">
          ${items.length ? items.map(rowTpl).join('') : emptyTpl()}
        </div>
      </div>

      <div class="pallet-footer">
        <button id="pallet-del" class="pallet-btn pallet-btn--danger" ${canDelete() ? '' : 'disabled'}>
          <i data-lucide="x-circle"></i>
          <span>EXCLUIR SELECIONADOS</span>
        </button>

        <button id="pallet-finish" class="pallet-btn pallet-btn--primary" ${items.length ? '' : 'disabled'}>
          <i data-lucide="package-check"></i>
          <span>FINALIZAR PALLET</span>
        </button>
      </div>
    `;

        bindEvents();
        refreshIcons();
    }

    function tableHeader(withChecks) {
        return `
      <div class="pallet-thead">
        ${withChecks ? `
          <div class="th th-check">
            <label class="pchk">
              <input id="chk-all" type="checkbox" ${selected.size && selected.size === items.length ? 'checked' : ''}/>
              <span aria-hidden="true"></span>
            </label>
          </div>` : ''}
        <div class="th th-br">Código BR</div>
        <div class="th th-route">Rota</div>
      </div>
    `;
    }

    function rowTpl(item, i) {
        const checked = selected.has(i) ? 'checked' : '';
        return `
      <div class="tr" data-i="${i}">
        ${selecting ? `
          <div class="td td-check">
            <label class="pchk">
              <input type="checkbox" data-i="${i}" ${checked}/>
              <span aria-hidden="true"></span>
            </label>
          </div>` : ''}
        <div class="td td-br">${esc(item.brCode)}</div>
        <div class="td td-route">${esc(item.route)}</div>
      </div>
    `;
    }

    function emptyTpl() {
        return `
      <div class="pallet-empty">
        <i data-lucide="package-open"></i>
        <p>Sem pacotes neste pallet.</p>
      </div>
    `;
    }

    // ---- events -------------------------------------------------------------
    function bindEvents() {
        const tbody = el.querySelector('.pallet-tbody');
        const delBtn = el.querySelector('#pallet-del');
        const finBtn = el.querySelector('#pallet-finish');

        // Long-press para entrar em modo de seleção
        tbody.addEventListener('pointerdown', onPressStart);
        tbody.addEventListener('pointerup', onPressEnd);
        tbody.addEventListener('pointercancel', onPressEnd);
        tbody.addEventListener('pointerleave', onPressEnd);

        // Clique em linha (toggle seleção quando ativo)
        tbody.addEventListener('click', onRowClick);

        // Clique/Change diretamente nos checkboxes
        tbody.addEventListener('change', (e) => {
            const cb = e.target.closest('input[type="checkbox"][data-i]');
            if (!cb) return;
            const idx = Number(cb.dataset.i);
            if (cb.checked) selected.add(idx); else selected.delete(idx);
            if (selected.size === 0) selecting = false;
            // apenas atualiza footer/thead sem reconstruir todas as linhas
            paint();
        });

        // Header "selecionar tudo"
        el.querySelector('#chk-all')?.addEventListener('change', (e) => {
            if (e.target.checked) selected = new Set(items.map((_, i) => i));
            else selected.clear();
            paint();
        });

        // Botões
        delBtn?.addEventListener('click', onDelete);
        finBtn?.addEventListener('click', onFinish);
    }

    function onPressStart(e) {
        const row = e.target.closest('.tr');
        if (!row || !items.length) return;
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
        // se clicou no checkbox/label, deixa o handler de 'change' cuidar
        if (e.target.closest('label.pchk') || e.target.closest('input[type="checkbox"]')) return;

        const row = e.target.closest('.tr');
        if (!row || !selecting) return;

        const idx = Number(row.dataset.i);
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
            message: `Deseja excluir ${qtt} pacote${qtt > 1 ? 's' : ''} do pallet atual?`,
            okLabel: 'Excluir',
            cancelLabel: 'Cancelar'
        });
        if (!ok) return;

        const idxs = Array.from(selected).sort((a, b) => b - a);
        for (const i of idxs) items.splice(i, 1);

        saveItems(items);
        selected.clear();
        selecting = false;

        paint();
        await showAlert({
            type: 'success',
            title: 'Excluído',
            message: 'Itens removidos do pallet.',
            durationMs: 1400
        });

        updateCounts();
    }

    async function onFinish() {
        if (!items.length) return;

        const qtt = items.length;
        const ok = await showConfirmAlert({
            type: 'warning',
            title: 'Finalizar pallet?',
            message: `Enviar ${qtt} pacote${qtt > 1 ? 's' : ''} para a fila de sincronização e limpar o pallet atual?`,
            okLabel: 'Finalizar',
            cancelLabel: 'Cancelar'
        });
        if (!ok) {
            return;
        }

        try {
            addIntoQueue();
            selected.clear();
            selecting = false;
            items = [];
            saveItems(items);

            updateCounts();

            paint();

            await showAlert({
                type: 'success',
                title: 'Pallet finalizado',
                message: `${qtt} pacote${qtt > 1 ? 's' : ''} enviados para a fila.`,
                durationMs: 1600
            });

            // callback opcional para quem abriu o modal
            if (typeof _props.onFinish === 'function') {
                try { _props.onFinish(); } catch (_) { }
            }
        } catch (e) {
            await showAlert({
                type: 'error',
                title: 'Falha ao finalizar',
                message: e?.message || 'Erro inesperado.',
                durationMs: 2000
            });
        }
    }

    // ---- helpers ------------------------------------------------------------
    function canDelete() { return selecting && selected.size > 0; }
    function refreshIcons() {
        if (window.lucide?.createIcons) {
            lucide.createIcons({ attrs: { width: 22, height: 22 } });
        }
    }
}

/* storage helpers */
function loadItems() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
}
function saveItems(arr) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(arr || [])); }
    catch (_) { }
}

/* utils */
function esc(v) { const d = document.createElement('div'); d.textContent = String(v ?? ''); return d.innerHTML; }
