import { apiGet, apiPost } from '../api.js';
import { updateCounts } from './helper.js';
import { showAlert } from './alerts.js';

// ---- pallets --------------------------------------------------------------

export async function getAllPallets() {
    // usa a rota criada no servidor que já retorna pallets com seus packages
    return await apiGet('pallets', { order: 'asc' });
}

export async function clearAllPallets() {
    await apiPost('pallets/clear');
    updateCounts();
}

// ---- local pallet (armazenamento local) -----------------------------------

export function verifyAlreadyInLocalPallet(brCode) {
    const code = String(brCode || '').trim().toUpperCase();
    const current = safeGetLS('currentPallet', []);
    return current.some(item =>
        String(item.brCode || item.brcode || '').toUpperCase() === code
    );
}

export function sendToLocalPallet(packageToAdd) {
    const current = safeGetLS('currentPallet', []);
    current.push(packageToAdd);
    localStorage.setItem('currentPallet', JSON.stringify(current));
    updateCounts();
}

// ---- fila de envio --------------------------------------------------------

const QUEUE_KEY = 'palletQueue';
let processing = false;

export function addIntoQueue(options = {}) {
    const packages = safeGetLS('currentPallet', []);
    if (!Array.isArray(packages) || packages.length === 0) return;

    const norm = packages
        .map(p => ({
            brCode: String(p.brCode || p.brcode || '').trim().toUpperCase(),
            route: String(p.route || '').trim()
        }))
        .filter(p => p.brCode && p.route);

    if (norm.length === 0) return;

    const targetPallet = Number(options.targetPallet || 0) || 0;
    const mode = targetPallet > 0 ? 'existing' : (options.mode || '');

    const palletObj = {
        packages: norm,
        createdAt: new Date().toISOString(),
        targetPallet,
        mode
    };

    const queue = safeGetLS(QUEUE_KEY, []);
    queue.push(palletObj);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

    // limpa o pallet local e atualiza contadores imediatamente
    localStorage.removeItem('currentPallet');
    updateCounts();

    processQueue(); // dispara processamento (não bloqueante)
}

async function processQueue() {
    if (processing) return;
    processing = true;

    try {
        let queue = safeGetLS(QUEUE_KEY, []);
        while (queue.length > 0) {
            const current = queue[0];

            // Se veio targetPallet > 0, enviamos para este ID específico (append)
            const targetId = Number(current?.targetPallet || 0) || 0;

            try {
                let palletId = null;
                let res;

                if (targetId > 0) {
                    res = await apiPost('pallet', {
                        mode: 'existing',
                        targetPallet: targetId,
                        append: true,
                        packages: current.packages
                    });
                    palletId = targetId;
                } else {
                    // fluxo antigo: pega próximo disponível e envia como NOVO
                    let palletInfo;
                    try {
                        palletInfo = await apiGet('pallet/available');
                    } catch (err) {
                        console.error('Falha em pallet/available:', err);
                        break; // tenta novamente no próximo trigger
                    }
                    if (!palletInfo || !palletInfo.palletId) {
                        console.warn('Nenhum pallet disponível no momento.');
                        break;
                    }
                    palletId = palletInfo.palletId;

                    res = await apiPost('pallet', {
                        pallet: palletId,
                        packages: current.packages
                    });
                }

                // sucesso => alerta e tira da fila
                showAlert({
                    title: 'Sucesso!',
                    message: `Total de ${current.packages.length} pacotes enviados com sucesso!\nPALLET NÚMERO: ${palletId}`,
                    type: 'success',
                    durationMs: 5000,
                    dismissible: true,
                    collapseDelayMs: 100
                });

                queue.shift();
                localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
            } catch (err) {
                console.error('Erro ao enviar pacotes:', err);
                // opcional: poderia implementar backoff e retry
                break;
            }

            // recarrega referência da fila
            queue = safeGetLS(QUEUE_KEY, []);
        }
    } finally {
        processing = false;
        updateCounts();
    }
}

// ---- utils ----------------------------------------------------------------

function safeGetLS(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return Array.isArray(fallback) && !Array.isArray(parsed) ? fallback : (parsed ?? fallback);
    } catch {
        return fallback;
    }
}

