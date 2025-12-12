import { showAlert } from "../utils/alerts.js";
import { loginRequest, guestLoginUser, saveHubLocal as saveHubFromAuth } from "../utils/auth.js";
import { enhanceSelect } from "../utils/uiSelect.js";
import { apiGet } from "../api.js";

export const meta = {
  title: 'Login',
  size: 'sm',
  showBack: false,
  showClose: false,
  backdropClose: false,
  escToClose: false,
  initialFocus: '#login-hub'
};

export default function render(_props = {}, api) {
  const el = document.createElement('div');
  el.className = 'login-form';

  const hubIndex = new Map();

  el.innerHTML = `
    <div class="login-field">
      <div class="login-label">Operação / HUB</div>
      <div class="login-select-wrap">
        <select id="login-hub" class="login-select select-hidden" required>
          <option value="" selected disabled>Selecione uma opção</option>
        </select>
        <div class="ui-select" data-for="login-hub" aria-expanded="false">
          <button type="button" class="ui-select-btn" aria-haspopup="listbox">
            <span class="label">Selecione uma opção</span>
          </button>
          <ul class="ui-select-list" role="listbox"></ul>
        </div>
      </div>
    </div>

    <div class="login-field">
      <div class="login-label">Usuário</div>
      <input id="login-user" class="login-input" type="text" inputmode="text"
             placeholder="Digite seu usuário..." required />
    </div>

    <div class="login-field">
      <div class="login-label">Senha</div>
      <div class="input-with-append">
        <input id="login-pass" class="login-input" type="password"
               placeholder="Digite a sua senha..." required />
        <button type="button" class="btn-eye" id="toggle-pass"
                aria-label="Mostrar senha" aria-pressed="false">
          <i data-lucide="eye" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <div class="login-actions">
      <button type="button" class="login-btn btn--orange" id="login-submit">
        <i data-lucide="log-in" aria-hidden="true"></i>
        <span>Acessar / Entrar</span>
      </button>
      
      <span>ou</span>
            
      <button type="button" class="register-create-btn btn--orange" id="register-create">
        <i data-lucide="user-round-plus" aria-hidden="true"></i>
        <span>Fazer Cadastro</span>
      </button>
      <button type="button" class="guest-btn btn--orange" id="guest-login">
        <i data-lucide="star" aria-hidden="true"></i>
        <span>Sou Convidado</span>
      </button>
    </div>
  `;

  try { window.lucide?.createIcons?.(); } catch { }

  const niceSelect = enhanceSelect(el, 'login-hub');

  initHubs().catch((e) => {
    console.error(e);
    showAlert({
      type: 'error',
      title: 'Erro ao carregar HUBs',
      message: e?.message || 'Não foi possível carregar a lista de HUBs.',
      durationMs: 4000
    });
  });

  async function initHubs() {
    const hubs = await loadHubsConfig();
    buildHubIndex(hubs);
    populateSelect(hubs);

    const saved = localStorage.getItem('hubCode');
    if (saved && hubIndex.has(saved)) {
      el.querySelector('#login-hub').value = saved;
      niceSelect.pick(saved, hubIndex.get(saved).label);
    }
  }

  async function loadHubsConfig() {
    let data;
    try {
      data = await apiGet('hubs'); // GET /api?path=hubs
    } catch (err) {
      console.error('Erro ao buscar hubs:', err);
      throw new Error('Falha ao carregar lista de HUBs');
    }

    if (!data?.ok || !Array.isArray(data.hubs)) {
      throw new Error('Resposta inválida ao carregar HUBs');
    }
    return data.hubs;
  }

  function buildHubIndex(list) {
    hubIndex.clear();
    for (const h of list) {
      const code = String(h.code ?? '').trim();
      const label = String(h.label ?? h.name ?? code).trim();

      if (code) {
        hubIndex.set(code, { code, label });
      }
    }
  }

  function populateSelect(list) {
    const sel = el.querySelector('#login-hub');
    const options = ['<option value="" selected disabled>Selecione uma opção</option>']
      .concat(
        list
          .filter(h => h.code)
          .sort((a, b) =>
            String(a.label || a.name || a.code)
              .localeCompare(String(b.label || b.name || b.code))
          )
          .map(h =>
            `<option value="${h.code}">${h.label || h.name || h.code}</option>`
          )
      )
      .join('');
    sel.innerHTML = options;

    niceSelect.refreshOptions();
  }

  function resolveHub(code) {
    return hubIndex.get(code) || null;
  }

  function saveHub(hub) {
    if (!hub) return;
    saveHubFromAuth({
      code: hub.code,
      label: hub.label
    });
  }

  async function onSubmit() {
    try {
      const submitButton = el.querySelector('#login-submit');
      const modal = document.querySelector('.modal');
      submitButton.classList.add('login-btn--loading');
      modal?.classList?.add('loading');

      const code = el.querySelector('#login-hub').value;
      const username = el.querySelector('#login-user').value.trim();
      const password = el.querySelector('#login-pass').value;

      if (!code || !username || !password) {
        el.querySelector('form')?.reportValidity?.();
        submitButton.classList.remove('login-btn--loading');
        modal?.classList?.remove('loading');
        return;
      }

      const hub = resolveHub(code);
      if (!hub) throw new Error('HUB inválido');
      saveHub(hub);

      const res = await loginRequest({ username, password });

      if (!res) {
        submitButton.classList.remove('login-btn--loading');
        modal?.classList?.remove('loading');
        return;
      }

      submitButton.classList.remove('login-btn--loading');
      modal?.classList?.remove('loading');

      api.close('submit');
    } catch (err) {
      alert(err?.message || 'erro');
    }
  }

  el.querySelector('#login-submit').onclick = onSubmit;
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') onSubmit(); });

  // ======= Olho da senha (toggle) =======
  const passInput = el.querySelector('#login-pass');
  const toggleBtn = el.querySelector('#toggle-pass');

  function swapIcon(name) {
    if (window.lucide?.icons?.[name]?.toSvg) {
      toggleBtn.innerHTML = window.lucide.icons[name].toSvg({ 'aria-hidden': 'true' });
    } else {
      let i = toggleBtn.querySelector('[data-lucide]') || document.createElement('i');
      i.setAttribute('aria-hidden', 'true');
      i.setAttribute('data-lucide', name);
      toggleBtn.innerHTML = '';
      toggleBtn.appendChild(i);
      try { window.lucide?.createIcons?.(); } catch { }
    }
  }

  function setPasswordVisible(show) {
    passInput.type = show ? 'text' : 'password';
    toggleBtn.setAttribute('aria-pressed', String(show));
    toggleBtn.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
    swapIcon(show ? 'eye-off' : 'eye');
  }

  let lastSel = null;

  toggleBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    lastSel = {
      start: passInput.selectionStart,
      end: passInput.selectionEnd,
      dir: passInput.selectionDirection
    };
  });

  toggleBtn.addEventListener('click', () => {
    const willShow = passInput.type === 'password';
    setPasswordVisible(willShow);

    const s = lastSel?.start ?? passInput.value.length;
    const e = lastSel?.end ?? s;
    requestAnimationFrame(() => {
      try { passInput.setSelectionRange(s, e, lastSel?.dir || 'none'); } catch { }
    });
  });

  setPasswordVisible(false);

  // ====== ABRIR MODAL DE REGISTRO / GUEST ======
  const registerBtn = el.querySelector('#register-create');
  const guestBtn    = el.querySelector('#guest-login');

  guestBtn.addEventListener('click', async () => {
    const guestButton = el.querySelector('#guest-login');
    const modal = document.querySelector('.modal');
    guestButton.classList.add('guest-btn--loading');
    modal?.classList?.add('loading');

    try {
      const hubCode = el.querySelector('#login-hub').value;
      if (!hubCode) {
        showAlert({
          type: 'error',
          title: 'HUB não selecionado',
          message: 'Por favor, selecione um HUB válido.',
        });
        return;
      }

      const hub = resolveHub(hubCode);
      if (!hub) {
        showAlert({
          type: 'error',
          title: 'HUB inválido',
          message: 'Por favor, selecione um HUB válido.',
        });
        return;
      }

      saveHub(hub);

      // tentamos login como convidado
      const res = await guestLoginUser();

      if (!res) {
        // guestLoginUser pode já ter mostrado alerta;
        // aqui só garantimos que não fecha o modal.
        return;
      }

      // sucesso
      showAlert({
        type: 'info',
        title: 'Login como convidado',
        message: 'Você entrou como convidado. Algumas funcionalidades podem ser limitadas.',
        durationMs: 3000,
      });

      api.close('submit');
    } catch (err) {
      const msg = String(err?.message || '').toLowerCase();

      if (msg.includes('não permite convidados') || msg.includes('nao permite convidados')) {
        showAlert({
          type: 'error',
          title: 'Convidados não permitidos',
          message: 'Este HUB não permite convidados, acesse usando seu e-mail shopee.',
          durationMs: 4000,
        });
      } else {
        showAlert({
          type: 'error',
          title: 'Falha ao autenticar!',
          message: err?.message || 'Não foi possível entrar como convidado.',
          durationMs: 4000,
        });
      }
    } finally {
      guestButton.classList.remove('guest-btn--loading');
      modal?.classList?.remove('loading');
    }
  });

  registerBtn.addEventListener('click', () => {
    openModal({
      type: 'register',
    });
  });

  return el;
}
