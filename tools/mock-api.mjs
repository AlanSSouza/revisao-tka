// Servidor local para testar o app sem o Google: serve app/ e simula o Apps Script em /api.
// Uso: node tools/mock-api.mjs [porta]   — senhas: reg (registro), con (consulta).
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const PORTA = Number(process.argv[2] || 8787);
const RAIZ = 'app';
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const TABELAS = ['Equipamentos', 'Alteracoes', 'Funcionarios', 'Roteiro', 'Visitas', 'Equipe', 'Ocorrencias', 'Treinamentos', 'TreinamentoParticipantes', 'Midias'];
const dados = Object.fromEntries(TABELAS.map((t) => [t, new Map()]));
const carregar = (t, arq) => { if (existsSync(arq)) for (const r of JSON.parse(readFileSync(arq, 'utf8'))) dados[t].set(r.id, r); };
carregar('Equipamentos', 'data/equipamentos.json');
carregar('Funcionarios', 'data/funcionarios.json');
const uploads = new Map();
export const log = [];

function api(req) {
  log.push(req.acao);
  const papel = req.senha === 'reg' ? 'registro' : req.senha === 'con' ? 'consulta' : null;
  if (!papel) return { ok: false, erro: 'auth', msg: 'Senha inválida' };
  const escrita = ['upsert', 'seed', 'uploadInicio', 'uploadPedaco', 'uploadStatus'].includes(req.acao);
  if (escrita && papel !== 'registro') return { ok: false, erro: 'auth' };
  switch (req.acao) {
    case 'login': return { ok: true, papel };
    case 'pull': return { ok: true, servidor_em: new Date().toISOString(), dados: Object.fromEntries(TABELAS.filter((t) => t !== 'Funcionarios' || papel === 'registro').map((t) => [t, [...dados[t].values()]])) };
    case 'upsert': case 'seed':
      if (!dados[req.tabela]) return { ok: false, erro: 'param' };
      if (req.substituir) dados[req.tabela].clear();
      for (const r of req.registros) dados[req.tabela].set(r.id, { ...(dados[req.tabela].get(r.id) || {}), ...r });
      return { ok: true, gravados: req.registros.length };
    case 'uploadInicio': {
      const m = dados.Midias.get(req.midia.id);
      if (m?.link) return { ok: true, concluido: true, link: m.link, drive_id: m.drive_id };
      if (!uploads.has(req.midia.id)) uploads.set(req.midia.id, { total: req.total_bytes, recebido: 0, midia: req.midia });
      return { ok: true, recebido: uploads.get(req.midia.id).recebido };
    }
    case 'uploadPedaco': {
      const u = uploads.get(req.id);
      if (!u) return { ok: true, expirada: true, recebido: 0 };
      if (req.offset !== u.recebido) return { ok: true, recebido: u.recebido };
      u.recebido += Buffer.from(req.dados_b64, 'base64').length;
      if (u.recebido < u.total) return { ok: true, recebido: u.recebido };
      const id = 'mock-' + req.id.slice(0, 8);
      dados.Midias.set(req.id, { ...u.midia, drive_id: id, link: 'https://example.com/' + id, enviado_em: new Date().toISOString() });
      uploads.delete(req.id);
      return { ok: true, concluido: true, link: 'https://example.com/' + id, drive_id: id };
    }
    default: return { ok: false, erro: 'param' };
  }
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api') {
    let corpo = '';
    req.on('data', (c) => { corpo += c; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(api(JSON.parse(corpo))));
    });
    return;
  }
  if (req.method === 'GET' && req.url === '/__dados') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(Object.fromEntries(TABELAS.map((t) => [t, [...dados[t].values()]]))));
    return;
  }
  let caminho = decodeURIComponent(req.url.split('?')[0]);
  if (caminho.endsWith('/')) caminho += 'index.html';
  const arq = join(RAIZ, caminho);
  if (!existsSync(arq) || !statSync(arq).isFile()) { res.writeHead(404); res.end(); return; }
  let conteudo = readFileSync(arq);
  if (caminho === '/js/config.js') conteudo = String(conteudo).replace(/API_URL = '[^']*'/, "API_URL = '/api'");
  res.writeHead(200, { 'Content-Type': TIPOS[extname(arq)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(conteudo);
}).listen(PORTA, () => console.log(`mock em http://localhost:${PORTA}`));
