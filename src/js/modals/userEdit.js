// src/js/modals/userEdit.js
import { createUser, updateUser, deleteUser } from '../api.js';
import { showConfirmAlert, showAlert } from '../utils/alerts.js';

export const meta = {
    title: 'Usuário',
    size: 'sm',
    showBack: true,
    showClose: true,
    backdropClose: true,
    escToClose: true,
};

export default function render(props = {}, api) {
    const mode = props.mode === 'create' ? 'create' : 'edit';
    const orig = normalizeUser(props.user);
    api.setBackTo('users');

    const el = document.createElement('div');
    el.className = 'ue-modal';

    let state = {
        username: orig.username,
        role: orig.role,
        newPassword: '',
        resetToken: false
    };
    let initial = snapshot(state);
    let dirty = false;
    let deleted = false;

    el.innerHTML = view(mode, state);
    if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });

    // --- monta o select estilizado para ROLE usando o mesmo padrão do login ---
    setupRoleSelect(el, state);

    bind(el);

    // confirma antes de sair se houver mudanças
    api.setBeforeClose(async () => {
        if (deleted) return true;
        if (!dirty || !hasChanges()) return true;

        const wantSave = await showConfirmAlert({
            type: 'warning',
            title: 'Salvar alterações?',
            message: 'Deseja salvar as mudanças deste usuário?',
            okLabel: 'Salvar',
            cancelLabel: 'Descartar'
        });

        if (!wantSave) return true;

        try {
            doSave();
            return true;
        } catch (e) {
            await showAlert({
                type: 'error',
                title: 'Falha ao salvar',
                message: e?.message || 'Erro inesperado.',
                durationMs: 3000
            });
            return false;
        }
    });

    return el;

    function bind(root) {
        const $ = s => root.querySelector(s);

        const uEl = $('#ue-username');
        const pEl = $('#ue-pass');

        const saveBtn = $('#ue-save');
        const delBtn = $('#ue-delete');
        const tokBtn = $('#ue-reset-token');
        const backBtn = $('#ue-back-users');

        uEl?.addEventListener('input', () => { state.username = uEl.value.trim(); markDirty(); });
        pEl?.addEventListener('input', () => { state.newPassword = pEl.value; markDirty(); });

        saveBtn?.addEventListener('click', async () => {
            try { doSave(); afterChange('Salvo'); }
            catch (e) { await showAlert({ type: 'error', title: 'Erro', message: e?.message || 'Falha ao salvar', durationMs: 3000 }); }
        });

        delBtn?.addEventListener('click', async () => {
            if (mode === 'create') {
                await showAlert({ type: 'warning', title: 'Nada a excluir', message: 'Este usuário ainda não existe.' });
                return;
            }
            const ok = await showConfirmAlert({
                type: 'warning',
                title: 'Excluir usuário?',
                message: `Essa ação não pode ser desfeita.`,
                okLabel: 'Excluir',
                cancelLabel: 'Cancelar'
            });
            if (!ok) return;
            try {
                deleteUser(orig.username);
                deleted = true;
                afterChange('Excluído');
            } catch (e) {
                await showAlert({ type: 'error', title: 'Erro', message: e?.message || 'Falha ao excluir', durationMs: 3000 });
            }
        });

        tokBtn?.addEventListener('click', async () => {
            state.resetToken = true;
            markDirty();
            await showAlert({ type: 'info', title: 'Agendado', message: 'O token será regenerado ao salvar.', durationMs: 1500 });
        });

        backBtn?.addEventListener('click', () =>
            import('../modal.js').then(m => m.openModal({ type: 'users' }))
        );
    }

    function hasChanges() {
        if (mode === 'create') return !!state.username || !!state.newPassword || !!state.role;
        return state.username !== orig.username
            || state.role !== orig.role
            || !!state.newPassword
            || !!state.resetToken;
    }

    async function doSave() {
        if (!state.username) throw new Error('Informe o nome de usuário.');

        if (mode === 'create') {
            if (!state.newPassword || state.newPassword.length < 6) throw new Error('Senha mínima: 6 caracteres.');
            createUser({ username: state.username, role: state.role || 'user', password: state.newPassword });
        } else {
            const body = {};
            if (state.username !== orig.username) body.new_username = state.username;
            if (state.role !== orig.role) body.role = state.role;
            if (state.newPassword) {
                if (state.newPassword.length < 6) throw new Error('Senha mínima: 6 caracteres.');
                body.password = state.newPassword;
            }
            if (state.resetToken) body.resetToken = true;

            if (!Object.keys(body).length) return; // nada a enviar
            updateUser(orig.username, body);

            showAlert({ type: 'info', title: 'Usuário salvo!', message: 'As mudanças foram aplicadas.', durationMs: 1200 });
        }

        initial = snapshot(state);
        dirty = false;
    }

    async function afterChange(msg) {
        await showAlert({ type: 'success', title: msg, message: 'Operação concluída.', durationMs: 1200 });
        if (typeof props.onChanged === 'function') props.onChanged();
        import('../modal.js').then(m => m.openModal({ type: 'users' }));
    }

    function markDirty() { dirty = true; }

    // --------- helpers para o select estilizado (mesmo do login) ----------
    function setupRoleSelect(root, stateRef) {
        const sel = root.querySelector('#ue-role');
        // garante selected conforme estado
        sel.value = stateRef.role === 'admin' ? 'admin' : 'user';

        // cria NICE select + popula a lista a partir das <option>
        const nice = enhanceSelect(root, 'ue-role');
        const wrap = root.querySelector(`.ui-select[data-for="ue-role"]`);
        const list = wrap.querySelector('.ui-select-list');

        list.innerHTML = '';
        Array.from(sel.options).forEach((op) => {
            const li = document.createElement('li');
            li.className = 'ui-option';
            li.role = 'option';
            li.dataset.value = op.value;
            li.textContent = op.textContent;
            li.tabIndex = 0;
            if (op.selected) li.setAttribute('aria-selected', 'true');
            li.onclick = () => {
                nice.pick(op.value, op.textContent);
                stateRef.role = op.value;
                markDirty();
            };
            li.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); } };
            list.appendChild(li);
        });

        // inicializa o label
        const init = sel.options[sel.selectedIndex];
        if (init) nice.pick(init.value, init.textContent);
    }
}

