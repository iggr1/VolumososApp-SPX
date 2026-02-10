// src/js/modals/opdocs.js
import { apiGet } from '../api.js';
import { showAlert } from '../utils/alerts.js';
import { validateCTsCsvFile, validateRomaneioFile, resetFileInput } from '../utils/csvValidation.js';
import { importRoutesFromCTsCsv, importRoutesFromRomaneioCsv } from '../utils/routesImport.js';

const IMPORT_TYPES = {
  cts: {
    key: 'cts',
    title: 'Calculation Tasks (CTs)',
    validate: validateCTsCsvFile,
    importFn: importRoutesFromCTsCsv,
  },
  romaneio: {
    key: 'romaneio',
    title: 'Romaneio',
    validate: validateRomaneioFile,
    importFn: importRoutesFromRomaneioCsv,
  },
};

export const meta = {
  title: 'Documentos operacionais',
  size: 'sm',
  showBack: true,
  showClose: true,
  backdropClose: true,
  escToClose: true,
  initialFocus: '#opdocs-root',
};

export default function render(_props = {}, api) {
  api.setBackTo('settings');

  const el = document.createElement('div');
  el.id = 'opdocs-root';
  el.className = 'opdocs-modal';
  el.innerHTML = loadingView();

  const state = {
    cts: makeUploadState(),
    romaneio: makeUploadState(),
    activeKey: '',
  };

  init().catch(err => {
    el.innerHTML = errorView(err?.message || 'Falha ao carregar.');
    if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
  });

  return el;

  async function init() {
    await apiGet('config');

    el.innerHTML = view(state);
    bind(el);

    if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
  }

  function bind(root) {
    bindUploadCard(root, state.cts, IMPORT_TYPES.cts);
    bindUploadCard(root, state.romaneio, IMPORT_TYPES.romaneio);

    const btnImport = root.querySelector('#opdocs-import');
    if (btnImport) {
      btnImport.disabled = true;
      btnImport.onclick = async () => {
        const selectedKey = selectImportType(state);
        if (!selectedKey) return;

        const cardState = state[selectedKey];
        const config = IMPORT_TYPES[selectedKey];
        if (!cardState?.isValid || !cardState?.file || !config) return;

        await importFile(root, cardState, config, btnImport);
      };
    }
  }

    const btnHow = root.querySelector('#opdocs-how');
    if (btnHow) {
      btnHow.onclick = () => {
        import('../modal.js').then(m => m.openModal({ type: 'tutorial' }));
      };
    }
  }

  function bindUploadCard(root, cardState, config) {
    const drop = root.querySelector(`#opdocs-drop-${config.key}`);
    const fileInput = root.querySelector(`#opdocs-file-${config.key}`);

    if (drop && fileInput) {
      drop.onclick = () => fileInput.click();

      drop.addEventListener('dragover', e => {
        e.preventDefault();
        drop.classList.add('is-drag');
      });
      drop.addEventListener('dragleave', () => drop.classList.remove('is-drag'));
      drop.addEventListener('drop', async e => {
        e.preventDefault();
        drop.classList.remove('is-drag');
        const f = e.dataTransfer?.files?.[0];
        if (f) await handleFile(f);
      });

      fileInput.onchange = async () => {
        const f = fileInput.files?.[0];
        if (f) await handleFile(f);
      };
    }

    async function handleFile(file) {
      const result = await config.validate(file);

      if (!result.ok) {
        await showAlert({
          type: 'error',
          title: 'Arquivo inválido',
          message: result.message || 'CSV inválido.',
          durationMs: 3500,
        });
        resetUpload();
        updateGlobalImportButton(root, state);
        return;
      }

      cardState.file = file;
      cardState.isValid = true;
      cardState.selectedName = String(file.name || '');
      cardState.selectedSize = Number(file.size || 0);
      cardState.selectedType = String(file.type || '');
      state.activeKey = config.key;

      const nameEl = root.querySelector(`#opdocs-filename-${config.key}`);
      const hintEl = root.querySelector(`#opdocs-hint-${config.key}`);
      const dropEl = root.querySelector(`#opdocs-drop-${config.key}`);
      const iconEl = dropEl?.querySelector('[data-lucide]');

      if (dropEl) dropEl.classList.add('has-file');
      if (iconEl) iconEl.setAttribute('data-lucide', 'file-check');
      if (nameEl) nameEl.textContent = cardState.selectedName || 'Arquivo selecionado';
      if (hintEl) hintEl.textContent = formatFileHint(file);

      updateGlobalImportButton(root, state);
      if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
    }

    function resetUpload() {
      cardState.selectedName = '';
      cardState.selectedSize = 0;
      cardState.selectedType = '';
      cardState.file = null;
      cardState.isValid = false;

      const inputEl = root.querySelector(`#opdocs-file-${config.key}`);
      resetFileInput(inputEl);

      const dropEl = root.querySelector(`#opdocs-drop-${config.key}`);
      const iconEl = dropEl?.querySelector('[data-lucide]');
      const nameEl = root.querySelector(`#opdocs-filename-${config.key}`);
      const hintEl = root.querySelector(`#opdocs-hint-${config.key}`);

      if (dropEl) dropEl.classList.remove('has-file');
      if (iconEl) iconEl.setAttribute('data-lucide', 'file-up');
      if (nameEl) nameEl.textContent = 'Clique para fazer upload';
      if (hintEl) hintEl.textContent = 'ou arraste e solte aqui';
      if (buttonEl) buttonEl.disabled = true;

      if (state.activeKey === config.key) state.activeKey = '';
      if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
    }
  }
}

