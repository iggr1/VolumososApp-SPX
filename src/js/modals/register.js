// register.js
import { setBase } from '../api.js';
import { publicRegisterUser, setUserInfo } from '../utils/auth.js';
import { showAlert } from '../utils/alerts.js';

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
    // botão voltar no header leva pro modal 'login'
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

    <!-- NOME COMPLETO (inicia escondido) -->
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

    <!-- AÇÕES -->
    <div class="register-actions">
        <button type="button" class="register-btn register-btn--orange" id="reg-submit">
            <i data-lucide="user-plus" aria-hidden="true"></i>
            <span>Criar Conta</span>
        </button>
    </div>
    `;

    // Ícones Lucide (olhinho etc.)
    try { window.lucide?.createIcons?.(); } catch { }

    // ====== VALIDADORES ======

    function isValidOps(str) {
        // Começa com "Ops", depois só dígitos.
        // Ex.: Ops1, Ops32436, Ops00001
        return /^Ops\d+$/.test(str);
    }

    function isValidEmail(str) {
        const lower = str.toLowerCase().trim();
        // formato geral de email
        const basic = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower);
        if (!basic) return false;
        // domínio permitido
        return (
            lower.endsWith('@shopee.com') ||
            lower.endsWith('@shopeemobile-external.com')
        );
    }

    // Referências aos campos
    const identInput = el.querySelector('#reg-user');
    const fullNameField = el.querySelector('#full-name-field');
    const fullNameInput = el.querySelector('#reg-fullname');

    // mostra/esconde o campo Nome Completo dependendo se o identificador é OpsXXXXX
    function refreshFullNameVisibility() {
        const ident = identInput.value.trim();
        if (isValidOps(ident)) {
            fullNameField.hidden = false;
        } else {
            fullNameField.hidden = true;
            fullNameInput.value = '';
        }
    }

    identInput.addEventListener('input', refreshFullNameVisibility);
    refreshFullNameVisibility(); // estado inicial

    function validateInputs() {
        const hubCode = el.querySelector('#reg-hub').value;
        const rawIdent = identInput.value.trim();     // o que o usuário digitou
        const pass1 = el.querySelector('#reg-pass').value;
        const pass2 = el.querySelector('#reg-pass-confirm').value;
        const fullName = fullNameInput.value.trim();  // só é relevante se for Ops

        if (!hubCode || !rawIdent || !pass1 || !pass2) {
            showAlert({
                type: 'error',
                title: 'Campos incompletos',
                message: 'Preencha todos os campos obrigatórios.'
            });
            return null;
        }

        const opsMode = isValidOps(rawIdent);
        const emailMode = isValidEmail(rawIdent);

        if (!opsMode && !emailMode) {
            showAlert({
                type: 'error',
                title: 'Identificador inválido',
                message: 'Usuário/E-mail precisa ser OpsXXXXX ou um e-mail @shopee.com / @shopeemobile-external.com.'
            });
            return null;
        }

        // Montar o ident final:
        // - se for OpsXXXXX -> "[ops12345]Nome Completo"
        // - se for email -> fica o próprio email
        let finalIdent;
        if (opsMode) {
            if (!fullName) {
                showAlert({
                    type: 'error',
                    title: 'Nome completo obrigatório',
                    message: 'Para usuários OpsXXXXX, o nome completo é obrigatório.'
                });
                return null;
            }

            const numPart = rawIdent.slice(3);       // remove "Ops"
            const opsTag = `ops${numPart}`;         // deixa "ops" minúsculo
            finalIdent = `[${opsTag}]` + fullName; // sem espaço depois do ]
        } else {
            finalIdent = rawIdent;
        }

        if (pass1 !== pass2) {
            showAlert({
                type: 'error',
                title: 'Senhas não conferem',
                message: 'As senhas digitadas são diferentes. Verifique e tente novamente.'
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

        return {
            ident: finalIdent, // <- já no formato correto pra salvar/enviar
            pass: pass1,
            hub   // { code, label, server }
        };
    }

    // helper: tenta exibir um toast, se não tiver toast cai em alert(msg)
    function emitErrorToast(title, message) {
        if (typeof window.showAlert === 'function') {
            window.showAlert({
                type: 'error',
                title,
                message,
                durationMs: 3000
            });
        } else {
            showAlert({
                type: 'error',
                title,
                message
            });
        }
    }

    async function onSubmit() {
        const submitButton = el.querySelector('#reg-submit');
        const modalEl = document.querySelector('.modal');

        function cleanup() {
            submitButton.classList.remove('register-btn--loading');
            modalEl?.classList?.remove('loading');
        }

        // liga spinner
        submitButton.classList.add('register-btn--loading');
        modalEl?.classList?.add('loading');

        // 1. valida campos antes de chamar servidor
        const info = validateInputs();
        if (!info) {
            cleanup();
            return;
        }

        const { ident, pass, hub } = info;

        // aponta o cliente pro hub certo (isso configura a BASE usada por apiPost)
        setBase(hub.server);

        // payload no formato esperado pelo Apps Script
        const payload = {
            username: ident, // "[ops12345]Nome Completo" OU "alguem@shopee.com"
            password: pass
        };

        try {
            const data = await publicRegisterUser(payload);
            // Possibilidades de data:
            // - sucesso:
            //   { ok: true, username, role, token, ... }
            // - erro "lógico", mas HTTP 200:
            //   { error: "senha muito curta" }
            // - erro "lógico", mas sem nada útil:
            //   {}

            // Caso NÃO tenha ok:true, tratamos como falha de criação
            if (!data || data.ok !== true) {
                const msg = data?.error || 'Não foi possível criar a conta.';
                emitErrorToast('Falha ao criar conta', msg);
                cleanup(); // mantém modal aberto
                return;
            }

            // ======== SUCESSO ========
            setUserInfo(data.username, data.token, data.avatar_id);

            showAlert({
                type: 'success',
                title: 'Conta criada com sucesso!',
                message: 'Você já será logado.'
            });

            // salva info do hub (igual login faz)
            saveHubLocal(hub);

            // já loga o usuário na sessão
            localStorage.setItem('authToken', data.token);

            cleanup();
            api.close('registered'); // fecha modal só aqui, pq deu certo
        } catch (err) {
            console.error('Erro no registro (catch):', err);

            // Se caiu no catch é porque apiRequest lançou ApiError:
            // err.message normalmente já vem com o texto do servidor (ex: "senha muito curta")
            // mas vamos ter fallback:
            const msg =
                (err && err.message) ||
                (err && err.data && err.data.error) ||
                'Falha ao criar conta.';

            emitErrorToast('Falha ao criar conta', msg);

            cleanup(); // mantém modal aberto
            return;
        }
    }

    el.querySelector('#reg-submit').onclick = onSubmit;
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') onSubmit();
    });

    // ====== Toggle do olho de senha ======
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

        // começa oculto
        setVisible(input, btn, false);
    }

    setupToggle(passInputMain, toggleMain);
    setupToggle(passInputConf, toggleConf);

    // ====== HUB SELECT (mesmo padrão do login) ======
    const niceSelect = enhanceSelect(el, 'reg-hub');
    initHubs().catch(err => showAlert({
        type: 'error',
        title: 'Erro ao carregar hubs',
        message: err?.message || 'Erro ao carregar hubs.'
    }));

    async function initHubs() {
        const cfg = await loadHubsConfig();
        buildHubIndex(cfg);
        populateSelect(cfg);

        // tenta usar HUB já guardado na sessão
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

    function saveHubLocal(hub) {
        localStorage.setItem('hubCode', hub.code);
        localStorage.setItem('hubServer', hub.server);
        localStorage.setItem('hubLabel', hub.label);
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
        const cur = list.querySelector('.ui-option[aria-selected="true"]')
            || list.querySelector('.ui-option');
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