/* view */
function view(mode, s) {
    const isCreate = mode === 'create';
    return `
    <div class="ue-grid">
      <div class="ue-row">
        <div class="ue-label">Usuário</div>
        <div class="ue-control">
          <input id="ue-username" class="ue-input" type="text" placeholder="nome.sobrenome" value="${esc(s.username)}" />
        </div>
      </div>

      <div class="ue-row">
        <div class="ue-label">Cargo</div>
        <div class="ue-control">
          <!-- select nativo escondido + select estilizado (igual ao de HUB) -->
          <select id="ue-role" class="select-hidden" required>
            <option value="user" ${s.role !== 'admin' ? 'selected' : ''}>user</option>
            <option value="admin" ${s.role === 'admin' ? 'selected' : ''}>admin</option>
          </select>
          <div class="ui-select" data-for="ue-role" aria-expanded="false">
            <button type="button" class="ui-select-btn" aria-haspopup="listbox">
              <span class="label">Selecionar</span>
            </button>
            <ul class="ui-select-list" role="listbox"></ul>
          </div>
        </div>
      </div>

      <div class="ue-row">
        <div class="ue-label">${isCreate ? 'Senha inicial' : 'Nova senha'}</div>
        <div class="ue-control">
          <input id="ue-pass" class="ue-input" type="password" autocomplete="new-password" placeholder="${isCreate ? 'Defina a senha do usuário' : 'Deixe em branco para não alterar'}" />
        </div>
      </div>

      ${isCreate ? '' : `
      <div class="ue-actions">
        <button id="ue-reset-token" class="ue-link"><i data-lucide="key-round"></i><span>Gerar novo token no salvar</span></button>
      </div>`}

      <div class="ue-footer">
        ${isCreate ? '' : `<button id="ue-delete" class="ue-btn ue-btn--danger"><i data-lucide="trash-2"></i><span>Excluir</span></button>`}
      </div>
    </div>
  `;
}

/* enhanceSelect — mesmo comportamento do login */
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

/* utils */
function normalizeUser(u = {}) {
    return { username: String(u.username || ''), role: (u.role === 'admin' ? 'admin' : 'user') };
}
function snapshot(s) { return JSON.parse(JSON.stringify(s)); }
function esc(v) { const d = document.createElement('div'); d.textContent = String(v ?? ''); return d.innerHTML; }
