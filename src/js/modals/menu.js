import { openModal } from '../modal.js';
import { showConfirmAlert } from '../utils/alerts.js';
import { clearUserSession } from '../utils/auth.js';

export const meta = {
  title: 'Menu',
  size: 'sm',
  showBack: false,
  showClose: true,
  backdropClose: true,
  escToClose: true,
  initialFocus: '#menu-settings',
};

export default function render(props = {}, api) {
  const el = document.createElement('div');
  el.className = 'menu-modal';
  el.innerHTML = `
    <div class="menu-list">
      <button id="menu-settings" class="menu-button">
        <i data-lucide="settings" aria-hidden="true"></i>
        <span>Configurações</span>
      </button>
      <button id="menu-logout" class="menu-button menu-button--danger">
        <i data-lucide="log-out" aria-hidden="true"></i>
        <span>Encerrar sessão</span>
      </button>
    </div>
  `;

  el.querySelector('#menu-settings').onclick = async () => {
    if (typeof props.onSettings === 'function') {
      props.onSettings();
    } else {
      openModal({ type: 'settings' });
    }
  };

  el.querySelector('#menu-logout').onclick = async () => {
    const ok = await showConfirmAlert({
      type: 'warning',
      title: 'Encerrar sessão?',
      message: 'Você será desconectado.',
      durationMs: 5000,
    });
    if (!ok) return;

    clearUserSession();
    openModal({ type: 'login' });
  };

  return el;
}