function selectImportType(state) {
  const active = state?.activeKey;
  if (active && state?.[active]?.isValid && state?.[active]?.file) return active;

  if (state?.cts?.isValid && state?.cts?.file) return 'cts';
  if (state?.romaneio?.isValid && state?.romaneio?.file) return 'romaneio';
  return '';
}

function updateGlobalImportButton(root, state) {
  const btn = root.querySelector('#opdocs-import');
  if (!btn) return;

  const selectedKey = selectImportType(state);
  btn.disabled = !selectedKey;
}

async function importFile(root, cardState, config, importBtn) {
  const originalHtml = importBtn.innerHTML;

  try {
    importBtn.disabled = true;
    importBtn.classList.add('is-loading');

    const result = await config.importFn(cardState.file, {
      batchSize: 1000,
      onProgress: ({ sent, total }) => {
        importBtn.innerHTML = `
          <span class="opdocs-help-ic"><i data-lucide="loader" aria-hidden="true"></i></span>
          <span>Importando... (${sent}/${total})</span>
        `;
        if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
      },
    });

    const sentCount = Number(result?.sent || result?.total || 0) || 0;
    const uniqueRoutes = Number(result?.uniqueRoutes || 0) || 0;

    root.innerHTML = successView({
      title: config.title,
      preRoutes: sentCount,
      uniqueRoutes,
    });

    if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });

    await showAlert({
      type: 'success',
      title: 'Importação concluída',
      message: 'As rotas ficaram disponíveis por 4 horas. Boa operação! 🚀',
      durationMs: 2600,
    });
  } catch (e) {
    importBtn.innerHTML = originalHtml;
    importBtn.classList.remove('is-loading');

    await showAlert({
      type: 'error',
      title: 'Falha ao importar',
      message: e?.message || 'Erro inesperado.',
      durationMs: 3500,
    });

    importBtn.disabled = false;
  }
}

function makeUploadState() {
  return {
    selectedName: '',
    selectedSize: 0,
    selectedType: '',
    file: null,
    isValid: false,
  };
}

/* --------------------- Views --------------------- */

function loadingView() {
  return `
    <div style="display:grid;place-items:center;height:20vh">
      <svg width="56" height="56" viewBox="0 0 24 24" aria-label="carregando">
        <style>.s{animation:spin .9s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style>
        <g class="s" transform-origin="12 12">
          <path d="M12 2a10 10 0 1 0 10 10" fill="none" stroke="var(--orange)" stroke-width="1"/>
        </g>
      </svg>
    </div>
  `;
}

