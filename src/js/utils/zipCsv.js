// src/js/utils/zipCsv.js

const SIG_EOCD = 0x06054b50;
const SIG_CEN = 0x02014b50;
const SIG_LOC = 0x04034b50;

function readU16(view, offset) {
  return view.getUint16(offset, true);
}

function readU32(view, offset) {
  return view.getUint32(offset, true);
}

function decodeBytes(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

function findEocdOffset(bytes) {
  const min = Math.max(0, bytes.length - 0xffff - 22);
  for (let i = bytes.length - 22; i >= min; i--) {
    const sig =
      bytes[i] |
      (bytes[i + 1] << 8) |
      (bytes[i + 2] << 16) |
      (bytes[i + 3] << 24);
    if ((sig >>> 0) === SIG_EOCD) return i;
  }
  return -1;
}

async function inflateRawToUint8Array(compressed) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('Seu navegador não suporta descompactação de ZIP (DecompressionStream).');
  }

  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

export function isZipFile(file) {
  const name = String(file?.name || '').toLowerCase();
  const mime = String(file?.type || '').toLowerCase();
  return name.endsWith('.zip') || mime.includes('zip');
}

export async function extractCsvTextsFromZip(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  const eocdOffset = findEocdOffset(bytes);
  if (eocdOffset < 0) throw new Error('ZIP inválido: diretório central não encontrado.');

  const totalEntries = readU16(view, eocdOffset + 10);
  const centralDirOffset = readU32(view, eocdOffset + 16);

  const out = [];
  let ptr = centralDirOffset;

  for (let entryIndex = 0; entryIndex < totalEntries; entryIndex++) {
    if (readU32(view, ptr) !== SIG_CEN) {
      throw new Error('ZIP inválido: entrada do diretório central corrompida.');
    }

    const flags = readU16(view, ptr + 8);
    const method = readU16(view, ptr + 10);
    const compressedSize = readU32(view, ptr + 20);
    const fileNameLen = readU16(view, ptr + 28);
    const extraLen = readU16(view, ptr + 30);
    const commentLen = readU16(view, ptr + 32);
    const localHeaderOffset = readU32(view, ptr + 42);

    const fileNameStart = ptr + 46;
    const fileNameEnd = fileNameStart + fileNameLen;
    const fileName = decodeBytes(bytes.slice(fileNameStart, fileNameEnd));

    const isDirectory = fileName.endsWith('/');
    const isCsv = fileName.toLowerCase().endsWith('.csv');

    if (!isDirectory && isCsv) {
      if (flags & 0x1) {
        throw new Error(`ZIP inválido: arquivo protegido por senha não suportado (${fileName}).`);
      }

      if (readU32(view, localHeaderOffset) !== SIG_LOC) {
        throw new Error(`ZIP inválido: header local não encontrado (${fileName}).`);
      }

      const localNameLen = readU16(view, localHeaderOffset + 26);
      const localExtraLen = readU16(view, localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const dataEnd = dataStart + compressedSize;
      const compressed = bytes.slice(dataStart, dataEnd);

      let uncompressed;
      if (method === 0) {
        uncompressed = compressed;
      } else if (method === 8) {
        uncompressed = await inflateRawToUint8Array(compressed);
      } else {
        throw new Error(`ZIP inválido: método de compressão não suportado (${fileName}).`);
      }

      out.push({
        name: fileName,
        text: decodeBytes(uncompressed),
      });
    }

    ptr = fileNameEnd + extraLen + commentLen;
  }

  if (!out.length) {
    throw new Error('ZIP sem CSV: adicione ao menos um arquivo .csv dentro do Romaneio.');
  }

  return out;
}
