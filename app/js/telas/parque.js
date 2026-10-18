// Parque: as 55 máquinas com busca, filtros, última visita e ocorrências em aberto.
import * as db from '../db.js';
import { SITUACOES_ABERTAS, verdadeiro } from '../modelo.js';
import { montar, h, chips, placa, dataBR } from '../ui.js';
import { ativos, modeloCurto, munckCurto } from './comum.js';

let filtroCidade = '';
let filtroSituacao = '';
let termo = '';

export async function render(el) {
  const [equipamentos, visitasTodas, ocorrTodas] = await Promise.all([db.todos('Equipamentos'), db.todos('Visitas'), db.todos('Ocorrencias')]);
  const visitas = ativos(visitasTodas).filter((v) => verdadeiro(v.concluida)).sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)));
  const ultima = {};
  for (const v of visitas) if (!ultima[v.placa]) ultima[v.placa] = v;
  const abertas = {};
  for (const o of ativos(ocorrTodas)) if (!o.situacao || SITUACOES_ABERTAS.includes(o.situacao)) abertas[o.placa] = (abertas[o.placa] || 0) + 1;

  const cidades = [...new Set(equipamentos.map((e) => e.cidade).filter(Boolean))].sort();
  const busca = h('input', { type: 'search', placeholder: 'Buscar placa, modelo ou lotação', value: termo, autocapitalize: 'characters' });
  const contagem = h('p', { style: 'color:var(--tinta-suave);margin:0 0 10px' });
  const lista = h('ul', { class: 'lista' });

  const desenhar = () => {
    const t = termo.trim().toUpperCase();
    const itens = equipamentos
      .filter((e) => !filtroCidade || e.cidade === filtroCidade)
      .filter((e) => filtroSituacao !== 'nao' || !ultima[e.id])
      .filter((e) => filtroSituacao !== 'sim' || ultima[e.id])
      .filter((e) => filtroSituacao !== 'ocorr' || abertas[e.id])
      .filter((e) => !t || `${e.id} ${e.des_mod_veic} ${e.lotacao} ${e.serie_munck}`.toUpperCase().includes(t))
      .sort((a, b) => String(a.cidade).localeCompare(b.cidade) || a.id.localeCompare(b.id));
    contagem.textContent = `${itens.length} de ${equipamentos.length} máquinas`;
    montar(lista, ...itens.map((e) => {
      const u = ultima[e.id];
      return h('li', {}, h('a', { class: 'item' + (u ? ' feito' : ''), href: `#/equipamento/${encodeURIComponent(e.id)}` },
        placa(e.id),
        h('div', { class: 'info' },
          h('div', { class: 'titulo' }, u ? [h('span', { class: 'ponto ' + u.status }), ` Visitada em ${dataBR(u.inicio)}`] : 'Ainda não visitada'),
          h('div', { class: 'sub' }, `${e.cidade} · ${modeloCurto(e)} · ${munckCurto(e)}`),
          abertas[e.id] ? h('div', { class: 'sub', style: 'color:#9E241B;font-weight:600' }, `${abertas[e.id]} ocorrência(s) em aberto`) : null)));
    }));
    if (!itens.length) montar(lista, h('li', { class: 'vazio' }, 'Nenhuma máquina com esses filtros.'));
  };
  busca.addEventListener('input', () => { termo = busca.value; desenhar(); });

  montar(el, 
    h('header', { class: 'cab-tela' }, h('h1', {}, 'Parque TKA'), h('p', {}, 'Todas as máquinas, visitadas ou não.')),
    h('section', { class: 'bloco' },
      busca, h('div', { style: 'height:12px' }),
      h('div', { class: 'campo' }, h('span', {}, 'Cidade'), chips(cidades, filtroCidade, (c) => { filtroCidade = c; desenhar(); }, { permitirVazio: true })),
      h('div', { class: 'campo', style: 'margin:0' }, h('span', {}, 'Situação'),
        chips([{ v: 'nao', t: 'Não visitadas' }, { v: 'sim', t: 'Visitadas' }, { v: 'ocorr', t: 'Com ocorrência aberta' }], filtroSituacao,
          (s) => { filtroSituacao = s; desenhar(); }, { permitirVazio: true }))),
    contagem, lista);
  desenhar();
}
