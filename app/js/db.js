// IndexedDB: cópia local das tabelas + fila de saída (outbox) + arquivos de mídia pendentes.

export const TABELAS = ['Equipamentos', 'Alteracoes', 'Funcionarios', 'Roteiro', 'Visitas', 'Equipe',
  'Ocorrencias', 'Treinamentos', 'TreinamentoParticipantes', 'Midias'];

let banco = null;
export const eventos = new EventTarget();

const req2p = (req) => new Promise((ok, erro) => {
  req.onsuccess = () => ok(req.result);
  req.onerror = () => erro(req.error);
});

const fimTx = (tx) => new Promise((ok, erro) => {
  tx.oncomplete = () => ok();
  tx.onerror = () => erro(tx.error);
  tx.onabort = () => erro(tx.error);
});

export async function abrir(nome = 'revisao-tka') {
  if (banco) banco.close();
  const req = indexedDB.open(nome, 1);
  req.onupgradeneeded = () => {
    const d = req.result;
    for (const t of TABELAS) d.createObjectStore(t, { keyPath: 'id' });
    d.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
    d.createObjectStore('blobs', { keyPath: 'id' });
    d.createObjectStore('meta', { keyPath: 'k' });
  };
  banco = await req2p(req);
}

const store = (nome, modo = 'readonly') => banco.transaction(nome, modo).objectStore(nome);

export const get = (nome, id) => req2p(store(nome).get(id));
export const todos = (nome) => req2p(store(nome).getAll());
export const por = async (nome, campo, valor) => (await todos(nome)).filter((r) => r[campo] === valor);

export async function salvar(tabela, registro, { autor }) {
  const reg = { ...registro, atualizado_em: new Date().toISOString(), atualizado_por: autor };
  const tx = banco.transaction([tabela, 'outbox'], 'readwrite');
  tx.objectStore(tabela).put(reg);
  tx.objectStore('outbox').add({ tabela, registro: reg });
  await fimTx(tx);
  eventos.dispatchEvent(new CustomEvent('salvo', { detail: { tabela, id: reg.id } }));
  return reg;
}

// O iOS perde o arquivo por trás de um Blob/File guardado no IndexedDB quando o app é fechado,
// então guardamos os bytes. A leitura (antes da transação) evita que ela feche sozinha.
const paraBytes = async (arquivo) => ({ dados: await arquivo.arrayBuffer(), tipo: arquivo.type || '' });

const comBlob = (b) => {
  if (!b || b.blob) return b;
  const { dados, tipo, ...resto } = b;
  return { ...resto, blob: new Blob([dados], { type: tipo }) };
};

// Registro + arquivo na mesma transação: se o iOS matar o app, não sobra arquivo órfão.
export async function salvarComBlob(tabela, registro, arquivo, { autor }) {
  const reg = { ...registro, atualizado_em: new Date().toISOString(), atualizado_por: autor };
  const bytes = await paraBytes(arquivo);
  const tx = banco.transaction([tabela, 'outbox', 'blobs'], 'readwrite');
  tx.objectStore(tabela).put(reg);
  tx.objectStore('outbox').add({ tabela, registro: reg });
  tx.objectStore('blobs').put({ id: reg.id, ...bytes, recebido: 0 });
  await fimTx(tx);
  eventos.dispatchEvent(new CustomEvent('salvo', { detail: { tabela, id: reg.id } }));
  return reg;
}

export const outbox = () => todos('outbox');

export async function removerOutbox(seqs) {
  const tx = banco.transaction('outbox', 'readwrite');
  for (const s of seqs) tx.objectStore('outbox').delete(s);
  await fimTx(tx);
}

export async function substituirTudo(dados) {
  const nomes = Object.keys(dados).filter((t) => TABELAS.includes(t));
  const tx = banco.transaction([...nomes, 'outbox'], 'readwrite');
  const pendentes = await req2p(tx.objectStore('outbox').getAll());
  const pend = new Set(pendentes.map((i) => `${i.tabela}|${i.registro.id}`));
  for (const t of nomes) {
    const st = tx.objectStore(t);
    const locais = await req2p(st.getAll());
    st.clear();
    for (const r of locais) if (pend.has(`${t}|${r.id}`)) st.put(r);
    for (const r of dados[t]) if (!pend.has(`${t}|${r.id}`)) st.put(r);
  }
  await fimTx(tx);
}

export const salvarBlob = async (id, blob) => {
  const bytes = await paraBytes(blob);
  const tx = banco.transaction('blobs', 'readwrite');
  tx.objectStore('blobs').put({ id, ...bytes, recebido: 0 });
  await fimTx(tx);
};

export const blob = async (id) => comBlob(await get('blobs', id));
export const blobs = async () => (await todos('blobs')).map(comBlob);

export async function marcarRecebido(id, recebido) {
  const tx = banco.transaction('blobs', 'readwrite');
  const st = tx.objectStore('blobs');
  const b = await req2p(st.get(id));
  if (b) st.put({ ...b, recebido });
  await fimTx(tx);
}

export async function removerBlob(id) {
  const tx = banco.transaction('blobs', 'readwrite');
  tx.objectStore('blobs').delete(id);
  await fimTx(tx);
}

export const meta = async (k) => (await get('meta', k))?.v;

export async function setMeta(k, v) {
  const tx = banco.transaction('meta', 'readwrite');
  tx.objectStore('meta').put({ k, v });
  await fimTx(tx);
}

// Atualiza um registro local sem gerar envio (usado quando o servidor já tem o dado, ex.: link da mídia).
export async function atualizarLocal(tabela, registro) {
  const tx = banco.transaction(tabela, 'readwrite');
  tx.objectStore(tabela).put(registro);
  await fimTx(tx);
}

// Apaga todos os dados locais (usado ao sair da conta). Mantém só o último nome digitado.
export async function limparTudo() {
  const nome = await meta('ultimo_nome');
  const nomes = [...TABELAS, 'outbox', 'blobs', 'meta'];
  const tx = banco.transaction(nomes, 'readwrite');
  for (const n of nomes) tx.objectStore(n).clear();
  if (nome) tx.objectStore('meta').put({ k: 'ultimo_nome', v: nome });
  await fimTx(tx);
}
