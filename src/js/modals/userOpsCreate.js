import { apiPost } from '../api.js';
import { showAlert } from '../utils/alerts.js';

const OPS_USERNAME_REGEX = /^\[Ops\d+\].+/;

export const meta = {
  title: 'Adicionar Ops',
  size: 'sm',
  showBack: true,
  showClose: true,
  backdropClose: true,
  escToClose: true,
};

export default function render(props = {}, api) {
  api.setBackTo('users');

  const el = document.createElement('div');
  el.className = 'user-ops-create';
  el.innerHTML = formView();

  const usernameEl = el.querySelector('#ops-username');
  const passwordEl = el.querySelector('#ops-password');
  const errorEl = el.querySelector('#ops-create-error');
  const submitBtn = el.querySelector('#ops-create-submit');

  el.querySelector('#ops-create-form')?.addEventListener('submit', onSubmit);

  return el;

  async function onSubmit(ev) {
    ev.preventDefault();

    const username = String(usernameEl?.value || '').trim();
    const password = String(passwordEl?.value || '').trim();

    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const body = { username };
      if (password) body.password = password;

      const data = await apiPost('users/ops', body);

      showAlert({
        type: 'success',
        title: 'Ops criado',
        message: `Usuário ${String(data?.username || username)} criado com sucesso.`,
        durationMs: 3000,
      });

      props?.onCreated?.(data);
      api.close('created');
    } catch (err) {
      setError(err?.message || 'Falha ao criar usuário Ops.');
    } finally {
      setLoading(false);
    }
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle('is-loading', isLoading);
  }

  function setError(message) {
    if (!errorEl) return;
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
  }
}

function formView() {
  return `
    <form id="ops-create-form" class="ops-create-form">
      <label class="ops-create-label" for="ops-username">Username Ops</label>
      <input
        id="ops-username"
        class="ops-create-input"
        type="text"
        inputmode="text"
        placeholder="[Ops123]Joao"
        autocomplete="off"
        required
      />

      <label class="ops-create-label" for="ops-password">Senha (opcional)</label>
      <input
        id="ops-password"
        class="ops-create-input"
        type="text"
        inputmode="text"
        placeholder="Defina uma senha ou deixe em branco"
        autocomplete="off"
      />

      <small id="ops-create-error" class="ops-create-error" hidden></small>

      <button id="ops-create-submit" class="ops-create-submit" type="submit">
        <i data-lucide="user-plus"></i>
        <span>Criar Ops</span>
      </button>
    </form>
  `;
}

function validateUsername(username) {
  if (!username) return 'Informe o username Ops.';
  if (username.includes('@')) return 'Username Ops não pode ser e-mail.';
  if (!OPS_USERNAME_REGEX.test(username)) {
    return 'Use o formato [Ops123]Nome.';
  }
  return '';
}

