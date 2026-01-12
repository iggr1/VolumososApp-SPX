import { showAlert } from './alerts.js';
import { openModal } from '../modal.js';
import { getConfigs } from './config.js';
import { updateCounts } from './helper.js';
import { apiPost, apiGet } from '../api.js';

const $ = selector => document.querySelector(selector);

/**
 * HUB atual (só code/label; URL base agora vem do api.js)
 */
function getCurrentHub() {
  const code = localStorage.getItem('hubCode');
  const label = localStorage.getItem('hubLabel');
  return { code, label };
}

// --- agora lê dados do localStorage
export function setUserInfo(username, token, avatarImg) {
  const { label: hubLabel } = getCurrentHub();

  if (username && token) {
    if (username.includes('[convidado]')) {
      if ($('.username')) $('.username').textContent = 'Convidado (Guest)';
    } else {
      if ($('.username')) $('.username').textContent = username;
    }
    if ($('.hub')) $('.hub').textContent = hubLabel || '-';

    if ($('.avatar img')) {
      $('.avatar img').src = avatarImg
        ? `./src/assets/img/profile-images/${avatarImg}.jpg`
        : './src/assets/img/profile-images/0.jpg';
    }

    // salva token persistente
    localStorage.setItem('authToken', token);
    return;
  }

  if (avatarImg && $('.avatar img')) {
    $('.avatar img').src = avatarImg
      ? `./src/assets/img/profile-images/${avatarImg}.jpg`
      : './src/assets/img/profile-images/0.jpg';
    return;
  }
}

export async function verifyUserSession() {
  const token = localStorage.getItem('authToken');
  const { code: hubCode } = getCurrentHub();

  if (!hubCode) {
    showAlert({
      type: 'warning',
      title: 'HUB não configurado',
      message: 'Selecione o HUB e faça login para acessar.',
    });
    openModal({ type: 'login' });
    return;
  }

  if (!token) {
    showAlert({
      type: 'warning',
      title: 'Bem vindo!',
      message: 'Faça o login/autenticação para acessar.',
      buttons: [],
      durationMs: 5000,
      dismissible: false,
      collapseDelayMs: 150,
    });

    openModal({ type: 'login' });
    return;
  }

  const userData = await fetchUserData();
  const authExpires = userData?.expires ? Date.parse(userData.expires) : 0;
  const now = Date.now();
  const skewMs = 30 * 1000;

  const isValid = !!token && Number.isFinite(authExpires) && now + skewMs < authExpires;

  if (isValid) {
    setUserInfo(userData?.username, token, userData?.avatar_id);
    updateCounts();

    showAlert({
      type: 'success',
      title: `Olá, ${userData?.username}!`,
      message: `Sua sessão está ativa no HUB ${hubCode}.`,
      buttons: [],
      durationMs: 2000,
      dismissible: false,
      collapseDelayMs: 150,
    });
  } else {
    localStorage.removeItem('authToken');
  }

  if (!isValid) {
    return false;
  }

  // A partir daqui começa a bater nos endpoints que exigem pertencer ao HUB
  getConfigs();

  return true;
}

export async function fetchUserData() {
  const token = localStorage.getItem('authToken');
  if (!token) return null;

  // apiGet monta URL base, adiciona token e hub automaticamente
  let data = null;
  try {
    data = await apiGet('user'); // não precisa mais passar { token }
  } catch (err) {
    console.error('fetchUserData error:', err);
  }

  if (!data || !data.ok) {
    const msg = data?.error || 'Faça o login/autenticação para prosseguir.';
    showAlert({
      type: 'warning',
      title: 'Faça login',
      message: msg,
      buttons: [],
      durationMs: 5000,
      dismissible: false,
      collapseDelayMs: 150,
    });
    openModal({ type: 'login' });
    return null;
  }

  return data;
}

