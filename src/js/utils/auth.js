import { showAlert } from './alerts.js';
import { openModal } from '../modal.js';
import { getConfigs } from './config.js';
import { updateCounts } from './helper.js';
import { apiPost, apiGet } from '../api.js';

const $ = (selector) => document.querySelector(selector);

// --- agora lê dados do localStorage em vez de localStorage
export function setUserInfo(username, token, avatarImg) {
  const hubLabel = localStorage.getItem('hubLabel');

  if (username && token) {
    $('.username').textContent = username;
    $('.hub').textContent = hubLabel;
    $('.avatar img').src = avatarImg
      ? `./src/assets/img/profile-images/${avatarImg}.jpg`
      : './src/assets/img/profile-images/0.jpg';

    // salva token persistente
    localStorage.setItem('authToken', token);
    return;
  }

  if (avatarImg) {
    $('.avatar img').src = avatarImg
      ? `./src/assets/img/profile-images/${avatarImg}.jpg`
      : './assets/img/profile-images/0.jpg';
    return;
  }
}

export async function verifyUserSession() {
  const token = localStorage.getItem('authToken');
  const hubServer = localStorage.getItem('hubServer');

  if (!hubServer) {
    showAlert({
      type: 'warning',
      title: 'HUB não configurado',
      message: 'Faça o login/autenticação para acessar.',
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
      collapseDelayMs: 150
    });

    openModal({ type: 'login' });
    return;
  }

  const userData = await fetchUserData();
  const authExpires = userData?.expires ? Date.parse(userData.expires) : 0;
  const now = Date.now();
  const skewMs = 30 * 1000;

  const isValid =
    !!token &&
    Number.isFinite(authExpires) &&
    (now + skewMs) < authExpires;

  if (isValid) {
    setUserInfo(userData?.username, token, userData?.avatar_id);
    updateCounts();

    showAlert({
      type: 'success',
      title: `Olá, ${userData?.username}!`,
      message: `Sua sessão está ativa.`,
      buttons: [],
      durationMs: 2000,
      dismissible: false,
      collapseDelayMs: 150
    });

  } else {
    localStorage.removeItem('authToken');
  }

  if (!isValid) {
    return false;
  }

  getConfigs();

  return true;
}

export async function fetchUserData() {
  const url = new URL(localStorage.getItem('hubServer'));
  const token = localStorage.getItem('authToken');

  url.searchParams.set('path', 'user');
  url.searchParams.set('token', token);

  const r = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Content-Type': 'text/plain' }
  });

  const text = await r.text();
  let data = null; try { data = JSON.parse(text); } catch (_) { }
  if (!r.ok) {
    const msg = data?.error || `erro ${r.status}`;
    showAlert({
      type: 'error',
      title: 'Falha ao autenticar!',
      message: msg,
      durationMs: 3000
    });
    openModal({ type: 'login' });
  }
  if (!data?.ok) {
    showAlert({
      type: 'warning',
      title: 'Faça login',
      message: 'Faça o login/autenticação para prosseguir.',
      buttons: [],
      durationMs: 5000,
      dismissible: false,
      collapseDelayMs: 150
    });
    openModal({ type: 'login' });

    return null;
  }
  return data;
}

export async function loginRequest({ username, password, baseUrl }) {
  const url = new URL(baseUrl());
  url.searchParams.set('path', 'auth/login');

  const r = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ username, password })
  });

  const text = await r.text();
  let data = null; try { data = JSON.parse(text); } catch (_) { }
  if (!r.ok) {
    const msg = data?.error || `erro ${r.status}`;
    showAlert({
      type: 'error',
      title: 'Falha ao autenticar!',
      message: msg,
      durationMs: 3000
    });
  }
  if (!data?.token) {
    showAlert({
      type: 'error',
      title: 'Falha na autenticação!',
      message: 'Verifique suas credenciais e tente novamente.',
      durationMs: 4000
    });

    return null;
  }

  // salva o token já no localStorage via setUserInfo
  setUserInfo(data.username, data.token, data.avatar_id);
  updateCounts();

  return true;
}

export async function fetchUserRole() {
  const url = new URL(localStorage.getItem('hubServer'));
  const token = localStorage.getItem('authToken');

  url.searchParams.set('path', 'user/role');
  url.searchParams.set('token', token);

  const r = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Content-Type': 'text/plain' }
  });

  const text = await r.text();
  let data = null; try { data = JSON.parse(text); } catch (_) { }
  if (!r.ok) {
    const msg = data?.error || `erro ${r.status}`;
    showAlert({
      type: 'error',
      title: 'Falha ao autenticar!',
      message: msg,
      durationMs: 3000
    });
    openModal({ type: 'login' });
  }
  if (!data?.ok) {
    showAlert({
      type: 'warning',
      title: 'Faça login',
      message: 'Faça o login/autenticação para prosseguir.',
      buttons: [],
      durationMs: 5000,
      dismissible: false,
      collapseDelayMs: 150
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
  const data = await apiGet('auth/guest-login');
  if (!data) return null;

  // se a resposta for {"error":"guest desabilitado"} 
  if (data?.error) {
    showAlert({
      type: 'error',
      title: 'Falha ao autenticar!',
      message: data.error,
      durationMs: 3000
    });
    return null;
  }

  setUserInfo(data.username, data.token, data.avatar_id);
  updateCounts();

  return true;
}

/**
 * Valida se é um ID Ops no formato "Ops" + dígitos.
 */
export function isValidOpsId(str) {
  const s = String(str || '').trim();
  return /^Ops\d+$/.test(s);
}

/**
 * Valida se é um email corporativo permitido.
 */
export function isValidCorporateEmail(str) {
  const lower = String(str || '').trim().toLowerCase();
  const basic = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower);
  if (!basic) return false;
  return (
    lower.endsWith('@shopee.com') ||
    lower.endsWith('@shopeemobile-external.com')
  );
}

/**
 * Normaliza o identificador de login/registro em um formato único:
 * - Se "OpsXXXXX" + nome completo => "[opsXXXXX]Nome Completo"
 * - Se email corporativo válido => o próprio email
 *
 * Retorna:
 * { ok: true, ident, mode: 'ops' | 'email' }
 * ou
 * { ok: false, error }
 */
export function normalizeIdentifier(rawIdent, fullName) {
  const ident = String(rawIdent || '').trim();
  const name = String(fullName || '').trim();

  const isOps = isValidOpsId(ident);
  const isEmail = isValidCorporateEmail(ident);

  if (!isOps && !isEmail) {
    return {
      ok: false,
      error: 'Usuário/E-mail precisa ser OpsXXXXX ou um e-mail corporativo permitido.'
    };
  }

  if (isOps) {
    if (!name) {
      return {
        ok: false,
        error: 'Para usuários OpsXXXXX, o nome completo é obrigatório.'
      };
    }
    const numPart = ident.slice(3); // depois de "Ops"
    const opsTag = `ops${numPart}`; // padroniza em minúsculo
    return {
      ok: true,
      ident: `[${opsTag}]${name}`,
      mode: 'ops'
    };
  }

  // email válido
  return {
    ok: true,
    ident,
    mode: 'email'
  };
}

/**
 * Salva dados do HUB selecionado no localStorage.
 * Útil para login e registro, então centralizamos aqui.
 */
export function saveHubLocal(hub) {
  if (!hub) return;
  try {
    localStorage.setItem('hubCode', hub.code);
    localStorage.setItem('hubServer', hub.server);
    localStorage.setItem('hubLabel', hub.label);
  } catch (err) {
    console.error('Falha ao salvar hub local:', err);
  }
}