function view(state) {
  return `
    <div class="opdocs-wrap">
      ${uploadCardView({ key: 'cts', title: 'Calculation Tasks (CTs)', state: state.cts })}
      <div class="opdocs-divider" aria-hidden="true">
        <span class="opdocs-divider-line"></span>
        <span class="opdocs-divider-label">OU</span>
        <span class="opdocs-divider-line"></span>
      </div>
      ${uploadCardView({ key: 'romaneio', title: 'Romaneio', state: state.romaneio })}

      <button id="opdocs-import" class="opdocs-helpbtn opdocs-primary" type="button" disabled>
        <span class="opdocs-help-ic">
          <i data-lucide="upload" aria-hidden="true"></i>
        </span>
        <span>IMPORTAR ROTAS</span>
      </button>

      <button id="opdocs-how" class="opdocs-helpbtn" type="button">
        <span class="opdocs-help-ic">
          <i data-lucide="upload" aria-hidden="true"></i>
        </span>
        <span>${escapeHtml(buttonLabel)}</span>
      </button>
    </section>
  `;
}

function uploadCardView({ key, title, state }) {
  const hasFile = !!state.selectedName;

  return `
    <section class="opdocs-card" aria-label="Upload de arquivo ${escapeHtml(title)}">
      <div class="opdocs-card-head">
        <div class="opdocs-card-head-text">${escapeHtml(title)}</div>
        <div class="opdocs-card-head-ext">${key === 'romaneio' ? '*.csv|*.zip' : '*.csv'}</div>
      </div>

      <button id="opdocs-drop-${key}" class="opdocs-dropzone ${hasFile ? 'has-file' : ''}" type="button"
        aria-label="Clique para fazer upload">
        <div class="opdocs-dropzone-inner">
          <div class="opdocs-upload-icon">
            <i data-lucide="${hasFile ? 'file-check' : 'file-up'}" aria-hidden="true"></i>
          </div>

          <div class="opdocs-dropzone-text" id="opdocs-filename-${key}">
            ${hasFile ? escapeHtml(state.selectedName) : 'Clique para fazer upload'}
          </div>

          <div class="opdocs-dropzone-hint" id="opdocs-hint-${key}">
            ${hasFile ? 'Arquivo selecionado • pronto para importar' : 'ou arraste e solte aqui'}
          </div>
        </div>
      </button>

      <input id="opdocs-file-${key}" class="opdocs-file" type="file" accept="${
        key === 'romaneio' ? '.csv,.zip,text/csv,application/zip' : '.csv,text/csv'
      }" />
    </section>
  `;
}

function errorView(msg) {
  return `
    <div style="display:grid;gap:16rem;place-items:center;text-align:center">
      <div style="font-weight:700">Erro</div>
      <div>${escapeHtml(msg)}</div>
      <button class="settings-button" onclick="location.reload()">
        <span>Tentar novamente</span>
      </button>
    </div>
  `;
}

function successView({ title, preRoutes, uniqueRoutes }) {
  return `
    <div class="opdocs-wrap">
      <section class="opdocs-card" aria-label="Resumo da importação">
        <div class="opdocs-card-head">
          <div class="opdocs-card-head-text">${escapeHtml(title)} importado</div>
          <div class="opdocs-card-head-ext">OK</div>
        </div>

        <div class="opdocs-summary">
          <div class="opdocs-summary-row">
            <span class="k">Pedidos enviados</span>
            <span class="v">${Number(preRoutes || 0)}</span>
          </div>

          <div class="opdocs-summary-row">
            <span class="k">Rotas enviadas</span>
            <span class="v">${Number(uniqueRoutes || 0)}</span>
          </div>
        </div>
      </section>

      <div class="opdocs-goodop">
        <span>As rotas ficaram disponíveis por 4 horas. Boa operação! 🚀<span>
      </div>

      <button class="opdocs-helpbtn" type="button" onclick="location.reload()">
        <span class="opdocs-help-ic"><i data-lucide="refresh-cw" aria-hidden="true"></i></span>
        <span>IMPORTAR OUTRO ARQUIVO</span>
      </button>
    </div>
  `;
}

/* --------------------- Utils --------------------- */
function escapeHtml(v) {
  const d = document.createElement('div');
  d.textContent = String(v ?? '');
  return d.innerHTML;
}

function formatFileHint(f) {
  const kb = (f.size || 0) / 1024;
  const mb = kb / 1024;
  const sizeStr = mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`;
  return `${sizeStr} • pronto para importar`;
}
