import { showAlert } from './alerts.js';
import { openModal } from '../modal.js';
import { startGetConfigLoop } from '../app.js';
import { updateCounts } from './helper.js';

const $ = (selector) => document.querySelector(selector);

export function setUserInfo(username, token, avatarImg) {
  const hubLabel = sessionStorage.getItem('hubLabel');

  if (username && token) {
    $('.username').textContent = username;
    $('.hub').textContent = hubLabel;
    $('.avatar img').src = avatarImg ? `./src/assets/img/profile-images/${avatarImg}.jpg` : './src/assets/img/profile-images/0.jpg';
    sessionStorage.setItem('authToken', token);
    return;
  }

  if (avatarImg) {
    $('.avatar img').src = avatarImg ? `./src/assets/img/profile-images/${avatarImg}.jpg` : './assets/img/profile-images/0.jpg';
    return;
  }
}

export async function verifyUserSession() {
  const token = sessionStorage.getItem('authToken');

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

  const isValid = !!token && Number.isFinite(authExpires) && (now + skewMs) < authExpires;

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
    sessionStorage.removeItem('authToken');
  }

  if (!isValid) {
    return false;
  }

  startGetConfigLoop();

  return true;
}

export async function fetchUserData() {
  const url = new URL(sessionStorage.getItem('hubServer'));
  const token = sessionStorage.getItem('authToken');

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

  setUserInfo(data.username, data.token, data.avatar_id);
  updateCounts();

  return true;
}

export async function fetchUserRole() {
  const url = new URL(sessionStorage.getItem('hubServer'));
  const token = sessionStorage.getItem('authToken');

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
  sessionStorage.removeItem('authToken');

  setUserInfo(null, null, null);
}
