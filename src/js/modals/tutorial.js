// src/js/modals/tutorial.js
import { apiGet } from '../api.js';
const tutorialImg = (name) => new URL(`../../assets/img/tutorial/${name}`, import.meta.url).href;

export const meta = {
    title: 'Tutorial',
    size: 'sm',
    showBack: true,
    showClose: true,
    backdropClose: true,
    escToClose: true,
    initialFocus: '#tutorial-root'
};

export default function render(_props = {}, api) {
    api.setBackTo('opdocs');

    const el = document.createElement('div');
    el.id = 'tutorial-root';
    el.className = 'tutorial-modal';
    el.innerHTML = loadingView();

    const state = {
        steps: getDefaultSteps()
    };

    init().catch(err => {
        el.innerHTML = errorView(err?.message || 'Falha ao carregar.');
        if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
    });

    return el;

    async function init() {
        // Mantém padrão dos modais (e garante que sessão/token está ok)
        await apiGet('config');

        el.innerHTML = view(state);
        bind(el);

        if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
    }

    function bind(root) {
        // por enquanto não precisa de binds (só leitura)
        // futuramente: pode colocar um "Baixar modelo CSV", etc.
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
    return `
    <div class="tutorial-list">
      ${state.steps.map(stepCardView).join('')}
    </div>
  `;
}

function stepCardView(step, idx) {
    const n = idx + 1;
    return `
    <section class="tutorial-step" aria-label="${escapeHtml(step.title)}">
      <div class="tutorial-step-head">
        <div class="tutorial-step-badge">${n}</div>
        <div class="tutorial-step-title">${escapeHtml(step.title)}</div>
      </div>

      <div class="tutorial-step-image">
        <img src="${escapeHtml(step.image)}" alt="${escapeHtml(step.title)}" />
        </div>

      <div class="tutorial-step-desc">
        ${escapeHtml(step.description)}
      </div>
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

/* --------------------- Data --------------------- */

function getDefaultSteps() {
  return [
        {
        title: 'Abra a planilha do Romaneio',
        image: tutorialImg('step1.png'),
        description:
            'Abra a planilha do Romaneio envida pela equipe de roteirização do seu hub. Ela deve se parecer com a da imagem acima.'
        },
        {
        title: 'Acesse a página/sheet correta',
        image: tutorialImg('step2.png'),
        description:
            'Navegue até a página/aba de Calculation tasks (CTs) dentro da planilha do Romaneio. É nessa página que estão os dados que você precisa importar.'
        },
        {
        title: 'Baixe o arquivo CSV',
        image: tutorialImg('step3.png'),
        description:
            'No Google Sheets, vá em Arquivo > Fazer download > Valores separados por vírgulas (.csv, atual folha). Isso vai baixar a página atual como um arquivo CSV no seu computador. Isso pode levar alguns segundos.'
        },
        {
        title: 'Importe o arquivo no app',
        image: tutorialImg('step4.png'),
        description:
            'Volte ao VolumososApp e importe o arquivo CSV que você acabou de baixar no menu "Documentos operacionais". Use o botão de upload ou arraste o arquivo para a área indicada.'
        },
        {
        title: 'Confirme e aguarde o processamento',
        image: tutorialImg('step5.png'),
        description:
            'Após importar o arquivo, confirme a importação. O sistema irá processar os dados e atualizar o romaneio do seu hub. Seja paciente, isso pode levar alguns minutos dependendo do tamanho do arquivo.'
        }
    ];
}

/* --------------------- Utils --------------------- */
function escapeHtml(v) { const d = document.createElement('div'); d.textContent = String(v ?? ''); return d.innerHTML; }
