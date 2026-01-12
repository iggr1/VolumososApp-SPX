// src/js/modals/about.js
import { showAlert } from '../utils/alerts.js';

export const meta = {
  title: 'Sobre o VolumososApp',
  size: 'sm',
  showBack: true,
  showClose: true,
  backdropClose: true,
  escToClose: true,
  initialFocus: '#about-root',
};

export default function render(_props = {}, _api) {
  const el = document.createElement('div');
  el.id = 'about-root';
  el.className = 'about-form';

  const info = collectBuildInfo();

  el.innerHTML = `
    <div class="about-header">
      <div class="app-badge">
        <i data-lucide="info" aria-hidden="true"></i>
        <div class="app-id">
          <div class="app-name">VolumososApp SPX</div>
          <div class="app-version">v${info.version} • ${info.env}</div>
        </div>
      </div>
    </div>

      <section class="about-section">
        <h3><i data-lucide="flag" aria-hidden="true"></i> Finalidade</h3>
        <p>
          Ferramenta de apoio operacional para leitura de códigos, organização de pallets
          e consolidação de dados, focada em produtividade e rastreabilidade.
        </p>
      </section>

      <section class="about-section">
        <h3><i data-lucide="database" aria-hidden="true"></i> Dados e Privacidade</h3>
        <ul>
          <li>Itens do pallet atual ficam no armazenamento local do navegador.</li>
          <li>Comunicação com Apps Script/Sheets dedicados por HUB.</li>
          <li>Sem compartilhamento com terceiros fora da infraestrutura configurada.</li>
        </ul>
      </section>

      <section class="about-section">
        <h3><i data-lucide="wrench" aria-hidden="true"></i> Informações Técnicas</h3>
        <div class="kv">
          <div>Versão</div><div>v${info.version}</div>
          <div>Build</div><div>${info.build}</div>
          <div>Ambiente</div><div>${info.env}</div>
          <div>Navegador</div><div>${info.ua}</div>
          <div>Resolução</div><div>${info.size}</div>
          <div>Timezone</div><div>${info.tz}</div>
        </div>
      </section>

      <section class="about-section">
        <h3><i data-lucide="user" aria-hidden="true"></i> Desenvolvedor</h3>
        <p>
          igor.camara
        </p>
        <p>
          <a href="https://github.com/iggr1" target="_blank" rel="noopener">GitHub</a>  | 
          <a href="https://www.linkedin.com/in/igor-gabriel-camara" target="_blank" rel="noopener">LinkedIn</a>
        </p>
      </section>

      <button type="button"
              class="btn btn"
              data-action="copy">
        <i data-lucide="clipboard-copy" aria-hidden="true"></i>
        <span>Copiar informações</span>
      </button>

      <button type="button"
              class="btn btn--orange"
              data-action="changelog">
        <i data-lucide="history" aria-hidden="true"></i>
        <span>Changelog</span>
      </button>
  `;

  // Ícones
  try {
    window.lucide?.createIcons?.();
  } catch {}

  // Ações
  el.querySelector('[data-action="copy"]')?.addEventListener('click', async () => {
    const text = buildDiagnostics(info);
    try {
      await navigator.clipboard.writeText(text);
      showAlert({
        type: 'success',
        title: 'Copiado',
        message: 'Informações técnicas copiadas.',
        durationMs: 1500,
      });
    } catch {
      showAlert({
        type: 'warning',
        title: 'Falhou ao copiar',
        message: 'Não foi possível copiar. Selecione e copie manualmente.',
        durationMs: 2500,
      });
    }
  });

  el.querySelector('[data-action="changelog"]')?.addEventListener('click', () => {
    // ajuste o link ao seu repo
    window.open('https://github.com/iggr1/VolumososApp-SPX/commits/main', '_blank', 'noopener');
  });

  return el;
}

/* ---------------- helpers ---------------- */

function collectBuildInfo() {
  const byWindow = (window.APP_VERSION && String(window.APP_VERSION)) || '';
  const byMeta = document.querySelector('meta[name="app-version"]')?.getAttribute('content') || '';
  const byBody = document.body?.dataset?.version || '';
  const version = byWindow || byMeta || byBody || '0.0.0';

  const build =
    (window.APP_BUILD && String(window.APP_BUILD)) ||
    document.querySelector('meta[name="app-build"]')?.getAttribute('content') ||
    document.body?.dataset?.build ||
    '-';

  const env =
    (window.APP_ENV && String(window.APP_ENV)) ||
    document.querySelector('meta[name="app-env"]')?.getAttribute('content') ||
    (location.hostname.includes('localhost') ? 'dev' : 'prod');

  const ua = navigator.userAgent;
  const size = `${window.innerWidth}×${window.innerHeight}`;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  return { version, build, env, ua, size, tz };
}

function buildDiagnostics(i) {
  return [
    `VolumososApp v${i.version} (${i.env})`,
    `Build: ${i.build}`,
    `UA: ${i.ua}`,
    `Size: ${i.size}`,
    `TZ: ${i.tz}`,
    `URL: ${location.href}`,
  ].join('\n');
}