export async function loginRequest({ username, password }) {
  try {
    const data = await apiPost('auth/login', { username, password });

    if (!data?.token) {
      showAlert({
        type: 'error',
        title: 'Falha na autenticação!',
        message: 'Verifique suas credenciais e tente novamente.',
        durationMs: 4000,
      });
      return null;
    }

    if (data.status === 'pending') {
      showAlert({
        type: 'warning',
        title: 'Usuário Pendente',
        message: 'Seu usuário está pendente. Solicite a liberação com sua liderança ou analista.',
        durationMs: 5000,
      });
      return null;
    }

    setUserInfo(data.username, data.token, data.avatar_id);
    updateCounts();
    return true;
  } catch (err) {
    let msg = err?.data?.error || err?.message || 'Falha ao autenticar!';
    if (err?.status === 403 && typeof msg === 'string' && msg.toLowerCase().includes('forbidden')) {
      msg = 'Usuário ou senha inválidos, verifique e tente novamente.';
      // ou qualquer mensagem que você quiser colocar aqui
    }

    if (
      err?.status === 403 &&
      typeof msg === 'string' &&
      (msg.toLowerCase().includes('not allowed') ||
        msg.toLowerCase().includes('usuário não tem acesso a este hub'))
    ) {
      msg = 'Você não possui acesso à este HUB. Contate sua liderança caso necessário.';
    }

    if (
      err?.status === 403 &&
      typeof msg === 'string' &&
      msg.toLowerCase().includes('usuário pendente')
    ) {
      msg = 'Seu usuário está pendente. Solicite a liberação com sua liderança ou analista.';
    }

    if (
      err?.status === 403 &&
      typeof msg === 'string' &&
      msg.toLowerCase().includes('usuário não ativo')
    ) {
      msg = 'Seu usuário está desativado. Contate sua liderança para mais informações.';
    }

    showAlert({
      type: 'error',
      title: 'Falha ao autenticar!',
      message: msg,
      durationMs: 4000,
    });

    return null;
  }
}

export async function fetchUserRole() {
  const token = localStorage.getItem('authToken');
  if (!token) return null;

  let data = null;
  try {
    data = await apiGet('user/role'); // token/hub já vão no api.js
  } catch (err) {
    console.error('fetchUserRole error:', err);
  }

  if (!data || !data.ok) {
    showAlert({
      type: 'warning',
      title: 'Faça login',
      message: 'Faça o login/autenticação para prosseguir.',
      buttons: [],
      durationMs: 5000,
      dismissible: false,
      collapseDelayMs: 150,
    });
    openModal({ type: 'login' });

    return null;
  }

  return data;
}

export function clearUserSession() {
  localStorage.removeItem('authToken');
  setUserInfo(null, null, null);
}

export function publicRegisterUser(u) {
  return apiPost('auth/register', u);
}

export function requestEmailVerification(email) {
  return apiPost('auth/request-email-code', { email });
}

export async function guestLoginUser() {
  const { code: hubCode } = getCurrentHub();

  // apiGet já adiciona hub automaticamente, mas manter aqui não machuca
  const data = await apiPost('auth/guest-login');
  if (!data) return null;

  if (data?.error) {
    showAlert({
      type: 'error',
      title: 'Falha ao autenticar!',
      message: data.error,
      durationMs: 3000,
    });
    return null;
  }

  setUserInfo(data.username, data.token, data.avatar_id);
  updateCounts();

  return true;
}

/**
 * Valida se é um email corporativo permitido.
 */
export function isValidCorporateEmail(str) {
  const lower = String(str || '')
    .trim()
    .toLowerCase();
  const basic = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower);
  if (!basic) return false;
  return lower.endsWith('@shopee.com') || lower.endsWith('@shopeemobile-external.com');
}

/**
 * Normaliza o identificador de registro garantindo que seja um e-mail corporativo.
 */
export function normalizeIdentifier(rawIdent) {
  const ident = String(rawIdent || '').trim();

  if (!isValidCorporateEmail(ident)) {
    return {
      ok: false,
      error: 'Informe um e-mail corporativo válido (@shopee.com ou @shopeemobile-external.com).',
    };
  }

  return {
    ok: true,
    ident,
  };
}

/**
 * Salva dados do HUB selecionado no localStorage.
 */
export function saveHubLocal(hub) {
  if (!hub) return;
  try {
    localStorage.setItem('hubCode', hub.code);
    localStorage.setItem('hubLabel', hub.label);
    // OBS: não tem mais hubServer aqui, esse papel é do api.js
  } catch (err) {
    console.error('Falha ao salvar hub local:', err);
  }
}
