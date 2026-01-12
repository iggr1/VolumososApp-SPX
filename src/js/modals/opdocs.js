// src/js/modals/opdocs.js
import { apiGet } from '../api.js';
import { showAlert } from '../utils/alerts.js';
import { validateCTsCsvFile, resetFileInput } from '../utils/csvValidation.js';
import { importRoutesFromCTsCsv } from '../utils/routesImport.js';

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
    selectedName: '',
    selectedSize: 0,
    selectedType: '',
    file: null,
    isValid: false,
  };

  init().catch(err => {
    el.innerHTML = errorView(err?.message || 'Falha ao carregar.');
    if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
  });

  return el;

  async function init() {
    // opcional: verifica permissões via backend (depois você restringe admin lá)
    // hoje apenas carrega para manter padrão de modal
    await apiGet('config');

    el.innerHTML = view(state);
    bind(el);

    if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
  }

  function bind(root) {
    const btnImport = $('#opdocs-import');
    const btnHow = $('#opdocs-how');

    function $(s) {
      return root.querySelector(s);
    }

    const drop = $('#opdocs-drop');
    const file = $('#opdocs-file');
    const help = $('#opdocs-help');

    // clique no dropzone => abre seletor
    if (drop && file) {
      drop.onclick = () => file.click();

      // drag-over visual (só UI)
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

      file.onchange = async () => {
        const f = file.files?.[0];
        if (f) await handleFile(f);
      };
    }

    // botão help (placeholder)
    if (help) {
      help.onclick = () => {
        import('../modal.js').then(m => m.openModal({ type: 'tutorial' }));
      };
    }

    // botão importar
    if (btnImport) {
      btnImport.disabled = true;

      btnImport.onclick = async () => {
        if (!state.isValid || !state.file) return;

        // pega o texto original do botão (pra restaurar)
        const originalHtml = btnImport.innerHTML;

        try {
          btnImport.disabled = true; // evita clique duplo
          btnImport.classList.add('is-loading');

          // calcula rotas únicas pelo próprio arquivo (não depende do server)
          const routesUnique = await countUniqueCorridorsFromFile(state.file);

          const result = await importRoutesFromCTsCsv(state.file, {
            batchSize: 1000,
            onProgress: ({ sent, total }) => {
              btnImport.innerHTML = `
            <span class="opdocs-help-ic"><i data-lucide="loader" aria-hidden="true"></i></span>
            <span>Importando... (${sent}/${total})</span>
          `;
              if (window.lucide?.createIcons)
                lucide.createIcons({ attrs: { width: 22, height: 22 } });
            },
          });

          // métricas
          const sentCount = Number(result?.sent || result?.total || 0) || 0;
          const uniqueRoutes = Number(routesUnique || 0) || 0;

          // substitui UI do modal por resultado
          root.innerHTML = successView({
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
          btnImport.innerHTML = originalHtml;
          btnImport.classList.remove('is-loading');

          await showAlert({
            type: 'error',
            title: 'Falha ao importar',
            message: e?.message || 'Erro inesperado.',
            durationMs: 3500,
          });
        } finally {
          // se ainda está no layout antigo, restaura botão
          const btn = root.querySelector('#opdocs-import');
          if (btn) btn.disabled = !state.isValid;
        }
      };
    }

    // botão "como importar?"
    if (btnHow) {
      btnHow.onclick = () => {
        import('../modal.js').then(m => m.openModal({ type: 'tutorial' }));
      };
    }

    async function handleFile(f) {
      const result = await validateCTsCsvFile(f);

      if (!result.ok) {
        await showAlert({
          type: 'error',
          title: 'Arquivo inválido',
          message: result.message || 'CSV inválido.',
          durationMs: 3500,
        });
        resetUpload();
        return;
      }

      // ok
      state.file = f;
      state.isValid = true;

      state.selectedName = String(f.name || '');
      state.selectedSize = Number(f.size || 0);
      state.selectedType = String(f.type || '');

      const nameEl = root.querySelector('#opdocs-filename');
      const hintEl = root.querySelector('#opdocs-hint');
      const btnImport = root.querySelector('#opdocs-import');

      if (nameEl) nameEl.textContent = state.selectedName || 'Arquivo selecionado';
      if (hintEl) hintEl.textContent = formatFileHint(f);
      if (btnImport) btnImport.disabled = false;
    }

    function resetUpload() {
      state.selectedName = '';
      state.selectedSize = 0;
      state.selectedType = '';

      // reseta input file
      const fileInput = root.querySelector('#opdocs-file');
      resetFileInput(fileInput);

      // reseta UI
      const dropEl = root.querySelector('#opdocs-drop');
      const iconEl = dropEl?.querySelector('[data-lucide]');
      const nameEl = root.querySelector('#opdocs-filename');
      const hintEl = root.querySelector('#opdocs-hint');

      if (dropEl) dropEl.classList.remove('has-file');

      if (nameEl) nameEl.textContent = 'Clique para fazer upload';
      if (hintEl) hintEl.textContent = 'ou arraste e solte aqui';

      // troca ícone pra file-up
      if (iconEl) iconEl.setAttribute('data-lucide', 'file-up');

      // re-render lucide (senão o svg não troca)
      if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });

      state.file = null;
      state.isValid = false;

      const btnImport = root.querySelector('#opdocs-import');
      if (btnImport) btnImport.disabled = true;
    }

    function formatFileHint(f) {
      const kb = (f.size || 0) / 1024;
      const mb = kb / 1024;
      const sizeStr = mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`;
      return `${sizeStr} • pronto para importar`;
    }
  }
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
  const hasFile = !!state.selectedName;

  return `
    <div class="opdocs-wrap">
      <section class="opdocs-card" aria-label="Upload de arquivo">
        <div class="opdocs-card-head">
          <div class="opdocs-card-head-text">Calculation Tasks (CTs)</div>
          <div class="opdocs-card-head-ext">*.csv</div>
        </div>

        <button id="opdocs-drop" class="opdocs-dropzone ${hasFile ? 'has-file' : ''}" type="button"
          aria-label="Clique para fazer upload">
          <div class="opdocs-dropzone-inner">
            <div class="opdocs-upload-icon">
              <i data-lucide="${hasFile ? 'file-check' : 'file-up'}" aria-hidden="true"></i>
            </div>

            <div class="opdocs-dropzone-text" id="opdocs-filename">
              ${hasFile ? escapeHtml(state.selectedName) : 'Clique para fazer upload'}
            </div>

            <div class="opdocs-dropzone-hint" id="opdocs-hint">
              ${hasFile ? 'Arquivo selecionado • pronto para importar' : 'ou arraste e solte aqui'}
            </div>
          </div>
        </button>

        <input id="opdocs-file" class="opdocs-file" type="file" accept=".csv,text/csv" />
      </section>

      <!-- IMPORTAR ROTAS -->
      <button id="opdocs-import" class="opdocs-helpbtn opdocs-primary" type="button" disabled>
        <span class="opdocs-help-ic">
          <i data-lucide="upload" aria-hidden="true"></i>
        </span>
        <span>IMPORTAR ROTAS</span>
      </button>

      <!-- COMO IMPORTAR -->
      <button id="opdocs-how" class="opdocs-helpbtn" type="button">
        <span class="opdocs-help-ic">
          <i data-lucide="help-circle" aria-hidden="true"></i>
        </span>
        <span>COMO IMPORTAR?</span>
      </button>
    </div>
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

function successView({ preRoutes, uniqueRoutes }) {
  return `
    <div class="opdocs-wrap">
      <section class="opdocs-card" aria-label="Resumo da importação">
        <div class="opdocs-card-head">
          <div class="opdocs-card-head-text">Importação concluída</div>
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

async function countUniqueCorridorsFromFile(file) {
  // usa a própria extração do routesImport, se você quiser ficar 100% alinhado:
  // (melhor) -> exporte também extractRoutesFromCTsCsv e use aqui
  // mas pra não mexer em outro arquivo agora, vamos ler e pegar a coluna "Corridor Cage" de forma simples.

  const text = await file.text();

  const lines = String(text || '')
    .split(/\r?\n/)
    .filter(l => l.trim());
  if (lines.length < 2) return 0;

  // detecta delimitador pelo header
  const header = lines[0];
  const commas = (header.match(/,/g) || []).length;
  const semis = (header.match(/;/g) || []).length;
  const delimiter = semis > commas ? ';' : ',';

  const headers = header.split(delimiter).map(h => String(h).trim());
  const idx = headers.indexOf('Corridor Cage');
  if (idx < 0) return 0;

  const set = new Set();

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (!row || !row.trim()) continue;

    const parts = row.split(delimiter);
    const v = String(parts[idx] ?? '')
      .trim()
      .replace(/^"|"$/g, '');
    if (!v) continue;

    set.add(v);
  }

  return set.size;
}
