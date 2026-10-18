// Planejamento: escolher a data, as máquinas, a ordem das paradas e o local previsto de cada uma.
import * as db from '../db.js';
import { hojeLocal, verdadeiro, uuid } from '../modelo.js';
import { app, montar, h, chips, toast, placa, diaSemana, debounce } from '../ui.js';
import { ativos, modeloCurto, munckCurto, mensagemConsulta } from './comum.js';

const amanha = () => { const d = new Date(); d.setDate(d.getDate() + 1); return hojeLocal(d); };

let dataEscolhida = null;
let filtroCidade = '';
let soNuncaVisitadas = false;

export async function render(el) {
  dataEscolhida = dataEscolhida || amanha();
  const edita = app.podeEditar();
  const autor = app.sessao?.autor;
  const [equipamentos, visitas, roteiroTodo] = await Promise.all([db.todos('Equipamentos'), db.todos('Visitas'), db.todos('Roteiro')]);
  const visitadas = new Set(ativos(visitas).filter((v) => verdadeiro(v.concluida)).map((v) => v.placa));
  const roteiro = ativos(roteiroTodo);
  const doDia = roteiro.filter((r) => r.data === dataEscolhida && r.situacao !== 'reagendada').sort((a, b) => Number(a.ordem) - Number(b.ordem));
  const noDia = new Set(doDia.map((r) => r.placa));
  const outrasDatas = Object.fromEntries(roteiro.filter((r) => r.data !== dataEscolhida && r.data >= hojeLocal() && r.situacao === 'planejada').map((r) => [r.placa, r.data]));
  const eqPorPlaca = Object.fromEntries(equipamentos.map((e) => [e.id, e]));
  const recarregar = () => render(el);

  const data = h('input', { type: 'date', value: dataEscolhida, onchange: (e) => { dataEscolhida = e.target.value || amanha(); recarregar(); } });

  const mover = async (i, delta) => {
    const a = doDia[i];
    const b = doDia[i + delta];
    if (!a || !b) return;
    await db.salvar('Roteiro', { ...a, ordem: i + delta + 1 }, { autor });
    await db.salvar('Roteiro', { ...b, ordem: i + 1 }, { autor });
    recarregar();
  };

  const paradas = doDia.map((r, i) => {
    const eq = eqPorPlaca[r.placa] || {};
    const salvarLocal = debounce((valor) => db.salvar('Roteiro', { ...r, local_previsto: valor }, { autor }), 600);
    const local = h('input', { type: 'text', value: r.local_previsto || '', placeholder: 'Endereço ou link do rastreador', disabled: !edita,
      oninput: (e) => { r.local_previsto = e.target.value.trim(); salvarLocal(r.local_previsto); } });
    return h('li', { class: 'item' + (r.situacao === 'visitada' ? ' feito' : ''), style: 'flex-wrap:wrap' },
      h('span', { class: 'ordem' }, String(i + 1)), placa(r.placa),
      h('div', { class: 'info' }, h('div', { class: 'titulo' }, eq.cidade || ''), h('div', { class: 'sub' }, modeloCurto(eq))),
      h('div', { style: 'flex-basis:100%;margin-top:8px' }, local),
      edita ? h('div', { class: 'acoes', style: 'flex-basis:100%;margin-top:6px' },
        h('button', { type: 'button', class: 'btn claro btn-p', disabled: i === 0, onclick: () => mover(i, -1) }, '▲ Subir'),
        h('button', { type: 'button', class: 'btn claro btn-p', disabled: i === doDia.length - 1, onclick: () => mover(i, 1) }, '▼ Descer'),
        h('button', { type: 'button', class: 'btn perigo btn-p', onclick: async () => {
          await db.salvar('Roteiro', { ...r, removido: true }, { autor });
          recarregar();
        } }, 'Tirar')) : null);
  });

  const cidades = [...new Set(equipamentos.map((e) => e.cidade).filter(Boolean))].sort();
  const busca = h('input', { type: 'search', placeholder: 'Buscar placa ou modelo', autocapitalize: 'characters' });
  const lista = h('ul', { class: 'lista' });
  const desenharCandidatas = () => {
    const t = busca.value.trim().toUpperCase();
    const cands = equipamentos
      .filter((e) => !noDia.has(e.id))
      .filter((e) => !filtroCidade || e.cidade === filtroCidade)
      .filter((e) => !soNuncaVisitadas || !visitadas.has(e.id))
      .filter((e) => !t || `${e.id} ${e.des_mod_veic} ${e.lotacao}`.toUpperCase().includes(t))
      .sort((a, b) => Number(visitadas.has(a.id)) - Number(visitadas.has(b.id)) || String(a.cidade).localeCompare(b.cidade) || a.id.localeCompare(b.id));
    montar(lista, ...cands.map((e) => h('li', {}, h('button', {
      type: 'button', class: 'item' + (visitadas.has(e.id) ? ' feito' : ''), style: 'border-top:0;border-right:0;border-bottom:0;width:100%;text-align:left', disabled: !edita,
      onclick: async () => {
        await db.salvar('Roteiro', { id: uuid(), data: dataEscolhida, ordem: doDia.length + 1, placa: e.id, local_previsto: e.local_previsto || '', situacao: 'planejada', motivo: '' }, { autor });
        toast(`${e.id} adicionada ao roteiro.`, 'ok', { ms: 1500 });
        recarregar();
      },
    }, placa(e.id), h('div', { class: 'info' },
      h('div', { class: 'titulo' }, `${e.cidade}${visitadas.has(e.id) ? ' · já visitada' : ''}`),
      h('div', { class: 'sub' }, [modeloCurto(e), munckCurto(e), outrasDatas[e.id] ? `planejada para ${diaSemana(outrasDatas[e.id])}` : ''].filter(Boolean).join(' · '))),
    edita ? h('span', { style: 'font-weight:700;color:var(--petroleo);font-size:24px' }, '+') : null))));
    if (!cands.length) montar(lista, h('li', { class: 'vazio' }, 'Nenhuma máquina com esses filtros.'));
  };
  busca.addEventListener('input', desenharCandidatas);
  desenharCandidatas();

  montar(el, 
    h('header', { class: 'cab-tela' }, h('h1', {}, 'Planejar roteiro'), h('p', {}, 'Escolha a data, as máquinas e a ordem das paradas.')),
    mensagemConsulta(),
    h('section', { class: 'bloco' }, h('label', { class: 'campo', style: 'margin:0' }, h('span', {}, 'Data'), data)),
    h('section', { class: 'bloco' },
      h('h2', {}, `Roteiro de ${diaSemana(dataEscolhida)} `, h('span', { class: 'contagem' }, `(${doDia.length})`)),
      paradas.length ? h('ul', { class: 'lista' }, paradas) : h('p', { style: 'color:var(--tinta-suave);margin:0' }, 'Toque nas máquinas abaixo para montar o roteiro.')),
    h('section', { class: 'bloco' },
      h('h2', {}, 'Adicionar máquinas'),
      h('div', { class: 'campo' }, h('span', {}, 'Cidade'), chips(cidades, filtroCidade, (c) => { filtroCidade = c; desenharCandidatas(); }, { permitirVazio: true })),
      h('div', { class: 'campo' }, chips([{ v: 'sim', t: 'Só as nunca visitadas' }], soNuncaVisitadas ? 'sim' : '', (x) => { soNuncaVisitadas = x === 'sim'; desenharCandidatas(); }, { permitirVazio: true })),
      busca, h('div', { style: 'height:10px' }), lista));
}
