// src/js/api.js
let BASE = null;

// URL fixa do backend em produção (Railway)
const PROD_BASE = 'https://zany-collie-spx-chapeco-dc6ddbc3.koyeb.app/api';

// URL local para desenvolvimento
const DEV_BASE = 'http://localhost:8081/api';

export function setBase(url) {
  BASE = url;
  try {
    localStorage.setItem('hubServer', url);
  } catch (_) {}
}

export function getBase() {
  // 1) Se já setou manualmente (login/registro), usa essa
  if (BASE) return BASE;

  // 2) Se tem no localStorage, usa
  const saved = localStorage.getItem('hubServer');
  if (saved) {
    BASE = saved;
    return saved;
  }

  // 3) Decide pelo host: GitHub Pages => produção, senão dev
  const host = (typeof window !== 'undefined' && window.location?.hostname) || '';
  const isGithub = host.endsWith('github.io');

  const url = PROD_BASE;
  BASE = url;
  return url;
}

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function getCurrentHubCode() {
  return localStorage.getItem('hubCode') || '';
}

function getAuthToken() {
  return localStorage.getItem('authToken') || '';
}

// ---- núcleo ---------------------------------------------------------------
export async function apiRequest(method, path, payload) {
  const base = getBase();
  if (!base) throw new ApiError(0, 'BASE da API não configurada');

  const url = new URL(base);
  // continua usando ?path=... pra compat com seu backend
  url.searchParams.set('path', String(path).replace(/^\//, ''));

  const m = String(method || 'GET').toUpperCase();
  const isGetLike = m === 'GET' || m === 'HEAD';

  const token = getAuthToken();
  const hubCode = getCurrentHubCode();

  const opts = {
    method: m,
    headers: {},
    body: undefined,
  };

  if (isGetLike) {
    if (token) url.searchParams.set('token', token);
    if (hubCode) url.searchParams.set('hub', hubCode);
    if (payload && typeof payload === 'object') {
      for (const [k, v] of Object.entries(payload)) {
        url.searchParams.set(k, String(v));
      }
    }
  } else {
    const body = { ...(payload || {}) };
    if (token && !body.token) body.token = token;
    if (hubCode && !body.hub) body.hub = hubCode;

    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url.toString(), opts);
  } catch (e) {
    throw new ApiError(0, 'falha de rede ou CORS', null);
  }

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }

  if (!res.ok) {
    const msg = data?.error || `erro ${res.status}`;
    throw new ApiError(res.status, msg, data);
  }

  return data ?? {};
}

export const apiGet  = (p, q) => apiRequest('GET', p, q);
export const apiPost = (p, b) => apiRequest('POST', p, b);
export const apiPut  = (p, b) => apiRequest('PUT', p, b);
export const apiDel  = (p, b) => apiRequest('DELETE', p, b);

// conveniências
export const updateConfig  = (cfg)                  => apiPut('config', cfg);
export const createUser    = (u)                    => apiPost('users', u);
export const updateUser    = (username, b)          => apiPut(`users/${encodeURIComponent(username)}`, b);
export const getPallets    = (params)               => apiGet('pallets', params);
export const deletePallet  = (pallet)               => apiDel('pallet', { pallet });
export const deletePackage = (brCode, pallet)       => apiDel('package', { brCode, pallet });
export const deleteUser    = (username)             => apiPost('users/action', { username, action:"delete" });
export async function userAction({ username, action }) { return apiPost('users/action', { username, action });}
