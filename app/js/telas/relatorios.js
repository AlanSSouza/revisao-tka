// Relatório geral: indicadores, gráficos, garantias em aberto e situação por placa. Exporta PDF.
import * as db from '../db.js';
import { STATUS, SITUACOES, hojeLocal, formatarNumero } from '../modelo.js';
import { resumoGeral } from '../relatorio.js';
import { CORES, barras, rosca, colunasProgresso } from '../graficos.js';
import { app, montar, h, chips, toast, modal, placa, dataBR } from '../ui.js';
import { rotulo } from './comum.js';

const TABELAS = ['Equipamentos', 'Visitas', 'Ocorrencias', 'Equipe', 'Treinamentos', 'TreinamentoParticipantes', 'Midias', 'Alteracoes'];

export async function carregarDados() {
  const listas = await Promise.all(TABELAS.map((t) => db.todos(t)));
  return Object.fromEntries(TABELAS.map((t, i) => [t, listas[i]]));
}

// Mantém só as máquinas da cidade (e os registros ligados a elas).
function filtrarCidade(d, cidade) {
  if (!cidade) return d;
  const placas = new Set(d.Equipamentos.filter((e) => e.cidade === cidade).map((e) => e.id));
  const visitas = new Set(d.Visitas.filter((v) => placas.has(v.placa)).map((v) => v.id));
  const trein = new Set(d.Treinamentos.filter((t) => visitas.has(t.visita_id)).map((t) => t.id));
  return {
    ...d,
    Equipamentos: d.Equipamentos.filter((e) => placas.has(e.id)),
    Visitas: d.Visitas.filter((v) => placas.has(v.placa)),
    Ocorrencias: d.Ocorrencias.filter((o) => placas.has(o.placa)),
    Equipe: d.Equipe.filter((e) => visitas.has(e.visita_id)),
    Treinamentos: d.Treinamentos.filter((t) => visitas.has(t.visita_id)),
    TreinamentoParticipantes: d.TreinamentoParticipantes.filter((p) => trein.has(p.treinamento_id)),
  };
}

// Gera o PDF e oferece salvar/compartilhar (o toque no botão é exigido pelo iPhone para compartilhar).
export async function exportarPdf(botao, gerar, nome) {
  const texto = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Gerando PDF…';
  try {
    const blob = await gerar();
    const arquivo = new File([blob], nome, { type: 'application/pdf' });
    const podeCompartilhar = navigator.canShare?.({ files: [arquivo] });
    const baixar = () => {
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: nome });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    };
    await modal('PDF pronto', h('p', {}, `${nome} · ${Math.max(1, Math.round(blob.size / 1024))} KB`), [
      { t: 'Fechar', classe: 'claro' },
      { t: 'Baixar PDF', classe: podeCompartilhar ? 'claro' : '', valor: baixar },
      podeCompartilhar ? { t: 'Salvar ou enviar', valor: () => navigator.share({ files: [arquivo], title: nome }).catch(() => {}) } : null,
    ].filter(Boolean));
  } catch (e) {
    console.error(e);
    toast('Não foi possível gerar o PDF: ' + (e.message || e), 'erro', { ms: 6000 });
  } finally {
    botao.disabled = false;
    botao.textContent = texto;
  }
}

export const grafico = (svg) => h('div', { class: 'grafico', html: svg });

const coresStatus = { normal: CORES.verde, restricao: CORES.ambar, parado: CORES.vermelho, nao_visitada: CORES.cinza };
const coresGravidade = { leve: CORES.verde, moderada: CORES.ambar, critica: CORES.vermelho };

let filtroCidade = '';

