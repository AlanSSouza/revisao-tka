// Relatório de uma placa: dados, garantias, cada visita com equipe, ocorrências, fotos e treinamentos. Exporta PDF.
import {
  STATUS, GRAVIDADES, SITUACOES, PAPEIS, CAUSAS, CONSTATACOES, PARECERES, DOMINIOS, TAREFAS_PROVA, RESULTADOS_PROVA,
  hojeLocal, formatarNumero, verdadeiro, provaIniciada, linkCoordenadas,
} from '../modelo.js';
import { relatorioPlaca } from '../relatorio.js';
import { app, montar, h, placa, dataBR, vazio } from '../ui.js';
import { galeria, rotulo, munckCurto } from './comum.js';
import { carregarDados, exportarPdf } from './relatorios.js';

const num = (v, suf = '') => (v === null || v === undefined || v === '' ? '—' : formatarNumero(v) + suf);
const linha = (t, v) => (v === null || v === undefined || v === '' ? null : h('tr', {}, h('th', {}, t), h('td', {}, String(v))));

export async function render(el, { placa: id }) {
  const r = relatorioPlaca(await carregarDados(), id, hojeLocal());
  if (!r.eq) {
    montar(el, vazio('Equipamento não encontrado', null, h('a', { class: 'btn', href: '#/relatorios' }, 'Ver relatórios')));
    return;
  }
  const e = r.eq;
  const botaoPdf = h('button', { type: 'button', class: 'btn bloco-largo' }, 'Exportar PDF');
  botaoPdf.addEventListener('click', async () => {
    const { pdfPlaca } = await import('../pdf.js');
    exportarPdf(botaoPdf, () => pdfPlaca(r, { autor: app.sessao.autor }), `Relatorio-${id}-${hojeLocal()}.pdf`);
  });

  const visitas = [];
  for (const v of [...r.visitas].reverse()) {
    const ocorr = [];
    for (const o of v.ocorrencias) {
      ocorr.push(h('div', { class: 'ocorrencia' },
        o.gravidade ? h('span', { class: 'gravidade ' + o.gravidade }, rotulo(GRAVIDADES, o.gravidade)) : null, ' ',
        h('strong', {}, o.tipo || 'Ocorrência'), o.componente ? ` · ${o.componente}` : '',
        o.relato ? h('p', { style: 'margin:6px 0' }, h('strong', {}, 'Relato: '), o.relato) : null,
        o.descricao ? h('p', { style: 'margin:6px 0' }, h('strong', {}, 'Constatado: '), o.descricao) : null,
        h('div', { class: 'sub-ocorr' }, [o.constatacao ? `Constatação: ${rotulo(CONSTATACOES, o.constatacao)}` : '', `Causa: ${rotulo(CAUSAS, o.causa || 'investigar')}`,
          o.parecer_tka ? `TKA ${rotulo(PARECERES, o.parecer_tka).toLowerCase()}` : '', verdadeiro(o.impediu_operacao) ? 'impediu a operação' : '',
          Number(o.horas_paradas) ? `${formatarNumero(o.horas_paradas)} h parado` : ''].filter(Boolean).join(' · ')),
        h('div', { class: 'sub-ocorr' }, [rotulo(SITUACOES, o.situacao) || 'Situação não informada', o.protocolo ? `protocolo ${o.protocolo}` : '',
          o.abertura ? `aberta ${dataBR(o.abertura)}` : '', o.resolvido_em ? `resolvida ${dataBR(o.resolvido_em)}` : ''].filter(Boolean).join(' · ')),
        o.solucao ? h('p', { style: 'margin:6px 0 0' }, h('strong', {}, 'Solução: '), o.solucao) : null,
        o.midias.length ? await galeria(o.midias) : null));
    }
    visitas.push(h('section', { class: 'bloco' },
      h('h2', {}, `Visita de ${dataBR(v.inicio, true)}`, verdadeiro(v.concluida) ? '' : h('span', { class: 'contagem' }, ' (em andamento)')),
      h('table', { class: 'tabela-dados' }, h('tbody', {},
        linha('Status', rotulo(STATUS, v.status)), linha('Registrada por', v.autor), linha('Engenheiro TKA', v.engenheiro),
        linkCoordenadas(v.lat, v.lng) ? h('tr', {}, h('th', {}, 'Local da visita'), h('td', {},
          h('a', { href: linkCoordenadas(v.lat, v.lng), target: '_blank', rel: 'noopener' }, 'Abrir no mapa'),
          h('span', { class: 'original', style: 'color:var(--tinta-suave)' },
            `${Number(v.lat).toFixed(5)}, ${Number(v.lng).toFixed(5)}${v.precisao ? ` · precisão de ${v.precisao} m` : ''}`))) : null,
        linha('KM', v.km !== '' && v.km != null ? num(v.km) : ''), linha('Horímetro', v.horimetro !== '' && v.horimetro != null ? num(v.horimetro, ' h') : ''),
        linha('Nº de série informado', v.serie_munck), linha('Observações', v.observacoes),
        linha('Equipe', v.equipe.map((p) => `${p.nome}${p.matricula ? ` (${p.matricula})` : ''} · ${[rotulo(PAPEIS, p.papel), p.funcao].filter(Boolean).join(', ')}`).join('; ')),
        linha('Domínio da operação', v.dominio ? `${rotulo(DOMINIOS, v.dominio)}${v.prova_operador ? ' · ' + v.prova_operador : ''}` : ''))),
      provaIniciada(v) ? h('ul', { class: 'prova-lista' }, TAREFAS_PROVA.filter((t) => v[t.k]).map((t) =>
        h('li', { class: 'r-' + v[t.k] }, h('span', {}, t.t), h('strong', {}, rotulo(RESULTADOS_PROVA, v[t.k]))))) : null,
      ocorr.length ? h('h3', {}, 'Ocorrências') : null, ...ocorr,
      v.midiasVisita.length ? [h('h3', {}, 'Fotos e vídeos da visita'), await galeria(v.midiasVisita)] : null,
      v.treinamentos.map((t) => h('p', { style: 'margin:10px 0 0' }, h('strong', {}, `Treinamento: ${t.assunto || 'sem assunto'}`),
        t.duracao_min ? ` · ${t.duracao_min} min` : '', t.participantes.length ? ` · ${t.participantes.map((p) => p.nome).join(', ')}` : ''))));
  }

  montar(el,
    h('header', { class: 'cab-tela' }, h('a', { class: 'voltar', href: '#/relatorios' }, '‹ Relatórios'),
      h('div', { style: 'display:flex;gap:14px;align-items:center' }, placa(id, true),
        h('div', {}, h('h1', { style: 'font-size:20px' }, 'Relatório do equipamento'), h('p', {}, `${munckCurto(e)} · ${e.cidade}`)))),
    h('section', { class: 'bloco' },
      h('table', { class: 'tabela-dados' }, h('tbody', {},
        linha('Modelo', e.marca_modelo || e.des_mod_veic), linha('Chassi', e.cod_chassi),
        linha('Nº de série do Munck', e.serie_munck || 'Não registrado'), linha('Status na última visita', rotulo(STATUS, r.status) || 'Não visitado'),
        linha('KM', num(r.km)), linha('Horímetro', num(r.horimetro, ' h')), linha('Lotação', e.lotacao), linha('Centro de custo', e.centro_custo))),
      h('div', { style: 'height:12px' }), botaoPdf),
    h('div', { class: 'indicadores' },
      h('div', { class: 'indicador' }, h('strong', {}, r.visitas.filter((v) => verdadeiro(v.concluida)).length), h('span', {}, 'visitas')),
      h('div', { class: 'indicador' }, h('strong', {}, r.ocorrencias.length), h('span', {}, 'ocorrências')),
      h('div', { class: 'indicador' }, h('strong', {}, r.garantiasAbertas.length), h('span', {}, 'garantias em aberto')),
      h('div', { class: 'indicador' }, h('strong', {}, `${r.totalFotos}/${r.totalVideos}`), h('span', {}, 'fotos / vídeos'))),
    visitas.length ? visitas : h('p', { class: 'nada bloco' }, 'Nenhuma visita registrada ainda.'),
    r.alteracoes.length ? h('section', { class: 'bloco' }, h('h2', {}, 'Correções no cadastro'),
      h('table', { class: 'tabela-dados' }, h('tbody', {}, r.alteracoes.map((a) =>
        h('tr', {}, h('th', {}, a.campo), h('td', {}, `${a.valor_original === '' ? '(vazio)' : a.valor_original} → ${a.valor_novo}`)))))) : null);
}
