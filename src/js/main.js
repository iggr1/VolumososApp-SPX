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

const camera = new CameraController({ camEl, selectBtn, flipBtn, selectLabel });

(async () => {
    try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        await camera.enumerate();
        await camera.start(0);

        const scanner = new QrScanner({
            video: camera.getVideo(),
            camEl,
            scanEl,
            onResult: (val) => {
                inputEl.value = val;
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));

                if (!isModalOpenOnScreen()) {
                    const addBtn = document.querySelector('.btn-add');
                    if (addBtn) {
                        addBtn.click();
                    }
                }
            }
        });
        await scanner.start();

        addEventListener('beforeunload', () => {
            scanner.stop();
            camera.stop();
        });
    } catch (err) {
        console.error(err);
        camEl.querySelector('.label').textContent = 'Permita acesso à câmera para ler QR';
    }
})();

document.addEventListener("DOMContentLoaded", () => {
  verifyUserSession();
});

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

document.addEventListener('click', (e) => {
  const btnCurrentPallet = e.target.closest('.btn-current-pallet');
  if (btnCurrentPallet) {
    openModal({ type: 'currentPallet' });
    return;
  }
});

document.addEventListener('click', (e) => {
  const btnCurrentPallet = e.target.closest('.btn-all-pallets');
  if (btnCurrentPallet) {
    openModal({ type: 'allPallets' });
    return;
  }
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-add');
  if (!btn) return;

  const brCodeInput = document.querySelector('.brcode-input');
  const brCode = brCodeInput ? brCodeInput.value : '';

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
      type: 'warning',
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

  openModal({
    type: 'routeSelect'
  });
});