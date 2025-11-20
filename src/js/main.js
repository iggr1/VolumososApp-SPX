import { $, setupTypography } from './app.js';
import { CameraController } from './camera.js';
import { QrScanner } from './scanner.js';
import { verifyUserSession } from './utils/auth.js';
import { openModal } from './modal.js';
import { verifyBrCode } from './utils/package.js';
import { verifyAlreadyInLocalPallet } from './utils/pallet.js';
import { showAlert } from './utils/alerts.js';
import { isModalOpenOnScreen } from './utils/helper.js';

setupTypography();

const camEl = $('.cam');
const scanEl = $('.cam .scan');
const selectBtn = $('.cam-select');
const flipBtn = $('.cam-flip');
const selectLabel = $('.cam-select span');
const inputEl = $('.panel .input input');
const installBtn = document.querySelector('.btn-install');

const INSTALL_KEY = 'pwaInstalled';
let deferredPrompt = null;

const hideInstallCTA = () => {
  if (!installBtn) return;
  installBtn.classList.add('is-hidden');
};

const showInstallCTA = () => {
  if (!installBtn) return;
  if (localStorage.getItem(INSTALL_KEY) === 'true') return;
  installBtn.classList.remove('is-hidden');
};

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  showInstallCTA();
});

installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;

  installBtn.disabled = true;
  deferredPrompt.prompt();

  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.disabled = false;

  if (choice?.outcome === 'accepted') {
    localStorage.setItem(INSTALL_KEY, 'true');
    hideInstallCTA();
  }
});

window.addEventListener('appinstalled', () => {
  localStorage.setItem(INSTALL_KEY, 'true');
  hideInstallCTA();
  deferredPrompt = null;
});

if (localStorage.getItem(INSTALL_KEY) === 'true') {
  hideInstallCTA();
}

const camera = new CameraController({ camEl, selectBtn, flipBtn, selectLabel });

let scanLock = false;
let scanner = null;

(async () => {
  try {
    // Garante permissão inicial para exibir labels e listar todas as câmeras
    await navigator.mediaDevices.getUserMedia({ video: true });

    await camera.enumerate();

    // Cria o scanner sempre usando o <video> interno da CameraController
    scanner = new QrScanner({
      video: camera.getVideo(),
      camEl,
      scanEl,
      onResult: (val) => {
        if (scanLock || isModalOpenOnScreen()) return;
        scanLock = true;

        inputEl.value = val;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.btn-add')?.click();

        setTimeout(() => { scanLock = false; }, 500); // debounce
      }
    });

    // Integra: toda troca de câmera vai parar e reiniciar o scanner automaticamente
    camera.attachScanner(scanner);

    // Abre a primeira câmera; CameraController chamará scanner.start() internamente
    await camera.start(0);

    addEventListener('beforeunload', () => {
      try { scanner.stop(); } catch { }
      try { camera.stop(); } catch { }
    });
  } catch (err) {
    const label = camEl.querySelector('.label');
    if (label) {
      label.textContent = 'Permita acesso à câmera para ler QR';
    }
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  verifyUserSession();
});

/* Menu */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-menu');
  if (!btn) return;
  openModal({
    type: 'menu',
    props: {
      onSettings: () => {
        openModal({ type: 'settings' });
      }
    }
  });
});

/* Botão pallet atual */
document.addEventListener('click', (e) => {
  const btnCurrentPallet = e.target.closest('.btn-current-pallet');
  if (!btnCurrentPallet) return;
  openModal({ type: 'currentPallet' });
});

/* Botão todos pallets */
document.addEventListener('click', (e) => {
  const btnAllPallets = e.target.closest('.btn-all-pallets');
  if (!btnAllPallets) return;
  openModal({ type: 'allPallets' });
});

/* Adicionar BR manual / via scanner */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-add');
  if (!btn) return;

  const brCodeInput = document.querySelector('.brcode-input');
  const brCode = brCodeInput ? brCodeInput.value : '';

  const items = JSON.parse(localStorage.getItem('currentPallet')) || [];
  const packagesCount = Array.isArray(items) ? items.length : 0;
  const maxPackages = Number(localStorage.getItem('maxPackages') || '15');

  if (packagesCount && Array.isArray(items) && items.length >= maxPackages) {
    showAlert({
      type: 'error',
      title: 'Limite de pacotes atingido',
      message: `Você não pode adicionar mais de ${maxPackages} pacotes a um pallet.`,
      buttons: [],
      durationMs: 4000,
      dismissible: true,
      collapseDelayMs: 150,
    });
    return;
  }

  if (!brCode) {
    showAlert({
      type: 'info',
      title: 'Código BR ausente',
      message: 'Por favor, insira um código BR antes de adicionar uma rota.',
      buttons: [],
      durationMs: 3000,
      dismissible: true,
      collapseDelayMs: 150,
    });
    return;
  }

  if (!verifyBrCode(brCode)) {
    showAlert({
      type: 'error',
      title: 'Código BR inválido',
      message: 'O código BR deve ter 15 caracteres e começar com "BR".',
      buttons: [],
      durationMs: 4000,
      dismissible: true,
      collapseDelayMs: 150,
    });
    return;
  }

  const alreadyExists = verifyAlreadyInLocalPallet(brCode);
  if (alreadyExists) {
    showAlert({
      type: 'warning',
      title: 'Pacote já existe',
      message: `O pacote ${brCode} já está no pallet.`,
      buttons: [],
      durationMs: 4000,
      dismissible: true,
      collapseDelayMs: 150,
    });
    return;
  }

  showAlert({
    type: 'success',
    title: 'Código BR válido',
    message: `O pacote ${brCode} está sendo adicionado ao pallet.`,
    buttons: [],
    durationMs: 1000,
    dismissible: false,
    collapseDelayMs: 100,
  });

  openModal({ type: 'routeSelect' });
});

/* Botão info */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-info');
  if (!btn) return;
  openModal({ type: 'about' });
});
