// Boot do app: banco local, sessão, roteamento por hash, barra de sincronização e abas.
import * as db from './db.js';
import * as sync from './sync.js';
import { app, h, icone, toast } from './ui.js';

const ROTAS = [
  { re: /^#\/entrar$/, tela: 'entrada', semMoldura: true },
  { re: /^#\/hoje$/, tela: 'hoje', aba: 'hoje' },
  { re: /^#\/planejar$/, tela: 'planejar', aba: 'planejar' },
  { re: /^#\/parque$/, tela: 'parque', aba: 'parque' },
  { re: /^#\/equipamento\/([^/]+)$/, tela: 'equipamento', aba: 'parque', params: ['placa'] },
  { re: /^#\/visita\/([^/]+)$/, tela: 'visita', aba: 'hoje', params: ['id'] },
  { re: /^#\/ocorrencia\/([^/]+)$/, tela: 'ocorrencia', aba: 'hoje', params: ['id'] },
  { re: /^#\/treinamento\/([^/]+)$/, tela: 'treinamento', aba: 'hoje', params: ['id'] },
];

const ABAS = [
  { id: 'hoje', t: 'Hoje', href: '#/hoje' },
  { id: 'planejar', t: 'Planejar', href: '#/planejar' },
  { id: 'parque', t: 'Parque', href: '#/parque' },
  { id: 'garantias', t: 'Garantias', em_breve: true },
  { id: 'relatorios', t: 'Relatórios', em_breve: true },
];

const raiz = document.getElementById('raiz');
let seloSync, alertaIos;

function moldura(abaAtiva) {
  seloSync = h('button', { class: 'selo-sync', type: 'button', onclick: () => sync.sincronizar(), 'aria-live': 'polite' }, '…');
  alertaIos = h('div', { class: 'alerta-ios', hidden: true });
  const main = h('main', { id: 'tela' });
  const abas = h('nav', { class: 'abas', 'aria-label': 'Navegação principal' },
    ABAS.map((a) => h('a', {
      href: a.href || '#', 'aria-current': a.id === abaAtiva ? 'page' : null, 'aria-disabled': a.em_breve ? 'true' : null,
      onclick: a.em_breve ? (e) => { e.preventDefault(); toast(`${a.t} chega na próxima versão, durante a semana.`); } : null,
    }, icone(a.id), a.t)));
  const topo = h('header', { class: 'topo' },
    h('img', { class: 'logo', src: 'assets/logo.png', alt: 'Mariuá Construção e Energia' }),
    h('div', { style: 'display:flex;gap:8px;align-items:center' },
      seloSync,
      h('button', { class: 'selo-sync', type: 'button', 'aria-label': 'Conta', onclick: menuConta }, app.sessao.autor.split(' ')[0])));
  raiz.replaceChildren(topo, alertaIos, main, abas);
  atualizarSelo();
  return main;
}

async function menuConta() {
  const { modal } = await import('./ui.js');
  const p = await sync.pendentes();
  const info = h('p', {}, `${app.sessao.autor} · acesso de ${app.sessao.papel === 'registro' ? 'registro' : 'consulta'}.`);
  const sair = await modal('Conta', info, [
    { t: 'Fechar', classe: 'claro', valor: () => false },
    { t: 'Sair', classe: 'perigo', valor: () => true },
  ]);
  if (!sair) return;
  if (p.registros || p.midias) {
    toast('Ainda há itens não enviados. Sincronize antes de sair.', 'erro');
    return;
  }
  await db.limparTudo();
  app.sessao = null;
  app.ir('#/entrar');
}

let ultimoEstado = { emAndamento: false, erro: null, pendentes: { registros: 0, midias: 0, bytes: 0 } };

function textoSelo(e) {
  const n = e.pendentes.registros + e.pendentes.midias;
  if (e.emAndamento) return [h('span', { class: 'gira' }), 'Enviando'];
  if (!navigator.onLine || e.erro === 'rede') return [n ? `${n} pendentes` : 'Sem sinal'];
  if (n) return [`${n} pendentes`];
  if (e.ultimoOk) return ['Sincronizado ' + new Date(e.ultimoOk).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })];
  return ['Sincronizar'];
}

function atualizarSelo() {
  if (!seloSync?.isConnected) return;
  const e = ultimoEstado;
  const n = e.pendentes.registros + e.pendentes.midias;
  seloSync.dataset.estado = e.emAndamento ? '' : !navigator.onLine || e.erro === 'rede' ? 'offline' : n ? 'pendente' : e.ultimoOk ? 'ok' : '';
  seloSync.replaceChildren(...textoSelo(e));
  // iPhone pode apagar dados de sites sem uso: alerta quando há muita mídia parada.
  const p = e.pendentes;
  const horas = p.maisAntiga ? (Date.now() - new Date(p.maisAntiga)) / 36e5 : 0;
  const mb = p.bytes / 1024 / 1024;
  const alertar = p.midias && (horas > 12 || mb > 500);
  alertaIos.hidden = !alertar;
  if (alertar) alertaIos.textContent = `${p.midias} fotos/vídeos (${Math.round(mb)} MB) aguardando envio há ${Math.round(horas)} h. Conecte-se a uma rede e toque em "${n} pendentes" para enviar.`;
}

sync.eventos.addEventListener('sync:estado', (ev) => { ultimoEstado = { ...ultimoEstado, ...ev.detail }; atualizarSelo(); });
let pedindoSenha = false;
sync.eventos.addEventListener('sync:auth', async () => {
  if (pedindoSenha) return;
  pedindoSenha = true;
  const { modal, campo } = await import('./ui.js');
  const senha = h('input', { type: 'password', autocomplete: 'current-password' });
  const ok = await modal('A senha de acesso mudou', h('div', {},
    h('p', {}, 'Os registros pendentes estão guardados no aparelho. Digite a senha atual para continuar enviando.'),
    campo('Senha atual', senha)), [
    { t: 'Depois', classe: 'claro', valor: () => false }, { t: 'Continuar', valor: () => true }]);
  pedindoSenha = false;
  if (!ok || !senha.value) return;
  try {
    await sync.trocarSenha(senha.value);
    app.sessao = await db.meta('sessao');
    toast('Senha atualizada. Enviando pendentes…', 'ok');
    sync.sincronizar();
  } catch (e) {
    toast('Senha não aceita. Confira com o responsável pelo app.', 'erro');
  }
});
addEventListener('online', atualizarSelo);
addEventListener('offline', atualizarSelo);
db.eventos.addEventListener('salvo', async () => { ultimoEstado = { ...ultimoEstado, pendentes: await sync.pendentes() }; atualizarSelo(); });

let molduraAba = null;
async function rotear() {
  const hash = location.hash || '#/hoje';
  if (!app.sessao && hash !== '#/entrar') return app.ir('#/entrar');
  const rota = ROTAS.find((r) => r.re.test(hash));
  if (!rota) return app.ir('#/hoje');
  const m = hash.match(rota.re);
  const params = Object.fromEntries((rota.params || []).map((p, i) => [p, decodeURIComponent(m[i + 1])]));
  const mod = await import(`./telas/${rota.tela}.js`);
  let alvo;
  if (rota.semMoldura) {
    molduraAba = null;
    alvo = raiz;
  } else {
    alvo = moldura(rota.aba);
    molduraAba = rota.aba;
  }
  scrollTo(0, 0);
  try {
    await mod.render(alvo, params);
  } catch (e) {
    console.error(e);
    alvo.replaceChildren(h('div', { class: 'vazio' }, h('strong', {}, 'Não foi possível abrir esta tela'), h('p', {}, String(e.message || e))));
  }
}

function registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const avisar = (w) => toast('Nova versão do app. Toque aqui para atualizar.', 'ok', {
      ms: 0, acao: () => w.postMessage('pular'),
    });
    if (reg.waiting && navigator.serviceWorker.controller) avisar(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) avisar(w); });
    });
  }).catch(() => {});
  // Só recarrega quando uma versão nova substitui outra (não na primeira instalação).
  const tinhaControle = !!navigator.serviceWorker.controller;
  let recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (tinhaControle && !recarregou) { recarregou = true; location.reload(); }
  });
}

async function iniciar() {
  await db.abrir();
  app.sessao = (await db.meta('sessao')) || null;
  addEventListener('hashchange', rotear);
  registrarSW();
  if (app.sessao) {
    sync.agendar();
    ultimoEstado = { ...ultimoEstado, pendentes: await sync.pendentes(), ultimoOk: await db.meta('ultimo_pull') };
    sync.sincronizar();
  }
  await rotear();
}

iniciar();
