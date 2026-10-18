// Tela inicial: números do parque, roteiro do dia, visitas em aberto e visita fora do roteiro.
import * as db from '../db.js';
import { resumoParque, hojeLocal, MOTIVOS_REAGENDAR, verdadeiro, uuid } from '../modelo.js';
import { app, montar, h, chips, campo, modal, toast, placa, diaSemana, icone } from '../ui.js';
import { ativos, iniciarVisita, linkMapa, linkWaze, modeloCurto, munckCurto } from './comum.js';

async function reagendar(r, aoFim) {
  let motivo = '';
  const outro = h('input', { type: 'text', placeholder: 'Descreva o motivo', hidden: true });
  const novaData = h('input', { type: 'date' });
  const ok = await modal(`Reagendar ${r.placa}`, h('div', {},
    h('div', { class: 'campo' }, h('span', {}, 'Motivo'), chips(MOTIVOS_REAGENDAR, '', (m) => { motivo = m; outro.hidden = m !== 'Outro'; })),
    outro, h('div', { style: 'height:10px' }),
    campo('Nova data (opcional)', novaData, 'Se ficar em branco, a máquina volta para a lista de sem data.')),
  [{ t: 'Cancelar', classe: 'claro', valor: () => false }, { t: 'Reagendar', valor: () => true }]);
  if (!ok) return;
  const textoMotivo = motivo === 'Outro' ? outro.value.trim() || 'Outro' : motivo;
  if (!textoMotivo) return toast('Escolha o motivo do reagendamento.', 'erro');
  const autor = app.sessao.autor;
  await db.salvar('Roteiro', { ...r, situacao: 'reagendada', motivo: textoMotivo }, { autor });
  if (novaData.value) {
    await db.salvar('Roteiro', { id: uuid(), data: novaData.value, ordem: 99, placa: r.placa, local_previsto: r.local_previsto || '', situacao: 'planejada', motivo: '' }, { autor });
  }
  toast(`${r.placa} reagendada.`, 'ok');
  aoFim();
}