export async function deletePallets(ids) {
    // aceita número único ou array; normaliza e valida
    const list = Array.isArray(ids) ? ids : [ids];
    const payload = list
        .map(n => Number(n))
        .filter(n => Number.isFinite(n) && n > 0);

    if (!payload.length) {
        throw new Error('Nenhum pallet válido informado para exclusão.');
    }

    // usa override via POST para cair na rota DELETE /pallets do Apps Script
    const res = await apiPost('pallets', {
        _method: 'DELETE',
        ids: payload
    });

    // atualiza contadores locais
    updateCounts();

    // opcional: retornar estrutura padronizada
    return {
        ok: !!res?.ok,
        deleted_total: res?.deleted_total ?? 0,
        results: res?.results ?? []
    };
}

export async function printPallets(ids, opts = {}) {
  const list = Array.isArray(ids) ? ids : [ids];
  const wanted = new Set(list.map(Number).filter(n => Number.isFinite(n) && n > 0));
  if (!wanted.size) throw new Error('Nenhum pallet válido para impressão.');

  const batchSize = Math.max(1, Number(opts.batchSize ?? 60));

  // Abre a guia já no gesto do usuário
  const tab = window.open('', '_blank');
  if (!tab) throw new Error('O navegador bloqueou a abertura de nova guia. Permita pop-ups/abas.');

  try { tab.opener = null; } catch (_) {}

  // Splash
  tab.document.open();
  tab.document.write(`<!doctype html><meta charset="utf-8"><title>Etiquetas</title>
  <style>
    html,body{height:100%;margin:0}
    body{display:grid;place-items:center;background:#f4f4f4;font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;color:#333}
    .loading{display:grid;gap:12px;justify-items:center;text-align:center}
    .spinner{width:44px;height:44px;border:4px solid #ddd;border-top-color:#ff7a00;border-radius:50%;animation:s .9s linear infinite}
    @keyframes s{to{transform:rotate(1turn)}}
  </style>
  <div class="loading"><div class="spinner"></div><div>Gerando etiquetas…</div></div>`);
  tab.document.close();

  // Busca dados
  const res = await apiGet('pallets', { order: 'asc' });
  const pallets = Array.isArray(res?.pallets) ? res.pallets : [];
  const groups = pallets
    .filter(p => wanted.has(Number(p.pallet)))
    .map(p => ({
      id: Number(p.pallet),
      packages: (Array.isArray(p.packages) ? p.packages : []).map(n => ({
        br: String(n.brCode || n.brcode || '').toUpperCase(),
        route: String(n.route || ''),
        user: String(n.userName || n.user || '')
      }))
    }));

  if (!groups.length) throw new Error('Pallet(s) não encontrado(s).');

  // Opcional: quebra em lotes para a pré-visualização abrir mais leve
  const batches = [];
  for (let i = 0; i < groups.length; i += batchSize) {
    batches.push(groups.slice(i, i + batchSize));
  }

  // Primeira guia atual recebe o primeiro lote; demais lotes abrem novas guias
  const firstHtml = buildPrintHtmlFast(batches[0]);
  const firstBlob = new Blob([firstHtml], { type: 'text/html;charset=utf-8' });
  const firstUrl = URL.createObjectURL(firstBlob);
  tab.location.replace(firstUrl);

  // Lotes adicionais em novas guias (se houver)
  for (let i = 1; i < batches.length; i++) {
    const h = buildPrintHtmlFast(batches[i]);
    const b = new Blob([h], { type: 'text/html;charset=utf-8' });
    const u = URL.createObjectURL(b);
    const t = window.open(u, '_blank');
    try { t?.focus(); } catch (_) {}
  }
}

