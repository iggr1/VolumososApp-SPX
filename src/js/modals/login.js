import { loginRequest } from "../utils/auth.js";

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
      <button type="button" class="btn btn--orange" id="login-submit">
        <i data-lucide="log-in" aria-hidden="true"></i>
        <span>ENTRAR</span>
      </button>
    </div>
  `;

  // Se o Lucide estiver carregado, (re)cria os ícones desse bloco também
  try { window.lucide?.createIcons?.(); } catch { }

  const niceSelect = enhanceSelect(el, 'login-hub');

  initHubs().catch((e) => alert(e?.message || 'Erro ao carregar hubs'));

  async function initHubs() {
    const cfg = await loadHubsConfig();
    buildHubIndex(cfg);
    populateSelect(cfg);
    const saved = sessionStorage.getItem('hubCode');
    if (saved && hubIndex.has(saved)) {
      el.querySelector('#login-hub').value = saved;
      niceSelect.pick(saved, hubIndex.get(saved).label);
    }
  }

  async function loadHubsConfig() {
    const url = new URL('data/hubs.json', document.baseURI);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Falha ao baixar hubs.json');
    const data = await res.json();
    if (!data || !Array.isArray(data.hubs)) throw new Error('Formato inválido em hubs.json');
    return data.hubs;
  }

  function buildHubIndex(list) {
    hubIndex.clear();
    for (const h of list) {
      const code = String(h.code ?? h.value ?? h.id ?? h.name ?? '').trim();
      const label = String(h.name ?? h.label ?? code);
      const server = String(h.server ?? '').trim();
      if (code && server) hubIndex.set(code, { code, label, server });
    }
  }

  function populateSelect(list) {
    const sel = el.querySelector('#login-hub');
    const options = ['<option value="" selected disabled>Selecione uma opção</option>']
      .concat(
        list
          .filter(h => (h.code ?? h.value) && h.server)
          .sort((a, b) => String(a.name).localeCompare(String(b.name)))
          .map(h => `<option value="${h.code}">${h.name}</option>`)
      )
      .join('');
    sel.innerHTML = options;

    const listEl = el.querySelector('.ui-select-list');
    listEl.innerHTML = '';
    Array.from(sel.options).forEach((op) => {
      const li = document.createElement('li');
      li.className = 'ui-option';
      li.role = 'option';
      li.dataset.value = op.value;
      li.textContent = op.textContent;
      li.tabIndex = 0;
      if (op.selected) li.setAttribute('aria-selected', 'true');
      li.onclick = () => niceSelect.pick(op.value, op.textContent);
      li.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); } };
      listEl.appendChild(li);
    });
  }

  function resolveHub(code) { return hubIndex.get(code) || null; }

  function saveHubLocal(hub) {
    sessionStorage.setItem('hubCode', hub.code);
    sessionStorage.setItem('hubServer', hub.server);
    sessionStorage.setItem('hubLabel', hub.label);
  }

  function baseUrl() {
    const s = sessionStorage.getItem('hubServer');
    if (!s) throw new Error('Selecione um HUB válido');
    return s;
  }

  async function onSubmit() {
    try {
      const submitButton = el.querySelector('#login-submit');
      const modal = document.querySelector('.modal');
      submitButton.classList.add('btn--loading');
      modal?.classList?.add('loading');

      const code = el.querySelector('#login-hub').value;
      const username = el.querySelector('#login-user').value.trim();
      const password = el.querySelector('#login-pass').value;
      if (!code || !username || !password) {
        el.querySelector('form')?.reportValidity?.();
        submitButton.classList.remove('btn--loading');
        modal?.classList?.remove('loading');
        return;
      }

      const hub = resolveHub(code);
      if (!hub) throw new Error('HUB sem servidor configurado');
      saveHubLocal(hub);

      const res = await loginRequest({ username, password, baseUrl });

      if (!res) {
        submitButton.classList.remove('btn--loading');
        modal?.classList?.remove('loading');
        return;
      }

      submitButton.classList.remove('btn--loading');
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

  // Evita perder o foco e captura a seleção/caret antes de trocar o type
  toggleBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); // mantém o foco no input
    lastSel = {
      start: passInput.selectionStart,
      end: passInput.selectionEnd,
      dir: passInput.selectionDirection
    };
  });

  toggleBtn.addEventListener('click', () => {
    const willShow = passInput.type === 'password';
    setPasswordVisible(willShow);

    // Restaura a seleção/caret no próximo frame (mais confiável em Safari/iOS)
    const s = lastSel?.start ?? passInput.value.length;
    const e = lastSel?.end ?? s;
    requestAnimationFrame(() => {
      try { passInput.setSelectionRange(s, e, lastSel?.dir || 'none'); } catch { }
    });
  });

  // Estado inicial
  setPasswordVisible(false);

  return el;
}

function enhanceSelect(root, selectId) {
  const sel = root.querySelector('#' + selectId);
  const wrap = root.querySelector(`.ui-select[data-for="${selectId}"]`);
  const btn = wrap.querySelector('.ui-select-btn');
  const list = wrap.querySelector('.ui-select-list');

  function open(v) { wrap.setAttribute('aria-expanded', 'true'); if (v) focusCurrent(); }
  function close() { wrap.setAttribute('aria-expanded', 'false'); }
  function toggle() { wrap.getAttribute('aria-expanded') === 'true' ? close() : open(true); }
  function pick(value, label) {
    if (!value) return;
    sel.value = value;
    btn.querySelector('.label').textContent = label;
    list.querySelectorAll('.ui-option').forEach(li => {
      li.toggleAttribute('aria-selected', li.dataset.value === value);
    });
    close();
  }
  function focusCurrent() {
    const cur = list.querySelector('.ui-option[aria-selected="true"]') || list.querySelector('.ui-option');
    cur?.focus();
  }

  const init = sel.options[sel.selectedIndex];
  if (init) btn.querySelector('.label').textContent = init.textContent;

  btn.onclick = toggle;
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  btn.onkeydown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(true); }
  };

  return { pick, open, close };
}