function visitaAvulsa(equipamentos) {
  const busca = h('input', { type: 'search', placeholder: 'Placa, cidade ou modelo', autocapitalize: 'characters' });
  const lista = h('div', { class: 'lista', style: 'margin-top:10px;max-height:55dvh;overflow:auto' });
  const fechar = () => fundo.remove();
  const desenhar = () => {
    const t = busca.value.trim().toUpperCase();
    montar(lista, ...equipamentos
      .filter((e) => !t || `${e.id} ${e.cidade} ${e.des_mod_veic}`.toUpperCase().includes(t))
      .slice(0, 30)
      .map((e) => h('button', { type: 'button', class: 'item', style: 'border:0;width:100%;text-align:left', onclick: () => { fechar(); iniciarVisita(e.id); } },
        placa(e.id), h('div', { class: 'info' }, h('div', { class: 'titulo' }, e.cidade), h('div', { class: 'sub' }, modeloCurto(e))))));
  };
  busca.addEventListener('input', desenhar);
  desenhar();
  const fundo = h('div', { class: 'modal-fundo', onclick: (e) => { if (e.target === fundo) fechar(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Visita fora do roteiro' },
      h('h2', {}, 'Visita fora do roteiro'), busca, lista,
      h('button', { type: 'button', class: 'btn claro bloco-largo', style: 'margin-top:12px', onclick: fechar }, 'Cancelar')));
  document.body.append(fundo);
  busca.focus();
}

export async function render(el) {
  const hoje = hojeLocal();
  const [equipamentos, visitasTodas, roteiroTodo] = await Promise.all([db.todos('Equipamentos'), db.todos('Visitas'), db.todos('Roteiro')]);
  const visitas = ativos(visitasTodas);
  const roteiro = ativos(roteiroTodo);
  const eqPorPlaca = Object.fromEntries(equipamentos.map((e) => [e.id, e]));
  const r = resumoParque(equipamentos, visitas, roteiro, hoje);
  const edita = app.podeEditar();

  const paradas = roteiro.filter((x) => x.data === hoje).sort((a, b) => Number(a.ordem) - Number(b.ordem));
  const atual = paradas.find((x) => x.situacao === 'planejada');
  const recarregar = () => render(el);

  const itemParada = (x, i) => {
    const eq = eqPorPlaca[x.placa] || {};
    const feito = x.situacao === 'visitada';
    const reag = x.situacao === 'reagendada';
    const ehAtual = x === atual;
    const mapa = linkMapa(x.local_previsto);
    const waze = linkWaze(x.local_previsto);
    return h('li', { class: 'item' + (feito ? ' feito' : reag ? ' reagendado' : ehAtual ? ' atual' : ''), style: 'flex-wrap:wrap' },
      h('span', { class: 'ordem' }, feito ? '✓' : String(i + 1)),
      placa(x.placa),
      h('div', { class: 'info' },
        h('div', { class: 'titulo' }, feito ? 'Visitada' : reag ? `Reagendada · ${x.motivo || ''}` : x.local_previsto ? (mapa === x.local_previsto ? 'Local do rastreador' : x.local_previsto) : 'Local a confirmar'),
        h('div', { class: 'sub' }, `${modeloCurto(eq)} · ${munckCurto(eq)}`)),
      !feito && !reag ? h('div', { class: 'acoes', style: 'flex-basis:100%;margin-top:6px' },
        edita ? h('button', { type: 'button', class: 'btn btn-p' + (ehAtual ? '' : ' sec'), onclick: () => iniciarVisita(x.placa) }, 'Iniciar visita') : null,
        mapa ? h('a', { class: 'btn claro btn-p', href: mapa, target: '_blank', rel: 'noopener' }, icone('mapa'), 'Mapa') : null,
        waze ? h('a', { class: 'btn claro btn-p', href: waze, target: '_blank', rel: 'noopener' }, 'Waze') : null,
        edita ? h('button', { type: 'button', class: 'btn claro btn-p', onclick: () => reagendar(x, recarregar) }, 'Reagendar') : null) : null);
  };

  const abertas = visitas.filter((v) => !verdadeiro(v.concluida));

  montar(el, 
    h('header', { class: 'cab-tela' }, h('h1', {}, 'Hoje, ' + diaSemana(hoje)),
      h('p', {}, paradas.length ? `${paradas.filter((p) => p.situacao === 'visitada').length} de ${paradas.length} paradas visitadas` : 'Nenhuma parada planejada para hoje')),
    h('div', { class: 'numeros' },
      h('div', {}, h('b', {}, r.total), h('small', {}, 'no parque')),
      h('div', {}, h('b', {}, r.visitadas), h('small', {}, 'visitadas')),
      h('div', {}, h('b', {}, r.hoje), h('small', {}, 'para hoje')),
      h('div', {}, h('b', {}, r.semData), h('small', {}, 'sem data'))),
    abertas.length ? h('section', { class: 'bloco' }, h('h2', {}, 'Visitas não concluídas'),
      h('ul', { class: 'lista' }, abertas.map((v) => h('li', {}, h('a', { class: 'item atual', href: `#/visita/${v.id}` }, placa(v.placa),
        h('div', { class: 'info' }, h('div', { class: 'titulo' }, 'Continuar visita'), h('div', { class: 'sub' }, `Iniciada por ${v.autor}`))))))) : null,
    paradas.length
      ? h('ul', { class: 'lista' }, paradas.map(itemParada))
      : h('div', { class: 'bloco vazio' }, h('strong', {}, 'Monte o roteiro de hoje'),
        h('p', {}, 'Escolha quais máquinas serão atendidas e a ordem das paradas.'),
        h('a', { class: 'btn sec', href: '#/planejar' }, 'Planejar roteiro')),
    edita ? h('button', { type: 'button', class: 'btn claro bloco-largo', style: 'margin-top:16px', onclick: () => visitaAvulsa(equipamentos) }, 'Visita fora do roteiro') : null);
}
