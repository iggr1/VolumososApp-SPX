import { $, setupTypography } from './app.js';
import { CameraController } from './camera.js';
import { QrScanner } from './scanner.js';
import { verifyUserSession } from './utils/auth.js';
import { openModal } from './modal.js';
import { verifyBrCode } from './utils/package.js';
import { verifyAlreadyInLocalPallet, sendToLocalPallet } from './utils/pallet.js';
import { showAlert } from './utils/alerts.js';
import { isModalOpenOnScreen } from './utils/helper.js';
import { getPreRoute } from './utils/preroute.js';

setupTypography();

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.error('Falha ao registrar Service Worker', err);
    });
  });
}

registerServiceWorker();

const camEl = $('.cam');
const scanEl = $('.cam .scan');
const selectBtn = $('.cam-select');
const flipBtn = $('.cam-flip');
const selectLabel = $('.cam-select span');
const inputEl = $('.panel .input input');

const camera = new CameraController({ camEl, selectBtn, flipBtn, selectLabel });

let scanLock = false;
let scanner = null;
let resumeLock = false;

function normalizeBrCode(value) {
  return String(value || '').trim().toUpperCase();
}

function focusInputIfAllowed() {
  if (isModalOpenOnScreen()) return;
  inputEl?.focus({ preventScroll: true });
}

/* ============================================================
   Selecionar / limpar (evita “grudar” códigos sem limpar cedo)
   ============================================================ */
function clearBrInput({ refocus = true } = {}) {
  try {
    if (!inputEl) return;

    inputEl.value = '';
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));

    if (refocus) {
      setTimeout(() => {
        focusInputIfAllowed();
      }, 0);
    }
  } catch {}
}

function selectBrInput({ refocus = true } = {}) {
  try {
    if (!inputEl) return;

    if (refocus) focusInputIfAllowed();

    // Seleciona tudo (o próximo scan/teclado substitui)
    inputEl.select?.();

    // Mobile Safari às vezes precisa disso
    const len = inputEl.value?.length || 0;
    if (inputEl.setSelectionRange) {
      inputEl.setSelectionRange(0, len);
    }
  } catch {}
}

// Mantive o nome "clearAfter", mas agora ele SELECIONA depois de X ms
function clearAfter(ms = 0, opts = { refocus: true }) {
  setTimeout(() => selectBrInput(opts || { refocus: true }), ms);
}
/* ============================================================ */

async function stopCameraAndScanner() {
  try {
    scanner?.stop();
  } catch {}
  try {
    camera.stop();
  } catch {}
}

async function resumeCameraFlow(forceRestart = false) {
  if (resumeLock || document.visibilityState !== 'visible') return;
  resumeLock = true;
  try {
    if (forceRestart) {
      stopCameraAndScanner();
    }
    await camera.resume();
    await scanner?.start();
  } catch (err) {
    console.error('Falha ao retomar câmera', err);
  } finally {
    resumeLock = false;
  }
}

function setupLifecycleEvents() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopCameraAndScanner();
    } else {
      resumeCameraFlow(true);
    }
  });

  // Garante retomada ao voltar de apps/background no mobile
  window.addEventListener('focus', () => resumeCameraFlow());
  window.addEventListener('pageshow', () => resumeCameraFlow(true));
}

(async () => {
  try {
    if (inputEl) {
      inputEl.setAttribute('inputmode', 'none');
      inputEl.addEventListener('keydown', event => {
        if (isModalOpenOnScreen()) return;
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Tab') {
          event.preventDefault();
          document.querySelector('.btn-add')?.click();

          // Depois de disparar, deixa selecionado pra sobrescrever no próximo scan
          clearAfter(0, { refocus: true });
        }
      });

      inputEl.addEventListener('blur', () => {
        setTimeout(() => {
          focusInputIfAllowed();
        }, 0);
      });
    }

    focusInputIfAllowed();

    // Garante permissão inicial para exibir labels e listar todas as câmeras
    await navigator.mediaDevices.getUserMedia({ video: true });

    await camera.enumerate();

    // Cria o scanner sempre usando o <video> interno da CameraController
    scanner = new QrScanner({
      video: camera.getVideo(),
      camEl,
      scanEl,
      onResult: val => {
        if (scanLock || isModalOpenOnScreen()) return;
        scanLock = true;

        const normalized = normalizeBrCode(val);
        inputEl.value = normalized;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.btn-add')?.click();

        // não limpa cedo; só seleciona pro próximo scan sobrescrever
        clearAfter(0, { refocus: false });

        setTimeout(() => {
          scanLock = false;
        }, 500); // debounce
      },
    });

    // Integra: toda troca de câmera vai parar e reiniciar o scanner automaticamente
    camera.attachScanner(scanner);

    // Abre a primeira câmera; CameraController chamará scanner.start() internamente
    await camera.start(0);

    addEventListener('beforeunload', () => {
      stopCameraAndScanner();
    });

    setupLifecycleEvents();
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

document.addEventListener('click', event => {
  if (event.target.closest('input, textarea, select, button, [contenteditable="true"]')) return;
  focusInputIfAllowed();
});

/* Menu */
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn-menu');
  if (!btn) return;
  openModal({
    type: 'menu',
    props: {
      onSettings: () => {
        openModal({ type: 'settings' });
      },
    },
  });
});

/* Botão pallet atual */
document.addEventListener('click', e => {
  const btnCurrentPallet = e.target.closest('.btn-current-pallet');
  if (!btnCurrentPallet) return;
  openModal({ type: 'currentPallet' });
});

/* Botão todos pallets */
document.addEventListener('click', e => {
  const btnAllPallets = e.target.closest('.btn-all-pallets');
  if (!btnAllPallets) return;
  openModal({ type: 'allPallets' });
});

/* Adicionar BR manual / via scanner */
document.addEventListener('click', async e => {
  const btn = e.target.closest('.btn-add');
  if (!btn) return;

  const brCodeInput = document.querySelector('.brcode-input');
  const brCode = normalizeBrCode(brCodeInput ? brCodeInput.value : '');
  if (brCodeInput && brCodeInput.value !== brCode) {
    brCodeInput.value = brCode;
    brCodeInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

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

    // seleciona pra sobrescrever
    selectBrInput();
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

    selectBrInput();
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

    selectBrInput();
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

    selectBrInput();
    return;
  }

  try {
    const pre = await getPreRoute(brCode);

    // se tiver preroute, pula o modal e adiciona direto
    if (pre.ok && pre.found && pre.route) {
      const packageToAdd = {
        brCode,
        route: pre.route,
        datetime: new Date().toISOString(),
        userToken: localStorage.getItem('authToken'),
      };

      await sendToLocalPallet(packageToAdd);

      showAlert({
        type: 'success',
        title: 'Rota automática',
        message: `Rota ${pre.route} aplicada via Pré-Route.`,
        buttons: [],
        durationMs: 1400,
        dismissible: true,
        collapseDelayMs: 120,
      });

      // aqui você pode escolher: limpar ou só selecionar
      // se quiser manter padrão "sobrescrever", use select:
      selectBrInput();
      return; // IMPORTANTÍSSIMO: não abre o modal
    }
  } catch (e2) {
    // se der erro na consulta, só cai pro fluxo normal
    console.warn('[preroute] falha:', e2);
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

  // não limpa; mantém selecionado (útil se o modal falhar, ou pra conferência)
  selectBrInput({ refocus: false });
});

/* Botão info */
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn-info');
  if (!btn) return;
  openModal({ type: 'about' });
});
