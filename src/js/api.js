let BASE = null;

export function setBase(url) {
  BASE = url;
  sessionStorage.setItem('hubServer', url);
}
export function getBase() {
  return BASE || sessionStorage.getItem('hubServer') || '';
}

export class ApiError extends Error {
  constructor(status, message, data) { super(message); this.status = status; this.data = data; }
}

// ---- núcleo ---------------------------------------------------------------
export async function apiRequest(method, path, payload) {
  const base = getBase();
  if (!base) throw new ApiError(0, 'HUB não selecionado');

  const url = new URL(base);
  url.searchParams.set('path', String(path).replace(/^\//, ''));

  // override para evitar preflight (PUT/DELETE/PATCH viram POST + _method)
  const m = String(method || 'GET').toUpperCase();
  const needsOverride = m === 'PUT' || m === 'DELETE' || m === 'PATCH';
  const fetchMethod = needsOverride ? 'POST' : m;
  if (needsOverride) url.searchParams.set('_method', m);

  const token = sessionStorage.getItem('authToken');
  const isGetLike = fetchMethod === 'GET' || fetchMethod === 'HEAD';

  const opts = { method: fetchMethod, headers: {}, body: undefined };

  if (isGetLike) {
    if (token) url.searchParams.set('token', token);
    if (payload && typeof payload === 'object') {
      for (const [k, v] of Object.entries(payload)) url.searchParams.set(k, String(v));
    }
  } else {
    if (payload instanceof FormData || payload instanceof Blob) {
      // não setar Content-Type -> mantém simple request
      const fd = payload;
      if (token && payload instanceof FormData && !payload.has('token')) fd.append('token', token);
      opts.body = fd;
    } else {
      const body = { ...(payload || {}) };
      if (token) body.token = token;
      // text/plain evita preflight com POST
      opts.headers['Content-Type'] = 'text/plain';
      opts.body = JSON.stringify(body);
    }
  }

  let res;
  try { res = await fetch(url.toString(), opts); }
  catch { throw new ApiError(0, 'falha de rede ou CORS'); }

  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = null; }

  if (!res.ok) throw new ApiError(res.status, data?.error || `erro ${res.status}`, data);
  return data ?? {};
}

export const apiGet = (p, q) => apiRequest('GET', p, q);
export const apiPost = (p, b) => apiRequest('POST', p, b);
export const apiPut  = (p, b) => apiRequest('PUT', p, b);
export const apiDel  = (p, b) => apiRequest('DELETE', p, b);

// ---- conveniências --------------------------------------------------------

export const updateConfig = (cfg) => apiPut('config', cfg);

// users (admin)
export const createUser = (u) => apiPost('users', u);
export const updateUser = (username, b) => apiPut(`users/${encodeURIComponent(username)}`, b);
export const deleteUser = (username) => apiDel(`users/${encodeURIComponent(username)}`);
export const getPallets      = (params) => apiGet('pallets', params);
export const deletePallet    = (pallet) => apiDel('pallet', { pallet });
export const deletePackage   = (brCode, pallet) => apiDel('package', { brCode, pallet });

