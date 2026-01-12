// src/js/utils/csvValidation.js

const REQUIRED_HEADERS = [
  'Calculation Task ID',
  'Group Number',
  'Sequence',
  'Stop',
  'Num of Order',
  'Route Cost',
  'Total Distance',
  'SPX TN',
  'Zipcode',
  'Cluster',
  'Date',
  'Shift Time',
  'Destination Address',
  'City',
  'Neighborhood',
  'Location Type',
  'Latitude',
  'Longitude',
  'Time Sent to Calculation Pool',
  'Length(cm)',
  'Width(cm)',
  'Height(cm)',
  'Weight (kg)',
  'Delivery Time',
  'Destination Station',
  'Corridor Cage',
  'Planned Vehicle Type',
  'Planned AT',
  'Rota',
  'RotaCidade',
  'Duração em segundos',
  'Onda de roteirização',
  'Distância total da rota',
  'Distância total da rota km',
  'Cabeça de CEP',
];

// Detecta delimitador (vírgula ou ponto-e-vírgula) com base no header
function detectDelimiter(headerLine) {
  const commas = (headerLine.match(/,/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  return semis > commas ? ';' : ',';
}

function stripBOM(s) {
  return s && s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function normalizeHeader(h) {
  return String(h ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

// Split CSV line (simples, mas respeita aspas)
function splitCsvLine(line, delimiter) {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // trata aspas escapadas ""
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

function firstNonEmptyLine(text) {
  const lines = String(text || '').split(/\r?\n/);
  for (const l of lines) {
    const t = l.trim();
    if (t) return t;
  }
  return '';
}

function countDataRows(text) {
  // conta linhas não vazias abaixo do header
  const lines = String(text || '').split(/\r?\n/);
  let foundHeader = false;
  let count = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (!foundHeader) {
      foundHeader = true;
      continue;
    }

    // linha de dados: precisa ter pelo menos 2 chars e alguma letra/número
    if (/[A-Za-z0-9À-ÿ]/.test(line)) count++;
  }

  return count;
}

/**
 * Valida arquivo CSV CTs
 * Regras:
 * 1) é CSV (extensão ou mime)
 * 2) colunas batem EXATAMENTE (ordem e nomes)
 * 3) existe pelo menos 1 linha de dados após o header
 *
 * @returns {Promise<{ok:true, delimiter:string, headers:string[] } | {ok:false, error:string, message:string }>}
 */
export async function validateCTsCsvFile(file) {
  if (!file) {
    return { ok: false, error: 'no_file', message: 'Nenhum arquivo selecionado.' };
  }

  const name = String(file.name || '');
  const lower = name.toLowerCase();
  const mime = String(file.type || '').toLowerCase();

  const looksCsv = lower.endsWith('.csv') || mime.includes('csv') || mime === 'text/plain';
  if (!looksCsv) {
    return { ok: false, error: 'not_csv', message: 'Arquivo inválido: selecione um CSV (.csv).' };
  }

  let text = '';
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: 'read_error', message: 'Não foi possível ler o arquivo.' };
  }

  const headerLineRaw = stripBOM(firstNonEmptyLine(text));
  if (!headerLineRaw) {
    return { ok: false, error: 'empty', message: 'CSV vazio: não há cabeçalho.' };
  }

  const delimiter = detectDelimiter(headerLineRaw);
  const headersRaw = splitCsvLine(headerLineRaw, delimiter);
  const headers = headersRaw.map(normalizeHeader);

  // valida quantidade e ordem exata
  if (headers.length !== REQUIRED_HEADERS.length) {
    return {
      ok: false,
      error: 'wrong_columns_count',
      message: `Colunas inválidas: esperado ${REQUIRED_HEADERS.length} colunas, veio ${headers.length}.`,
    };
  }

  for (let i = 0; i < REQUIRED_HEADERS.length; i++) {
    if (headers[i] !== REQUIRED_HEADERS[i]) {
      return {
        ok: false,
        error: 'wrong_columns',
        message: `Colunas inválidas: diferença na coluna ${i + 1}.\nEsperado: "${REQUIRED_HEADERS[i]}"\nVeio: "${headers[i] || '(vazio)'}"`,
      };
    }
  }

  // dados abaixo do header
  const dataRows = countDataRows(text);
  if (dataRows <= 0) {
    return {
      ok: false,
      error: 'no_data',
      message: 'CSV sem dados: é necessário ter linhas abaixo do cabeçalho.',
    };
  }

  return { ok: true, delimiter, headers };
}

/**
 * Reseta o input file com segurança (alguns browsers não deixam setar value)
 */
export function resetFileInput(inputEl) {
  if (!inputEl) return;
  try {
    inputEl.value = '';
  } catch {
    // fallback: substituir o node
    const clone = inputEl.cloneNode(true);
    inputEl.parentNode?.replaceChild(clone, inputEl);
  }
}
