// Mocks em memória dos serviços do Google Apps Script + loader dos .gs via vm.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function criarSheet(nome) {
  const s = {
    nome, data: [], maxRows: 1000,
    getName: () => s.nome,
    getLastRow: () => s.data.length,
    getLastColumn: () => Math.max(0, ...s.data.map((r) => r.length)),
    getDataRange: () => s.getRange(1, 1, Math.max(1, s.data.length), Math.max(1, s.getLastColumn())),
    appendRow: (row) => { s.data.push([...row]); return s; },
    getMaxRows: () => s.maxRows,
    insertRowsAfter: (apos, n) => { s.maxRows += n; },
    getMaxColumns: () => Math.max(26, s.getLastColumn()),
    deleteRows: (ini, n) => { s.data.splice(ini - 1, n); },
    getRange: (r, c, nr = 1, nc = 1) => {
      if (r - 1 + nr > s.maxRows) throw new Error('As coordenadas do intervalo estão fora das dimensões da página.');
      return {
      getValues: () => Array.from({ length: nr }, (_, i) =>
        Array.from({ length: nc }, (_, j) => (s.data[r - 1 + i] || [])[c - 1 + j] ?? '')),
      setValues: (vals) => {
        vals.forEach((row, i) => {
          const linha = s.data[r - 1 + i] || (s.data[r - 1 + i] = []);
          row.forEach((v, j) => { linha[c - 1 + j] = v; });
        });
        for (let i = 0; i < s.data.length; i++) if (!s.data[i]) s.data[i] = [];
      },
      setNumberFormat: () => {},
      setFontWeight: () => {},
      clearContent: () => { for (let i = 0; i < nr; i++) if (s.data[r - 1 + i]) s.data[r - 1 + i] = []; },
    };
    },
    setFrozenRows: () => {},
  };
  return s;
}

function criarPlanilha(id, nome) {
  const ss = {
    id, nome, sheets: [criarSheet('Sheet1')],
    getId: () => id,
    getSheets: () => [...ss.sheets],
    getSheetByName: (n) => ss.sheets.find((x) => x.nome === n) || null,
    insertSheet: (n) => { const sh = criarSheet(n); ss.sheets.push(sh); return sh; },
    deleteSheet: (sh) => { ss.sheets = ss.sheets.filter((x) => x !== sh); },
  };
  return ss;
}

function iter(arr) { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; }

export function criarAmbiente() {
  const planilhas = {};
  const pastas = {};
  const arquivos = {};
  let seq = 0;
  const props = {};
  const cache = {};
  const fetches = [];
  const amb = {
    planilhas, pastas, arquivos, props, fetches,
    fetchHandler: () => ({ getResponseCode: () => 200, getHeaders: () => ({}), getContentText: () => '{}' }),
  };
  const criarPasta = (nome, pai) => {
    const id = 'pasta' + ++seq;
    const p = {
      id, nome, pai, getId: () => id, getName: () => nome,
      createFolder: (n) => criarPasta(n, id),
      getFoldersByName: (n) => iter(Object.values(pastas).filter((x) => x.pai === id && x.nome === n)),
    };
    pastas[id] = p;
    return p;
  };
  amb.globais = {
    SpreadsheetApp: {
      create: (nome) => { const id = 'ss' + ++seq; planilhas[id] = criarPlanilha(id, nome); return planilhas[id]; },
      openById: (id) => { if (!planilhas[id]) throw new Error('planilha inexistente'); return planilhas[id]; },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in props ? props[k] : null),
        setProperty: (k, v) => { props[k] = String(v); },
        deleteProperty: (k) => { delete props[k]; },
        getProperties: () => ({ ...props }),
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (k in cache ? cache[k] : null),
        put: (k, v) => { cache[k] = v; },
        remove: (k) => { delete cache[k]; },
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (t) => ({ conteudo: t, setMimeType() { return this; }, getContent() { return this.conteudo; } }),
    },
    DriveApp: {
      Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
      Permission: { VIEW: 'VIEW' },
      createFolder: (n) => criarPasta(n, null),
      getFolderById: (id) => pastas[id],
      getFileById: (id) => {
        const a = arquivos[id] || (arquivos[id] = { id });
        return { setSharing: (acc, perm) => { a.compartilhado = [acc, perm]; }, getUrl: () => `https://drive.google.com/file/d/${id}/view` };
      },
    },
    UrlFetchApp: { fetch: (url, opts = {}) => { fetches.push({ url, opts }); return amb.fetchHandler(url, opts); } },
    ScriptApp: { getOAuthToken: () => 'TOKEN' },
    Utilities: {
      base64Decode: (b64) => [...Buffer.from(b64, 'base64')],
      newBlob: (bytes) => ({ getBytes: () => bytes }),
      formatDate: (d) => d.toISOString(),
    },
    Logger: { log: () => {} },
    console,
  };
  return amb;
}

export function carregarGas(arquivos, amb = criarAmbiente()) {
  const ctx = vm.createContext({ ...amb.globais, Date, JSON, Math, Object, Array, String, Number, Error, Buffer });
  for (const a of arquivos) vm.runInContext(readFileSync(a, 'utf8'), ctx, { filename: a });
  ctx.amb = amb;
  return ctx;
}

export function post(ctx, corpo) {
  return JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(corpo) } }).getContent());
}
