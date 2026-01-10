// src/js/utils/routesImport.js
import { apiPut } from '../api.js';

const COL_SPX_TN = 'SPX TN';
const COL_CORRIDOR = 'Corridor Cage';

const ENDPOINT_IMPORT = 'opdocs/routes/import';

function stripBOM(s) {
  return s && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

function firstNonEmptyLine(text) {
  const lines = String(text || '').split(/\r?\n/);
  for (const l of lines) {
    const t = l.trim();
    if (t) return t;
  }
  return '';
}

function detectDelimiter(headerLine) {
  const commas = (headerLine.match(/,/g) || []).length;
  const semis  = (headerLine.match(/;/g) || []).length;
  return semis > commas ? ';' : ',';
}

function normalizeHeader(h) {
  return String(h ?? '').trim().replace(/\s+/g, ' ');
}

// split CSV line respeitando aspas
function splitCsvLine(line, delimiter) {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      out.push(cur);
      cur = '';
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out;
}

function cleanValue(v) {
  let s = String(v ?? '').trim();
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) s = s.slice(1, -1);
  return s.trim();
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Extrai e retorna somente { spx_tn, corridor_cage }.
 * Filtra:
 * - linhas vazias
 * - linhas curtas (sem colunas suficientes)
 * - spx_tn vazio
 * - corridor_cage vazio (pra não mandar linhas incompletas)
 */
export async function extractRoutesFromCTsCsv(file) {
  if (!file) return { ok: false, error: 'no_file', message: 'Nenhum arquivo selecionado.' };

  const text = await file.text();
  const headerLineRaw = stripBOM(firstNonEmptyLine(text));
  if (!headerLineRaw) return { ok: false, error: 'empty', message: 'CSV vazio.' };

  const delimiter = detectDelimiter(headerLineRaw);
  const headers = splitCsvLine(headerLineRaw, delimiter).map(normalizeHeader);

  const idxTN = headers.indexOf(COL_SPX_TN);
  const idxCorridor = headers.indexOf(COL_CORRIDOR);
  if (idxTN < 0 || idxCorridor < 0) {
    return {
      ok: false,
      error: 'missing_columns',
      message: `CSV não contém as colunas: "${COL_SPX_TN}" e "${COL_CORRIDOR}".`
    };
  }

  const lines = String(text || '').split(/\r?\n/);
  let foundHeader = false;
  const rows = [];
  const maxIdx = Math.max(idxTN, idxCorridor);

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (!foundHeader) { foundHeader = true; continue; }

    // ignora linhas “fantasma” (só separadores/aspas/espaços)
    const onlyDelims = trimmed.replace(new RegExp(`[${delimiter}\\s"]`, 'g'), '');
    if (!onlyDelims) continue;

    const parts = splitCsvLine(raw, delimiter);
    if (!parts || parts.length <= maxIdx) continue;

    const spx_tn = cleanValue(parts[idxTN]).toUpperCase();
    const corridor_cage = cleanValue(parts[idxCorridor]);

    if (!spx_tn) continue;
    if (!corridor_cage) continue;

    rows.push({ spx_tn, corridor_cage });
  }

  if (!rows.length) {
    return { ok: false, error: 'no_rows', message: 'Nenhuma linha válida encontrada (SPX TN + Corridor Cage).' };
  }

  // dedupe por spx_tn (mantém o último corridor encontrado)
  const m = new Map();
  for (const r of rows) m.set(r.spx_tn, r);
  const deduped = Array.from(m.values());

  return { ok: true, rows: deduped, meta: { total: deduped.length, delimiter } };
}

/**
 * Envia para o servidor em lotes.
 * @param {File} file
 * @param {object} options
 * @param {number} options.batchSize tamanho do lote (recomendo 500~2000)
 * @param {(info:{chunk:number,totalChunks:number,sent:number,total:number})=>void} options.onProgress callback opcional
 */
export async function importRoutesFromCTsCsv(file, options = {}) {
  const batchSize = Number(options.batchSize || 1000);
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

  const extracted = await extractRoutesFromCTsCsv(file);
  if (!extracted.ok) throw new Error(extracted.message || 'Falha ao processar CSV.');

  const rows = extracted.rows;
  const chunks = chunkArray(rows, Math.max(1, batchSize));

  const serverResponses = [];
  let sent = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    const resp = await apiPut(ENDPOINT_IMPORT, {
      source: 'cts_csv',
      total: chunk.length,
      rows: chunk
    });

    serverResponses.push(resp);
    sent += chunk.length;

    if (onProgress) {
      onProgress({
        chunk: i + 1,
        totalChunks: chunks.length,
        sent,
        total: rows.length
      });
    }
  }

  return {
    ok: true,
    total: rows.length,
    batchSize,
    totalChunks: chunks.length,
    sent,
    serverResponses
  };
}
