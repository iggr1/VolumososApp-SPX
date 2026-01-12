// src/js/modals/userEdit.js
import { updateUser, deleteUser, userAction } from '../api.js';
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
  const orig = normalizeUser(props.user); // agora inclui status
  api.setBackTo('users');

  const el = document.createElement('div');
  el.className = 'ue-modal';

  let state = {
    username: orig.username,
    role: orig.role,
    status: orig.status,
    newPassword: '',
  };

  let dirty = false;
  let deleted = false;

  el.innerHTML = view(state);
  if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });

  // select estilizado de ROLE
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
      cancelLabel: 'Descartar',
    });

    if (!wantSave) return true;

    try {
      await doSave();
      return true;
    } catch (e) {
      await showAlert({
        type: 'error',
        title: 'Falha ao salvar',
        message: e?.message || 'Erro inesperado.',
        durationMs: 3000,
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
    const toggleBtn = $('#ue-toggle-status');

    // username bloqueado
    if (uEl) {
      uEl.value = state.username;
      uEl.setAttribute('readonly', 'true');
      uEl.setAttribute('disabled', 'true');
    }

    pEl?.addEventListener('input', () => {
      state.newPassword = pEl.value;
      markDirty();
    });

    saveBtn?.addEventListener('click', async () => {
      try {
        await doSave();
        await afterChange('Salvo');
      } catch (e) {
        await showAlert({
          type: 'error',
          title: 'Erro',
          message: e?.message || 'Falha ao salvar',
          durationMs: 3000,
        });
      }
    });

    toggleBtn?.addEventListener('click', async () => {
      const isActive = String(state.status || 'active').toLowerCase() === 'active';
      const action = isActive ? 'deactivate' : 'activate';
      const label = isActive ? 'Desativar' : 'Ativar';

      const ok = await showConfirmAlert({
        type: 'warning',
        title: `${label} usuário?`,
        message: isActive
          ? 'O usuário perderá acesso ao sistema (token será revogado).'
          : 'O usuário voltará a ter acesso ao sistema.',
        okLabel: label,
        cancelLabel: 'Cancelar',
      });
      if (!ok) return;

      try {
        await userAction({ username: orig.username, action });
        state.status = action === 'activate' ? 'active' : 'inactive';
        // atualiza UI do botão e badge
        refreshStatusUI(root, state.status);
        if (typeof props.onChanged === 'function') props.onChanged();

        await showAlert({
          type: 'success',
          title: 'OK',
          message: `Usuário ${label.toLowerCase()}do.`,
          durationMs: 1200,
        });
      } catch (e) {
        await showAlert({
          type: 'error',
          title: 'Erro',
          message: e?.message || 'Falha ao alterar status',
          durationMs: 3000,
        });
      }
    });

    delBtn?.addEventListener('click', async () => {
      const ok = await showConfirmAlert({
        type: 'warning',
        title: 'Excluir usuário?',
        message: `Essa ação não pode ser desfeita.`,
        okLabel: 'Excluir',
        cancelLabel: 'Cancelar',
      });
      if (!ok) return;

      try {
        await deleteUser(orig.username);
        deleted = true;
        await afterChange('Excluído');
      } catch (e) {
        await showAlert({
          type: 'error',
          title: 'Erro',
          message: e?.message || 'Falha ao excluir',
          durationMs: 3000,
        });
      }
    });
  }

  function hasChanges() {
    return state.role !== orig.role || !!state.newPassword;
  }

  async function doSave() {
    // username é fixo e não deve ser enviado como rename
    const body = {};

    if (state.role !== orig.role) body.role = state.role;

    if (state.newPassword) {
      if (state.newPassword.length < 6) throw new Error('Senha mínima: 6 caracteres.');
      body.password = state.newPassword;
    }

    if (!Object.keys(body).length) return; // nada a enviar

    await updateUser(orig.username, body);

    // sync orig local (pra não ficar "dirty")
    orig.role = state.role;
    state.newPassword = '';
    dirty = false;

    await showAlert({
      type: 'info',
      title: 'Usuário salvo!',
      message: 'As mudanças foram aplicadas.',
      durationMs: 1200,
    });
  }

  async function afterChange(msg) {
    await showAlert({
      type: 'success',
      title: msg,
      message: 'Operação concluída.',
      durationMs: 1200,
    });
    if (typeof props.onChanged === 'function') props.onChanged();
    import('../modal.js').then(m => m.openModal({ type: 'users' }));
  }

  function markDirty() {
    dirty = true;
  }

  function refreshStatusUI(root, status) {
    const $ = s => root.querySelector(s);
    const badge = $('#ue-status-badge');
    const btn = $('#ue-toggle-status');

    const isActive = String(status || 'active').toLowerCase() === 'active';
    const label = isActive ? 'Ativo' : 'Inativo';
    const actionLabel = isActive ? 'Desativar' : 'Ativar';

    if (badge) {
      badge.textContent = label;
      badge.classList.toggle('is-active', isActive);
      badge.classList.toggle('is-inactive', !isActive);
    }

    if (btn) {
      btn.innerHTML = isActive
        ? `<i data-lucide="user-x"></i><span>Desativar</span>`
        : `<i data-lucide="user-check"></i><span>Ativar</span>`;
      btn.classList.toggle('ue-btn--danger', isActive);
      btn.classList.toggle('ue-btn--primary', !isActive);
    }

    if (window.lucide?.createIcons) lucide.createIcons({ attrs: { width: 22, height: 22 } });
  }

  // --------- helpers para o select estilizado ----------
  function setupRoleSelect(root, stateRef) {
    const sel = root.querySelector('#ue-role');
    sel.value = stateRef.role === 'admin' ? 'admin' : 'user';

    const nice = enhanceSelect(root, 'ue-role');
    const wrap = root.querySelector(`.ui-select[data-for="ue-role"]`);
    const list = wrap.querySelector('.ui-select-list');

    list.innerHTML = '';
    Array.from(sel.options).forEach(op => {
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
      li.onkeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          li.click();
        }
      };
      list.appendChild(li);
    });

    const init = sel.options[sel.selectedIndex];
    if (init) nice.pick(init.value, init.textContent);
  }
}

