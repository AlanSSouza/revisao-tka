// Peças reutilizadas pelas telas: salvamento automático, galeria, botões de mídia e busca de pessoas.
import * as db from '../db.js';
import { capturar, urlMiniatura } from '../midia.js';
import { app, montar, h, icone, toast, debounce } from '../ui.js';
import { verdadeiro } from '../modelo.js';

export const ativos = (lista) => lista.filter((r) => !verdadeiro(r.removido));

export const rotulo = (lista, v) => lista.find((o) => o.v === v)?.t || v || '';

// Salva o registro a cada alteração (debounce) e garante gravação ao sair da tela.
export function autosave(tabela, registro, ms = 800) {
  const estado = { dados: { ...registro } };
  const gravar = debounce(() => db.salvar(tabela, estado.dados, { autor: app.sessao.autor }), ms);
  const flush = () => gravar.agora();
  addEventListener('hashchange', flush, { once: true });
  addEventListener('pagehide', flush, { once: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); }, { once: true });
  estado.set = (campo, valor) => {
    if (estado.dados[campo] === valor) return;
    estado.dados[campo] = valor;
    gravar();
  };
  estado.flush = flush;
  return estado;
}

export async function galeria(midias) {
  const lista = ativos(midias);
  const box = h('div', { class: 'galeria' });
  if (!lista.length) return box;
  for (const m of lista) {
    const url = await urlMiniatura(m);
    const pendente = !m.link;
    const tag = pendente ? 'pendente' : m.tipo === 'video' ? 'vídeo' : null;
    const midia = m.tipo === 'video' && pendente
      ? h('video', { src: url, muted: true, playsinline: true, preload: 'metadata' })
      : h('img', { src: url, alt: m.legenda || m.tipo, loading: 'lazy' });
    box.append(m.link
      ? h('a', { href: m.link, target: '_blank', rel: 'noopener' }, midia, tag ? h('span', { class: 'tag' }, tag) : null)
      : h('div', {}, midia, h('span', { class: 'tag' }, tag)));
  }
  return box;
}

export function botoesMidia(ctx, depois) {
  const acionar = (tipo, origem) => async () => {
    try {
      const res = await capturar({ tipo, origem, autor: app.sessao.autor, ...ctx });
      const aviso = res.find((r) => r.aviso)?.aviso;
      if (res.length) toast(aviso || (res.length === 1 ? 'Arquivo salvo no aparelho.' : `${res.length} arquivos salvos no aparelho.`), aviso ? 'erro' : 'ok', { ms: aviso ? 7000 : 2500 });
      if (res.length) depois?.();
    } catch (e) {
      toast('Não foi possível salvar o arquivo: ' + e.message, 'erro');
    }
  };
  return h('div', { class: 'acoes' },
    h('button', { type: 'button', class: 'btn sec btn-p', onclick: acionar('foto', 'camera') }, icone('camera'), 'Foto'),
    h('button', { type: 'button', class: 'btn sec btn-p', onclick: acionar('video', 'camera') }, icone('video'), 'Vídeo'),
    h('button', { type: 'button', class: 'btn claro btn-p', onclick: acionar('qualquer', 'galeria') }, icone('galeria'), 'Da galeria'));
}

let funcionarios = null;
const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

export async function buscarPessoas(termo, limite = 8) {
  if (!funcionarios) funcionarios = await db.todos('Funcionarios');
  const t = normalizar(termo).trim();
  if (t.length < 2) return [];
  const digitos = /^\d+$/.test(t);
  return funcionarios
    .filter((f) => (digitos ? String(f.matricula).startsWith(t) : normalizar(f.nome).includes(t)))
    .slice(0, limite);
}

// Campo de busca por nome ou matrícula; onEscolher recebe o funcionário escolhido.
export function buscaPessoa(onEscolher, { placeholder = 'Nome ou matrícula' } = {}) {
  const input = h('input', { type: 'search', placeholder, autocomplete: 'off', enterkeyhint: 'search' });
  const lista = h('ul', { class: 'sugestoes', hidden: true });
  const atualizar = debounce(async () => {
    const r = await buscarPessoas(input.value);
    montar(lista, ...r.map((f) => h('li', {}, h('button', {
      type: 'button',
      onclick: () => { input.value = ''; lista.hidden = true; onEscolher(f); },
    }, f.nome, h('small', {}, `Matrícula ${f.matricula} · ${f.funcao}`)))));
    lista.hidden = !r.length;
  }, 150);
  input.addEventListener('input', atualizar);
  return h('div', {}, input, lista);
}

function posicaoAtual(timeout = 10000) {
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok({});
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: Math.round(p.coords.accuracy) }),
      () => ok({}), { enableHighAccuracy: true, timeout, maximumAge: 60000 });
  });
}

// Retoma a visita não concluída da placa ou cria uma nova com GPS e hora.
export async function iniciarVisita(placa) {
  const { novaVisita } = await import('../modelo.js');
  const abertas = ativos(await db.por('Visitas', 'placa', placa)).filter((v) => !verdadeiro(v.concluida));
  if (abertas.length) return app.ir(`#/visita/${abertas[0].id}`);
  toast('Capturando localização…', '', { ms: 2000 });
  const v = novaVisita(placa, app.sessao.autor, await posicaoAtual());
  await db.salvar('Visitas', v, { autor: app.sessao.autor });
  app.ir(`#/visita/${v.id}`);
}

export function linkMapa(local) {
  const s = String(local || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return 'https://maps.apple.com/?q=' + encodeURIComponent(s);
}

export function linkWaze(local) {
  const s = String(local || '').trim();
  if (!s || /^https?:\/\//i.test(s)) return null;
  return 'https://waze.com/ul?navigate=yes&q=' + encodeURIComponent(s);
}

export const modeloCurto = (eq) => eq?.des_mod_veic || eq?.marca_modelo || '';
export const munckCurto = (eq) => String(eq?.status_veiculo || '').replace(/^MUNCK\s*/i, 'Munck ');

export function mensagemConsulta() {
  return app.podeEditar() ? null : h('p', { class: 'bloco', style: 'color:var(--tinta-suave)' }, 'Acesso de consulta: os dados podem ser vistos, mas não alterados.');
}
