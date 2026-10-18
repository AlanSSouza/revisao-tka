// Sincronização: envia a outbox, sobe mídias em pedaços (retomando de onde parou) e baixa a base.
import * as db from './db.js';
import { chamar, entrar, ErroAuth, ErroRede } from './api.js';
import { PEDACO } from './config.js';
import { verdadeiro } from './modelo.js';

export const eventos = new EventTarget();
const LOTE = 50;
let rodando = null;
let ultimoOk = null;
let ultimoErro = null;

const emitir = (nome, detail) => eventos.dispatchEvent(new CustomEvent(nome, { detail }));

export async function pendentes() {
  const ob = await db.outbox();
  const registros = new Set(ob.map((i) => `${i.tabela}|${i.registro.id}`)).size;
  const bl = await db.blobs();
  const midias = await db.todos('Midias');
  const porId = Object.fromEntries(midias.map((m) => [m.id, m]));
  const bytes = bl.reduce((s, b) => s + (b.blob.size - (b.recebido || 0)), 0);
  const datas = [
    ...ob.map((i) => i.registro.atualizado_em),
    ...bl.map((b) => porId[b.id]?.criado_em || porId[b.id]?.atualizado_em),
  ].filter(Boolean).sort();
  return { registros, midias: bl.length, bytes, maisAntiga: datas[0] || null };
}

async function enviarOutbox() {
  const ob = await db.outbox();
  const porTabela = new Map();
  for (const item of ob) {
    if (!porTabela.has(item.tabela)) porTabela.set(item.tabela, new Map());
    const m = porTabela.get(item.tabela);
    const atual = m.get(item.registro.id) || { seqs: [] };
    m.set(item.registro.id, { registro: item.registro, seqs: [...atual.seqs, item.seq] });
  }
  for (const [tabela, m] of porTabela) {
    const itens = [...m.values()];
    for (let i = 0; i < itens.length; i += LOTE) {
      const lote = itens.slice(i, i + LOTE);
      await chamar('upsert', { tabela, registros: lote.map((x) => x.registro) });
      await db.removerOutbox(lote.flatMap((x) => x.seqs));
    }
  }
}

export async function blobParaBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function enviarMidia(m) {
  const b = await db.blob(m.id);
  if (!b) return;
  const total = b.blob.size;
  const meta = { ...m };
  let r = await chamar('uploadInicio', { midia: meta, total_bytes: total });
  let reinicios = 0;
  while (!r.concluido) {
    if (r.expirada) {
      if (++reinicios > 2) throw new Error('Sessão de upload expirou repetidamente');
      r = await chamar('uploadInicio', { midia: meta, total_bytes: total });
      continue;
    }
    const offset = r.recebido || 0;
    await db.marcarRecebido(m.id, offset);
    emitir('sync:progresso', { id: m.id, enviado: offset, total });
    const dados_b64 = await blobParaBase64(b.blob.slice(offset, offset + PEDACO));
    r = await chamar('uploadPedaco', { id: m.id, offset, dados_b64 }, { timeout: 180000 });
  }
  const atual = (await db.get('Midias', m.id)) || m;
  await db.atualizarLocal('Midias', { ...atual, link: r.link, drive_id: r.drive_id });
  await db.removerBlob(m.id);
}

// Uma mídia com problema não trava as demais; falta de rede ou senha interrompem tudo.
async function enviarMidias() {
  const erros = [];
  for (const b of await db.blobs()) {
    const m = await db.get('Midias', b.id);
    try {
      if (m && verdadeiro(m.removido)) await db.removerBlob(b.id);
      else if (m && !m.link) await enviarMidia(m);
      else if (m?.link) await db.removerBlob(b.id);
    } catch (e) {
      if (e instanceof ErroRede || e instanceof ErroAuth) throw e;
      erros.push(`${m?.nome_arquivo || b.id}: ${e.message}`);
    }
  }
  return erros;
}

async function executar() {
  emitir('sync:estado', { emAndamento: true, ultimoOk, erro: null, pendentes: await pendentes() });
  ultimoErro = null;
  try {
    const sessao = await db.meta('sessao');
    let errosMidia = [];
    if (sessao?.papel === 'registro') {
      await enviarOutbox();
      errosMidia = await enviarMidias();
    }
    const r = await chamar('pull');
    const dados = r.dados || {};
    // Acesso de consulta nunca guarda a lista de funcionários no aparelho (LGPD).
    if (sessao?.papel !== 'registro') dados.Funcionarios = [];
    await db.substituirTudo(dados);
    ultimoOk = new Date().toISOString();
    await db.setMeta('ultimo_pull', ultimoOk);
    if (errosMidia.length) ultimoErro = 'Falha ao enviar ' + errosMidia.join('; ');
  } catch (e) {
    if (e instanceof ErroAuth) {
      ultimoErro = 'auth';
      emitir('sync:auth', { msg: e.message });
    } else if (e instanceof ErroRede) {
      ultimoErro = 'rede';
    } else {
      ultimoErro = e.message || String(e);
    }
  }
  const resultado = { emAndamento: false, ultimoOk, erro: ultimoErro, pendentes: await pendentes() };
  emitir('sync:estado', resultado);
  return resultado;
}

// Depois de a senha mudar no servidor: valida a nova e continua com os pendentes intactos.
export async function trocarSenha(senha) {
  const sessao = await db.meta('sessao');
  const r = await entrar(sessao.autor, senha);
  await db.setMeta('sessao', { ...sessao, senha, papel: r.papel });
  return r.papel;
}

export function sincronizar() {
  if (!rodando) rodando = executar().finally(() => { rodando = null; });
  return rodando;
}

let agendado = false;
export function agendar() {
  if (agendado) return;
  agendado = true;
  navigator.storage?.persist?.().catch(() => {});
  let debounce;
  db.eventos.addEventListener('salvo', () => {
    clearTimeout(debounce);
    debounce = setTimeout(sincronizar, 3000);
  });
  addEventListener('online', sincronizar);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizar(); });
  setInterval(() => { if (navigator.onLine) sincronizar(); }, 120000);
}
