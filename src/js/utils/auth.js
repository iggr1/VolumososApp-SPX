import { showAlert } from './alerts.js';
import { openModal } from '../modal.js';
import { startGetConfigLoop } from '../app.js';
import { updateCounts } from './helper.js';
import { apiPost } from '../api.js';

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

  startGetConfigLoop();

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
