// Chamadas ao Apps Script. Corpo text/plain (sem headers customizados) para evitar preflight CORS.
import { API_URL } from './config.js';
import * as db from './db.js';

export class ErroAuth extends Error {}
export class ErroRede extends Error {}

export async function chamar(acao, params = {}, { cred, timeout = 60000 } = {}) {
  const sessao = cred || (await db.meta('sessao')) || {};
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let resp;
  try {
    resp = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ acao, senha: sessao.senha, autor: sessao.autor, ...params }),
      signal: ctrl.signal,
      redirect: 'follow',
    });
  } catch (e) {
    throw new ErroRede(e.name === 'AbortError' ? 'Tempo esgotado' : 'Sem conexão');
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) throw new ErroRede('Servidor indisponível (' + resp.status + ')');
  let r;
  try { r = await resp.json(); } catch { throw new ErroRede('Resposta inválida do servidor'); }
  if (!r.ok && r.erro === 'auth') throw new ErroAuth(r.msg || 'Senha inválida');
  if (!r.ok) throw new Error(r.msg || 'Erro no servidor');
  return r;
}

export const entrar = (autor, senha) => chamar('login', {}, { cred: { autor, senha } });