function buildPrintHtmlFast(groups) {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const pad2 = n => String(n).padStart(2, '0');

  const pages = groups.map(g => {
    const users = Array.from(new Set(g.packages.map(p => p.user).filter(Boolean)));
    const userStr = users.join(', ');
    const lines = g.packages.map(p =>
      `<div class="line"><span class="br">${esc(p.br)}</span><span class="sep"> / </span><span class="route">${esc(p.route)}</span></div>`
    ).join('');

    return `
      <section class="label" data-pageslot aria-label="Etiqueta do pallet ${esc(g.id)}">
        <header class="hdr">
          <div class="title">PALLET N°</div>
          <div class="pid-box" data-pidbox>
            <!-- data-digits ajuda no ajuste rápido -->
            <div class="pid" data-pid data-digits="${String(pad2(g.id)).length}">${pad2(g.id)}</div>
          </div>
        </header>

        <main class="list" aria-label="Pacotes">
          ${lines || `<div class="line line--empty">— sem pacotes —</div>`}
        </main>

        <footer class="ftr">
          <div class="ftr-title">Usuário responsável</div>
          <div class="ftr-user">${esc(userStr) || '—'}</div>
        </footer>
      </section>
    `;
  }).join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Etiquetas de Pallet</title>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@900&display=swap" rel="stylesheet">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  /* ====== Impressão 100x150 mm, CSS enxuto ====== */
  @page { size: 100mm 150mm; margin: 4mm; }
  @media print {
    html, body { height: auto; }
    .label { page-break-after: always; }
    .label:last-child { page-break-after: auto; }
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { background: #fff; }  /* tela branca já acelera em alguns navegadores */

  .label {
    width: 100mm; height: 150mm;
    background: #fff; color: #111;
    padding: 4mm 4.5mm 4mm 4.5mm;
    display: flex; flex-direction: column;
    /* borda/sombra removidas para acelerar render */
  }

  .hdr { display: flex; flex-direction: column; flex: 0 0 60mm; }
  .title {
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    font-size: 6mm; font-weight: 800; letter-spacing: .3mm; line-height: 1;
  }
  .pid-box {
    flex: 1 1 auto; display: grid; align-items: end; justify-items: start; overflow: hidden;
  }
  .pid{
    font-family: "Inter Tight", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    font-variation-settings: "wght" 900, "wdth" 100; /* 50..100; 80 deixa mais estreito */
    font-stretch: 80%;
    font-variant-numeric: lining-nums tabular-nums;
    line-height: .92;
    }

  .list {
    flex: 1 1 auto;
    border-top: .4mm solid #000;
    border-bottom: .4mm solid #000;
    padding: 1mm;
    overflow: hidden;
  }

  .line {
    display: inline-grid; grid-auto-flow: column; grid-auto-columns: max-content; column-gap: 1mm;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 4.2mm; line-height: 1.05; white-space: nowrap;
  }
  .line .br { font-weight: 700; }
  .line .sep { opacity: .6; }
  .line .route { font-weight: 500; }
  .line--empty { font-style: italic; opacity: .65; }

  .ftr { margin-top: 2mm; }
  .ftr-title {
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    font-size: 4mm; font-weight: 700; margin-bottom: .5mm;
  }
  .ftr-user {
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    font-size: 4.2mm; font-weight: 600;
  }
</style>
</head>
<body>
${pages}
<script>
/* ====== Auto-fit O(1) para o número do pallet ======
   Suposição: largura do número ≈ DIGITOS * K * fontSize
   Com dígitos tabulares, K ≈ 0.62 (ajustável). Escolhemos:
   fontSizePx = min( boxH * 1, boxW / (digits * K) )
   Assim evitamos binary search e vários reflows. */
(function(){
  const K = 0.62; // fator de largura por dígito (ajuste fino, se quiser)
  function fitOnce(pidEl){
    const box = pidEl.closest('[data-pidbox]');
    if(!box) return;
    const w = box.clientWidth || 1;
    const h = box.clientHeight || 1;
    const digits = Number(pidEl.getAttribute('data-digits') || pidEl.textContent.length) || 2;
    const byH = h * 1;
    const byW = w / (digits * K);
    const size = Math.max(8, Math.min(byH, byW)); // clamp mínimo
    pidEl.style.fontSize = size + 'px';
  }
  function run(){
    document.querySelectorAll('[data-pid]').forEach(fitOnce);
  }
  window.addEventListener('load', () => {
    run();
    try { window.print(); } catch(_){}
  });
  if (window.matchMedia) {
    const mq = window.matchMedia('print');
    if (mq && mq.addEventListener) mq.addEventListener('change', e => { if (e.matches) run(); });
    else if (mq && mq.addListener) mq.addListener(e => { if (e.matches) run(); });
  }
})();
</script>
</body>
</html>`;
}

// Deixa disponível no console para testes manuais
window.processQueue = processQueue;
