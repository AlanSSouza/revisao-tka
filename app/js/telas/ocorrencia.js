// Ocorrência (defeito): tipo, componente, gravidade, descrição, mídias e acompanhamento da garantia.
import * as db from '../db.js';
import { TIPOS_OCORRENCIA, COMPONENTES, GRAVIDADES, SITUACOES, SITUACOES_ABERTAS, hojeLocal } from '../modelo.js';
import { app, montar, h, chips, campo, toast, confirmar, placa } from '../ui.js';
import { autosave, ativos, galeria, botoesMidia, mensagemConsulta } from './comum.js';

const COR_GRAVIDADE = { leve: 'verde', moderada: 'amarelo', critica: 'vermelho' };

export async function render(el, { id }) {
  const o = await db.get('Ocorrencias', id);
  if (!o) {
    montar(el, h('div', { class: 'vazio' }, h('strong', {}, 'Ocorrência não encontrada'), h('a', { class: 'btn', href: '#/hoje' }, 'Ir para Hoje')));
    return;
  }
  const edita = app.podeEditar();
  const oc = autosave('Ocorrencias', o);
  const set = oc.set;
  const voltar = `#/visita/${o.visita_id}`;

  const cab = h('header', { class: 'cab-tela' },
    h('a', { class: 'voltar', href: voltar }, '‹ Voltar para a visita'),
    h('div', { style: 'display:flex;gap:12px;align-items:center' }, placa(o.placa),
      h('h1', { style: 'font-size:22px' }, o.tipo ? 'Ocorrência' : 'Nova ocorrência')));

  const componente = h('select', { disabled: !edita, onchange: (e) => set('componente', e.target.value) },
    h('option', { value: '' }, 'Escolha o componente'),
    COMPONENTES.map((c) => h('option', { value: c, selected: c === o.componente }, c)));
  const descricao = h('textarea', { disabled: !edita, placeholder: 'O que foi observado, quando acontece, em que condição de operação…',
    oninput: (e) => set('descricao', e.target.value) }, o.descricao || '');

  const garantia = h('div');
  const resolucao = h('div');
  const protocolo = h('input', { type: 'text', value: o.protocolo || '', disabled: !edita, oninput: (e) => set('protocolo', e.target.value.trim()) });
  const abertura = h('input', { type: 'date', value: o.abertura || '', disabled: !edita, oninput: (e) => set('abertura', e.target.value) });
  const previsao = h('input', { type: 'date', value: o.previsao || '', disabled: !edita, oninput: (e) => set('previsao', e.target.value) });
  const solucao = h('textarea', { disabled: !edita, placeholder: 'O que foi feito para resolver', oninput: (e) => set('solucao', e.target.value) }, o.solucao || '');
  garantia.append(h('div', { class: 'duas' }, campo('Protocolo / chamado', protocolo), campo('Aberto em', abertura)), campo('Previsão de solução', previsao));
  resolucao.append(campo('Solução', solucao));

  const mostrarSituacao = (s) => {
    garantia.hidden = !SITUACOES_ABERTAS.includes(s);
    resolucao.hidden = !String(s).startsWith('resolvido');
  };
  mostrarSituacao(o.situacao);

  const situacao = chips(SITUACOES, o.situacao, (s) => {
    set('situacao', s);
    if (s.startsWith('resolvido') && !oc.dados.resolvido_em) {
      set('resolvido_em', hojeLocal());
      set('resolvido_por', app.sessao.autor);
    }
    if (SITUACOES_ABERTAS.includes(s) && !oc.dados.abertura) {
      set('abertura', hojeLocal());
      abertura.value = hojeLocal();
    }
    mostrarSituacao(s);
  }, { desabilitado: !edita });

  const blocoMidia = h('section', { class: 'bloco' });
  async function desenharMidia() {
    const midias = ativos(await db.por('Midias', 'ocorrencia_id', id));
    montar(blocoMidia, h('h2', {}, 'Fotos e vídeos do defeito ', h('span', { class: 'contagem' }, `(${midias.length})`)),
      edita ? botoesMidia({ placa: o.placa, visitaId: o.visita_id, ocorrenciaId: id }, desenharMidia) : null,
      await galeria(midias));
  }

  const salvar = h('button', { type: 'button', class: 'btn bloco-largo', onclick: async () => {
    if (!oc.dados.tipo) { toast('Escolha o tipo do defeito.', 'erro'); return; }
    await oc.flush();
    toast('Ocorrência salva.', 'ok');
    app.ir(voltar);
  } }, 'Salvar ocorrência');

  const excluir = h('button', { type: 'button', class: 'btn perigo bloco-largo', style: 'margin-top:10px', onclick: async () => {
    if (!(await confirmar('Excluir esta ocorrência?', { ok: 'Excluir', perigo: true }))) return;
    set('removido', true);
    await oc.flush();
    app.ir(voltar);
  } }, 'Excluir ocorrência');

  montar(el, cab, mensagemConsulta(),
    h('section', { class: 'bloco' },
      h('h2', {}, 'Tipo de defeito'),
      chips(TIPOS_OCORRENCIA, o.tipo, (x) => set('tipo', x), { desabilitado: !edita }),
      h('div', { style: 'height:14px' }),
      campo('Componente', componente),
      h('div', { class: 'campo' }, h('span', {}, 'Gravidade'),
        chips(GRAVIDADES.map((g) => ({ ...g, cor: COR_GRAVIDADE[g.v] })), o.gravidade, (x) => set('gravidade', x), { desabilitado: !edita }),
        h('small', {}, 'Crítica = impede a operação do equipamento.')),
      campo('Descrição', descricao)),
    blocoMidia,
    h('section', { class: 'bloco' }, h('h2', {}, 'Situação'), situacao, h('div', { style: 'height:14px' }), garantia, resolucao),
    edita ? salvar : null, edita ? excluir : null);
  await desenharMidia();
}