export async function render(el) {
  const dados = await carregarDados();
  const cidades = [...new Set(dados.Equipamentos.map((e) => e.cidade).filter(Boolean))].sort();
  if (filtroCidade && !cidades.includes(filtroCidade)) filtroCidade = '';
  const r = resumoGeral(filtrarCidade(dados, filtroCidade), hojeLocal());
  const ultimo = await db.meta('ultimo_pull');

  const botaoPdf = h('button', { type: 'button', class: 'btn bloco-largo' }, 'Exportar PDF');
  botaoPdf.addEventListener('click', async () => {
    const { pdfGeral } = await import('../pdf.js');
    exportarPdf(botaoPdf, () => pdfGeral(r, { autor: app.sessao.autor, filtro: filtroCidade }),
      `Relatorio-geral-TKA-${hojeLocal()}${filtroCidade ? '-' + filtroCidade.replace(/\W+/g, '') : ''}.pdf`);
  });

  const indicador = (valor, legenda) => h('div', { class: 'indicador' }, h('strong', {}, valor), h('span', {}, legenda));
  const secao = (titulo, ...conteudo) => h('section', { class: 'bloco' }, h('h2', {}, titulo), ...conteudo);

  montar(el,
    h('header', { class: 'cab-tela' }, h('h1', {}, 'Relatórios'),
      h('p', {}, ultimo ? `Dados da última sincronização, ${dataBR(ultimo, true)}.` : 'Sincronize para ver os dados mais recentes.')),
    h('section', { class: 'bloco' },
      h('div', { class: 'campo' }, h('span', {}, 'Cidade'),
        chips(cidades, filtroCidade, (c) => { filtroCidade = c; render(el); }, { permitirVazio: true })),
      botaoPdf),
    h('div', { class: 'indicadores' },
      indicador(`${r.visitadas}/${r.total}`, 'máquinas visitadas'),
      indicador(r.ocorrencias, 'ocorrências'),
      indicador(r.garantias.abertas, 'garantias em aberto'),
      indicador(r.pessoasTreinadas, 'pessoas treinadas')),
    secao('Progresso por cidade', grafico(colunasProgresso(r.porCidade))),
    secao('Status na última visita', grafico(rosca(r.status.map((s) => ({ ...s, cor: coresStatus[s.v] })), { centro: 'máquinas' }))),
    secao('Ocorrências por tipo', grafico(barras(r.porTipo))),
    secao('Ocorrências por componente', grafico(barras(r.porComponente, { cor: CORES.laranja1 }))),
    secao('Gravidade', grafico(rosca(r.porGravidade.map((g) => ({ ...g, cor: coresGravidade[g.v] })), { centro: 'ocorrências' }))),
    secao(`Garantias em aberto (${r.garantias.abertas})`,
      r.garantias.lista.length
        ? h('ul', { class: 'lista' }, r.garantias.lista.map((g) => h('li', {}, h('a', { class: 'item', href: `#/ocorrencia/${g.id}` },
          placa(g.placa),
          h('div', { class: 'info' },
            h('div', { class: 'titulo' }, [g.tipo, g.componente].filter(Boolean).join(' · ') || 'Ocorrência'),
            h('div', { class: 'sub' }, [rotulo(SITUACOES, g.situacao), g.protocolo ? `protocolo ${g.protocolo}` : '', g.dias != null ? `${g.dias} dia(s) em aberto` : ''].filter(Boolean).join(' · ')))))))
        : h('p', { class: 'nada' }, 'Nenhuma garantia em aberto.')),
    secao('Treinamentos', h('p', { style: 'margin:0' },
      `${r.treinamentos} treinamento(s) no local, ${r.pessoasTreinadas} pessoa(s) treinada(s). ${r.pessoasEquipe} pessoa(s) registradas nas equipes.`)),
    secao('Relatório por placa',
      h('ul', { class: 'lista' }, r.linhas.map((l) => h('li', {}, h('a', { class: 'item' + (l.ultimaVisita ? ' feito' : ''), href: `#/relatorio/${encodeURIComponent(l.placa)}` },
        placa(l.placa),
        h('div', { class: 'info' },
          h('div', { class: 'titulo' }, l.ultimaVisita ? [h('span', { class: 'ponto ' + l.status }), ` ${rotulo(STATUS, l.status) || 'Visitada'} · ${dataBR(l.ultimaVisita)}`] : 'Ainda não visitada'),
          h('div', { class: 'sub' }, [l.cidade, l.km != null ? `KM ${formatarNumero(l.km)}` : '', l.ocorrencias ? `${l.ocorrencias} ocorrência(s)` : '',
            l.abertas ? `${l.abertas} em aberto` : ''].filter(Boolean).join(' · ')))))))));
}
