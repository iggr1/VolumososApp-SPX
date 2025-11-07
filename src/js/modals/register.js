// register.js
import { setBase } from '../api.js';
import {
    publicRegisterUser,
    setUserInfo,
    normalizeIdentifier,
    isValidOpsId,
    saveHubLocal,
    requestEmailVerification // [EMAIL VERIFY]
} from '../utils/auth.js';
import { showAlert, showConfirmAlert } from '../utils/alerts.js';
import { updateCounts } from '../utils/helper.js';
import { getConfigs } from '../utils/config.js';

export const meta = {
    title: 'Criar Conta',
    size: 'sm',
    showBack: true,
    showClose: false,
    backdropClose: false,
    escToClose: false,
    initialFocus: '#reg-hub'
};

export default function render(_props = {}, api) {
    api.setBackTo('login');

    const hubIndex = new Map();

    const el = document.createElement('div');
    el.className = 'register-form';

    el.innerHTML = `
    <!-- HUB SELEÇÃO -->
    <div class="register-field">
      <div class="register-label">Operação / HUB</div>
      <div class="login-select-wrap">
        <select id="reg-hub" class="register-input select-hidden" required>
          <option value="" selected disabled>Selecione uma opção</option>
        </select>

        <div class="ui-select" data-for="reg-hub" aria-expanded="false">
          <button type="button" class="ui-select-btn" aria-haspopup="listbox">
            <span class="label">Selecione uma opção</span>
          </button>
          <ul class="ui-select-list" role="listbox"></ul>
        </div>
      </div>
    </div>

    <!-- IDENTIFICAÇÃO -->
    <div class="register-field">
      <div class="register-label">Usuário / E-mail corporativo</div>
      <input id="reg-user" class="register-input" type="text"
             placeholder="ex: Ops12345 ou nome@shopee.com" required />
      <div class="register-hint">
        OpsXXXXX ou e-mail @shopee.com / @shopeemobile-external.com
      </div>
    </div>

    <!-- NOME COMPLETO (para OpsXXXXX) -->
    <div class="register-field" id="full-name-field" hidden>
      <div class="register-label">Nome completo</div>
      <input id="reg-fullname" class="register-input" type="text"
             placeholder="Digite seu nome completo..." />
      <div class="register-hint">
        ex.: Nome Segundonome Sobrenome
      </div>
    </div>

    <!-- SENHA -->
    <div class="register-field">
      <div class="register-label">Senha</div>
      <div class="register-input-row">
        <input id="reg-pass" class="register-input" type="password"
               placeholder="Crie uma senha/PIN" required />
        <button type="button" class="register-eye-btn" id="toggle-pass-main"
                aria-label="Mostrar senha" aria-pressed="false">
          <i data-lucide="eye" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <!-- CONFIRMAR SENHA -->
    <div class="register-field">
      <div class="register-label">Repita a senha</div>
      <div class="register-input-row">
        <input id="reg-pass-confirm" class="register-input" type="password"
               placeholder="Repita a mesma senha" required />
        <button type="button" class="register-eye-btn" id="toggle-pass-confirm"
                aria-label="Mostrar senha" aria-pressed="false">
          <i data-lucide="eye" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <!-- [EMAIL VERIFY] CÓDIGO DE VERIFICAÇÃO (apenas para e-mail) -->
    <div class="register-field" id="email-code-field" hidden>
      <div class="register-label">Código de verificação</div>
      <div class="register-input-row">
        <input id="reg-email-code" class="register-input"
               type="text" inputmode="numeric" maxlength="6"
               placeholder="Código no seu e-mail" />
        <button type="button"
                class="register-btn register-btn--ghost"
                id="reg-resend-code">
          <i data-lucide="refresh-cw" aria-hidden="true"></i>
        </button>
      </div>
      <div class="register-hint">
        Verifique sua caixa de entrada e SPAM.
      </div>
    </div>

    <!-- AÇÕES -->
    <div class="register-actions">
      <button type="button" class="register-btn register-btn--orange" id="reg-submit">
        <i data-lucide="user-plus" aria-hidden="true"></i>
        <span>Criar Conta</span>
      </button>
    </div>
  `;

    try { window.lucide?.createIcons?.(); } catch { }

    // ====== REFERÊNCIAS ======
    const identInput = el.querySelector('#reg-user');
    const fullNameField = el.querySelector('#full-name-field');
    const fullNameInput = el.querySelector('#reg-fullname');
    const emailCodeField = el.querySelector('#email-code-field');
    const emailCodeInput = el.querySelector('#reg-email-code');
    const resendCodeBtn = el.querySelector('#reg-resend-code');
    const submitButton = el.querySelector('#reg-submit');

    let lastNorm = null;
    let hasPendingEmailCode = false;

    // ====== EXIBIR / ESCONDER NOME COMPLETO PARA OpsXXXXX ======
    function refreshFullNameVisibility() {
        const ident = identInput.value.trim();
        if (isValidOpsId(ident)) {
            fullNameField.hidden = false;
        } else {
            fullNameField.hidden = true;
            fullNameInput.value = '';
        }
    }

    identInput.addEventListener('input', () => {
        refreshFullNameVisibility();

        // reset fluxo de e-mail ao mudar identificador
        emailCodeField.hidden = true;
        emailCodeInput.value = '';
        hasPendingEmailCode = false;
        lastNorm = null;
        submitButton.querySelector('span').textContent = 'Criar Conta';
    });

    refreshFullNameVisibility();

    // ====== HELPERS ======
    function setLoadingState(isLoading) {
        const modalEl = document.querySelector('.modal');
        submitButton.classList.toggle('register-btn--loading', isLoading);
        modalEl?.classList?.toggle('loading', isLoading);
    }

    function emitErrorToast(title, message) {
        if (typeof window.showAlert === 'function') {
            window.showAlert({
                type: 'error',
                title,
                message,
                durationMs: 3000
            });
        } else {
            showAlert({ type: 'error', title, message });
        }
    }

    function validateInputs() {
        const hubCode = el.querySelector('#reg-hub').value;
        const rawIdent = identInput.value.trim();
        const pass1 = el.querySelector('#reg-pass').value;
        const pass2 = el.querySelector('#reg-pass-confirm').value;
        const fullName = fullNameInput.value.trim();

        if (!hubCode || !rawIdent || !pass1 || !pass2) {
            showAlert({
                type: 'error',
                title: 'Campos incompletos',
                message: 'Preencha todos os campos obrigatórios.'
            });
            return null;
        }

        if (pass1.length < 6) {
            showAlert({
                type: 'error',
                title: 'Senha muito curta',
                message: 'A senha deve ter pelo menos 6 caracteres.'
            });
            return null;
        }

        if (pass1 !== pass2) {
            showAlert({
                type: 'error',
                title: 'Senhas não conferem',
                message: 'As senhas digitadas são diferentes. Verifique e tente novamente.'
            });
            return null;
        }

        const norm = normalizeIdentifier(rawIdent, fullName);
        if (!norm.ok) {
            showAlert({
                type: 'error',
                title: 'Identificador inválido',
                message: norm.error || 'Verifique o usuário/e-mail informado.'
            });
            return null;
        }

        const hub = hubIndex.get(hubCode);
        if (!hub) {
            showAlert({
                type: 'error',
                title: 'HUB inválido',
                message: 'Selecione um HUB válido.'
            });
            return null;
        }

        lastNorm = norm;

        return {
            ident: norm.ident,
            pass: pass1,
            hub,
            mode: norm.mode // 'ops' | 'email'
        };
    }

    async function confirmHubAndForm(hubLabel, onConfirm) {
        const message =
            `O seu HUB é "${hubLabel}"?\n\n` +
            `Confira se todos os dados estão corretos, deseja prosseguir?`;

        // Se existir showConfirmAlert (retorna Promise<boolean>)
        if (typeof showConfirmAlert === 'function') {
            // para não ficar com o botão travado enquanto a pessoa lê
            setLoadingState(false);

            const ok = await showConfirmAlert({
                type: 'info',
                title: 'Confirmação de dados',
                message
                // yesText / noText opcionais, usa padrão "Sim" / "Não"
            });

            if (!ok) {
                // usuário cancelou
                setLoadingState(false);
                return false;
            }

            // confirmou → volta loading e executa a ação
            setLoadingState(true);
            await onConfirm();
            return true;
        }

        // Fallback: window.confirm
        const ok = window.confirm(message);
        if (!ok) {
            setLoadingState(false);
            return false;
        }

        setLoadingState(true);
        await onConfirm();
        return true;
    }

    // ====== [EMAIL VERIFY] REENVIAR CÓDIGO ======
    resendCodeBtn.addEventListener('click', async () => {
        if (!lastNorm || lastNorm.mode !== 'email') return;

        try {
            setLoadingState(true);
            const res = await requestEmailVerification(lastNorm.ident);
            if (!res || res.ok !== true) {
                const msg = res?.error || 'Não foi possível reenviar o código.';
                emitErrorToast('Falha ao reenviar código', msg);
                return;
            }

            showAlert({
                type: 'success',
                title: 'Código reenviado',
                message: `Enviamos um novo código para ${lastNorm.ident}.`
            });
        } catch (err) {
            console.error('Erro ao reenviar código:', err);
            emitErrorToast('Erro', 'Não foi possível reenviar o código.');
        } finally {
            setLoadingState(false);
        }
    });

    // ====== SUBMIT ======
    async function onSubmit() {
        setLoadingState(true);

        const info = validateInputs();
        if (!info) {
            setLoadingState(false);
            return;
        }

        const { ident, pass, hub, mode } = info;

        // aponta o cliente pro hub certo
        setBase(hub.server);

        // ---------- OPS: fluxo com confirmação ----------
        if (mode === 'ops') {
            const runRegisterOps = async () => {
                try {
                    const data = await publicRegisterUser({ username: ident, password: pass });

                    if (!data || data.ok !== true) {
                        const msg = data?.error || 'Não foi possível criar a conta.';
                        emitErrorToast('Falha ao criar conta', msg);
                        setLoadingState(false);
                        return;
                    }

                    setUserInfo(data.username, data.token, data.avatar_id);

                    showAlert({
                        type: 'success',
                        title: 'Conta criada com sucesso!',
                        message: 'Você já será logado.'
                    });

                    saveHubLocal(hub);
                    localStorage.setItem('authToken', data.token);

                    getConfigs();
                    updateCounts();

                    setLoadingState(false);
                    api.close('registered');
                } catch (err) {
                    console.error('Erro no registro Ops (catch):', err);
                    const msg =
                        (err && err.message) ||
                        (err && err.data && err.data.error) ||
                        'Falha ao criar conta.';
                    emitErrorToast('Falha ao criar conta', msg);
                    setLoadingState(false);
                }
            };

            // abre confirmação e só registra se confirmar
            confirmHubAndForm(hub.label, runRegisterOps);
            return;
        }

        // ---------- EMAIL: 2 etapas + confirmação ----------
        if (mode === 'email') {
            try {
                // Etapa 1: enviar código
                if (!hasPendingEmailCode || emailCodeField.hidden) {
                    const res = await requestEmailVerification(ident);

                    if (!res || res.ok !== true) {
                        const msg = res?.error || 'Não foi possível enviar o código de verificação.';
                        emitErrorToast('Falha ao enviar código', msg);
                        setLoadingState(false);
                        return;
                    }

                    hasPendingEmailCode = true;
                    emailCodeField.hidden = false;
                    submitButton.querySelector('span').textContent = 'Confirmar código';

                    showAlert({
                        type: 'info',
                        title: 'Verifique seu e-mail',
                        message: `Enviamos um código de verificação para ${ident}.`
                    });

                    setLoadingState(false);
                    return;
                }

                // Etapa 2: validar código + confirmar antes de registrar
                const emailCode = (emailCodeInput.value || '').trim();
                if (!emailCode) {
                    emitErrorToast('Código obrigatório', 'Digite o código enviado para seu e-mail.');
                    setLoadingState(false);
                    return;
                }

                const runRegisterEmail = async () => {
                    try {
                        const data = await publicRegisterUser({
                            username: ident,
                            password: pass,
                            email_code: emailCode
                        });

                        if (!data || data.ok !== true) {
                            const msg = data?.error || 'Não foi possível criar a conta.';
                            emitErrorToast('Falha ao criar conta', msg);
                            setLoadingState(false);
                            return;
                        }

                        setUserInfo(data.username, data.token, data.avatar_id);

                        showAlert({
                            type: 'success',
                            title: 'Conta criada com sucesso!',
                            message: 'E-mail verificado e login efetuado.'
                        });

                        saveHubLocal(hub);
                        localStorage.setItem('authToken', data.token);

                        getConfigs();
                        updateCounts();

                        setLoadingState(false);
                        api.close('registered');
                    } catch (err) {
                        console.error('Erro no registro com e-mail (catch):', err);
                        const msg =
                            (err && err.message) ||
                            (err && err.data && err.data.error) ||
                            'Falha ao criar conta.';
                        emitErrorToast('Falha ao criar conta', msg);
                        setLoadingState(false);
                    }
                };

                // abre confirmação (hub + confira campos) e só registra se confirmar
                confirmHubAndForm(hub.label, runRegisterEmail);
            } catch (err) {
                console.error('Erro no fluxo de registro por e-mail (catch):', err);
                const msg =
                    (err && err.message) ||
                    (err && err.data && err.data.error) ||
                    'Falha ao processar registro.';
                emitErrorToast('Falha ao processar registro', msg);
                setLoadingState(false);
            }

            return;
        }

        // fallback
        setLoadingState(false);
    }

    submitButton.onclick = onSubmit;
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') onSubmit();
    });

    // ====== Toggle olhos senha ======
    const passInputMain = el.querySelector('#reg-pass');
    const passInputConf = el.querySelector('#reg-pass-confirm');
    const toggleMain = el.querySelector('#toggle-pass-main');
    const toggleConf = el.querySelector('#toggle-pass-confirm');

    function swapIcon(btn, name) {
        if (window.lucide?.icons?.[name]?.toSvg) {
            btn.innerHTML = window.lucide.icons[name].toSvg({ 'aria-hidden': 'true' });
        } else {
            let i = btn.querySelector('[data-lucide]') || document.createElement('i');
            i.setAttribute('aria-hidden', 'true');
            i.setAttribute('data-lucide', name);
            btn.innerHTML = '';
            btn.appendChild(i);
            try { window.lucide?.createIcons?.(); } catch { }
        }
    }

    function setVisible(input, btn, show) {
        input.type = show ? 'text' : 'password';
        btn.setAttribute('aria-pressed', String(show));
        btn.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
        swapIcon(btn, show ? 'eye-off' : 'eye');
    }

    function setupToggle(input, btn) {
        let lastSel = null;

        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            lastSel = {
                start: input.selectionStart,
                end: input.selectionEnd,
                dir: input.selectionDirection
            };
        });

        btn.addEventListener('click', () => {
            const willShow = input.type === 'password';
            setVisible(input, btn, willShow);

            const caretStart = lastSel?.start ?? input.value.length;
            const caretEnd = lastSel?.end ?? caretStart;
            const caretDir = lastSel?.dir || 'none';
            requestAnimationFrame(() => {
                try { input.setSelectionRange(caretStart, caretEnd, caretDir); } catch { }
            });
        });

        setVisible(input, btn, false);
    }

    setupToggle(passInputMain, toggleMain);
    setupToggle(passInputConf, toggleConf);

    // ====== HUB SELECT ======
    const niceSelect = enhanceSelect(el, 'reg-hub');

    initHubs().catch(err =>
        showAlert({
            type: 'error',
            title: 'Erro ao carregar hubs',
            message: err?.message || 'Erro ao carregar hubs.'
        })
    );

    async function initHubs() {
        const cfg = await loadHubsConfig();
        buildHubIndex(cfg);
        populateSelect(cfg);

        const saved = localStorage.getItem('hubCode');
        if (saved && hubIndex.has(saved)) {
            el.querySelector('#reg-hub').value = saved;
            niceSelect.pick(saved, hubIndex.get(saved).label);
        }
    }

    async function loadHubsConfig() {
        const url = new URL('data/hubs.json', document.baseURI);
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('Falha ao baixar hubs.json');
        const data = await res.json();
        if (!data || !Array.isArray(data.hubs)) {
            throw new Error('Formato inválido em hubs.json');
        }
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
        const sel = el.querySelector('#reg-hub');
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
            li.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    li.click();
                }
            };

            listEl.appendChild(li);
        });
    }

    return el;
}

/* select helper igual ao do login */
function enhanceSelect(root, selectId) {
    const sel = root.querySelector('#' + selectId);
    const wrap = root.querySelector(`.ui-select[data-for="${selectId}"]`);
    const btn = wrap.querySelector('.ui-select-btn');
    const list = wrap.querySelector('.ui-select-list');

    function open(v) {
        wrap.setAttribute('aria-expanded', 'true');
        if (v) focusCurrent();
    }
    function close() {
        wrap.setAttribute('aria-expanded', 'false');
    }
    function toggle() {
        (wrap.getAttribute('aria-expanded') === 'true') ? close() : open(true);
    }
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
        const cur =
            list.querySelector('.ui-option[aria-selected="true"]') ||
            list.querySelector('.ui-option');
        cur?.focus();
    }

    const init = sel.options[sel.selectedIndex];
    if (init) btn.querySelector('.label').textContent = init.textContent;

    btn.onclick = toggle;

    document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) close();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
    });

    btn.onkeydown = (e) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open(true);
        }
    };

    return { pick, open, close };
}
