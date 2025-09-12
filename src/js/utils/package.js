import { apiDel } from '../api.js';

export function verifyBrCode(brCode) {
    const s = String(brCode || '').trim().toUpperCase();
    return /^BR[A-Z0-9]{13}$/.test(s);
}

export async function deletePackage({ brCode, palletId, all = false }) {
  const br = String(brCode || '').toUpperCase().trim();
  if (!br) throw new Error('brCode obrigatório');
  await apiDel('package', { brCode: br, pallet: palletId, all });
}

export async function deletePackagesByBrCodes(brCodes = [], palletId, { all = false } = {}) {
  const uniq = Array.from(
    new Set(
      brCodes
        .filter(Boolean)
        .map(s => String(s).toUpperCase().trim())
    )
  );

  const results = [];
  const failed = [];
  let ok = 0;

  for (const br of uniq) {
    try {
      await apiDel('package', { brCode: br, pallet: palletId, all });
      ok++;
      results.push({ brCode: br, ok: true });
    } catch (e) {
      const msg = e?.message || 'falha ao excluir';
      failed.push({ brCode: br, error: msg });
      results.push({ brCode: br, ok: false, error: e });
    }
  }

  return { ok, total: uniq.length, failed, results };
}

export async function deletePackagesByIndices(items = [], indices = [], palletId, { all = false } = {}) {
  const idxs = Array.isArray(indices) ? indices : Array.from(indices || []);
  const brs = idxs
    .map(i => items[i] && (items[i].brCode || items[i].brcode))
    .filter(Boolean);
  return deletePackagesByBrCodes(brs, palletId, { all });
}

export function dropItemsByIndices(items = [], indices = []) {
  const set = new Set(Array.isArray(indices) ? indices : Array.from(indices || []));
  const out = [];
  let removed = 0;
  items.forEach((it, i) => {
    if (set.has(i)) removed++;
    else out.push(it);
  });
  return { items: out, removed };
}