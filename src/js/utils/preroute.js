// src/js/utils/preroute.js
import { apiGet } from '../api.js';

export async function getPreRoute(brCode) {
  const spx_tn = String(brCode || '')
    .trim()
    .toUpperCase();
  if (!spx_tn) return { ok: false, found: false, route: '' };

  const res = await apiGet('preroute', { spx_tn });

  return {
    ok: !!res?.ok,
    found: !!res?.found,
    route: String(res?.route || '').trim(),
  };
}