/* view */
function view(s) {
  const status = String(s.status || 'active').toLowerCase();
  const isActive = status === 'active';

  return `
    <div class="ue-grid">

      <div class="ue-row">
        <div class="ue-label">Usuário</div>
        <div class="ue-control">
          <input id="ue-username" class="ue-input ue-input--locked" type="text" value="${esc(s.username)}" readonly disabled />
        </div>
      </div>

      <div class="ue-row">
        <div class="ue-label">Cargo</div>
        <div class="ue-control">
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
        <div class="ue-label">Nova senha</div>
        <div class="ue-control">
          <input id="ue-pass" class="ue-input" type="password" autocomplete="new-password" placeholder="Deixe em branco para não alterar" />
        </div>
      </div>

      <div class="ue-footer">
        <button id="ue-toggle-status" class="ue-btn ${isActive ? 'ue-btn--danger' : 'ue-btn--primary'}">
          ${
            isActive
              ? `<i data-lucide="user-x"></i><span>Desativar</span>`
              : `<i data-lucide="user-check"></i><span>Ativar</span>`
          }
        </button>

        <button id="ue-delete" class="ue-btn ue-btn--danger">
          <i data-lucide="trash-2"></i><span>Excluir</span>
        </button>
      </div>
      <div class="ue-footer">
        <button id="ue-save" class="ue-btn ue-btn--primary">
          <i data-lucide="save"></i><span>Salvar</span>
        </button>
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

  function open(v) {
    wrap.setAttribute('aria-expanded', 'true');
    if (v) focusCurrent();
  }
  function close() {
    wrap.setAttribute('aria-expanded', 'false');
  }
  function toggle() {
    wrap.getAttribute('aria-expanded') === 'true' ? close() : open(true);
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
      list.querySelector('.ui-option[aria-selected="true"]') || list.querySelector('.ui-option');
    cur?.focus();
  }

  const init = sel.options[sel.selectedIndex];
  if (init) btn.querySelector('.label').textContent = init.textContent;

  btn.onclick = toggle;
  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) close();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
  });
  btn.onkeydown = e => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open(true);
    }
  };

  return { pick, open, close };
}

/* utils */
function normalizeUser(u = {}) {
  return {
    username: String(u.username || ''),
    role: u.role === 'admin' ? 'admin' : 'user',
    status: String(u.status || 'active').toLowerCase(),
  };
}

function esc(v) {
  const d = document.createElement('div');
  d.textContent = String(v ?? '');
  return d.innerHTML;
}
