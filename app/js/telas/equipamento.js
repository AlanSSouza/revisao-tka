// Ficha do equipamento: resumo, histórico de visitas, ocorrências, mídias e dados cadastrais editáveis.
import * as db from '../db.js';
import { STATUS, GRAVIDADES, SITUACOES, alteracoesCadastro, formatarNumero, parseNumeroBR, verdadeiro } from '../modelo.js';
import { app, montar, h, toast, placa, dataBR } from '../ui.js';
import { ativos, galeria, rotulo, iniciarVisita, linkMapa, munckCurto } from './comum.js';

const CAMPOS = [
  ['cidade', 'Cidade'], ['lotacao', 'Lotação'], ['estado', 'Estado'], ['centro_custo', 'Centro de custo'],
  ['setor_veiculo', 'Setor'], ['status_veiculo', 'Equipamento (Munck)'], ['serie_munck', 'Nº de série do Munck'],
  ['km_atual', 'KM (base)'], ['local_previsto', 'Local previsto'], ['marca_modelo', 'Marca/modelo'],
  ['des_mod_veic', 'Modelo'], ['tipo_veiculo', 'Tipo'], ['porte_veiculo', 'Porte'], ['ano_fabricacao', 'Ano de fabricação'],
  ['ano_modelo', 'Ano do modelo'], ['des_cor', 'Cor'], ['cod_renavam', 'Renavam'], ['cod_chassi', 'Chassi'],
];
const NUMERICOS = ['km_atual', 'ano_fabricacao', 'ano_modelo'];

export async function render(el, { placa: id }) {
  const eq = await db.get('Equipamentos', id);
  if (!eq) {
    montar(el, h('div', { class: 'vazio' }, h('strong', {}, 'Equipamento não encontrado'), h('a', { class: 'btn', href: '#/parque' }, 'Ver parque')));
    return;
  }
  const edita = app.podeEditar();
  const [visitasT, ocorrT, midiasT, alteracoes] = await Promise.all([
    db.por('Visitas', 'placa', id), db.por('Ocorrencias', 'placa', id), db.por('Midias', 'placa', id), db.por('Alteracoes', 'placa', id)]);
  const visitas = ativos(visitasT).sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)));
  const ocorrencias = ativos(ocorrT);
  const midias = ativos(midiasT).filter((m) => m.tipo !== 'assinatura');
  const aberta = visitas.find((v) => !verdadeiro(v.concluida));

  const originais = {};
  for (const a of [...alteracoes].sort((x, y) => String(x.atualizado_em).localeCompare(String(y.atualizado_em)))) {
    if (!(a.campo in originais)) originais[a.campo] = a.valor_original;
  }

  const kmAtual = eq.km_atual_campo ?? eq.km_atual;
  const mapa = linkMapa(eq.local_previsto);
  const resumo = h('section', { class: 'bloco' },
    h('table', { class: 'tabela-dados' }, h('tbody', {},
      h('tr', {}, h('th', {}, 'Nº de série do Munck'), h('td', {}, eq.serie_munck || 'Não registrado')),
      h('tr', {}, h('th', {}, 'KM'), h('td', {}, kmAtual != null && kmAtual !== '' ? formatarNumero(kmAtual) : '—')),
      h('tr', {}, h('th', {}, 'Horímetro'), h('td', {}, eq.horimetro_atual !== '' && eq.horimetro_atual != null ? formatarNumero(eq.horimetro_atual) + ' h' : '—')),
      h('tr', {}, h('th', {}, 'Lotação'), h('td', {}, eq.lotacao || '')),
      eq.local_previsto ? h('tr', {}, h('th', {}, 'Local'), h('td', {}, mapa ? h('a', { href: mapa, target: '_blank', rel: 'noopener' }, 'Abrir no mapa') : eq.local_previsto)) : null)),
    edita ? h('button', { type: 'button', class: 'btn bloco-largo', style: 'margin-top:12px', onclick: () => iniciarVisita(id) }, aberta ? 'Continuar visita' : 'Iniciar visita') : null);

  const historico = h('section', { class: 'bloco' }, h('h2', {}, 'Visitas ', h('span', { class: 'contagem' }, `(${visitas.length})`)),
    visitas.length ? h('ul', { class: 'lista' }, visitas.map((v) => h('li', {}, h('a', { class: 'item' + (verdadeiro(v.concluida) ? ' feito' : ' atual'), href: `#/visita/${v.id}` },
      h('span', { class: 'ponto ' + (v.status || '') }),
      h('div', { class: 'info' },
        h('div', { class: 'titulo' }, `${dataBR(v.inicio, true)} · ${rotulo(STATUS, v.status) || 'sem status'}${verdadeiro(v.concluida) ? '' : ' · em andamento'}`),
        h('div', { class: 'sub' }, [v.autor, v.km != null && v.km !== '' ? `KM ${formatarNumero(v.km)}` : '', v.horimetro != null && v.horimetro !== '' ? `${formatarNumero(v.horimetro)} h` : ''].filter(Boolean).join(' · '))))))) :
      h('p', { style: 'color:var(--tinta-suave);margin:0' }, 'Nenhuma visita registrada ainda.'));

  const blocoOcorr = h('section', { class: 'bloco' }, h('h2', {}, 'Ocorrências ', h('span', { class: 'contagem' }, `(${ocorrencias.length})`)),
    ocorrencias.length ? ocorrencias.map((o) => h('a', { class: 'ocorrencia', href: `#/ocorrencia/${o.id}` },
      o.gravidade ? h('span', { class: 'gravidade ' + o.gravidade }, rotulo(GRAVIDADES, o.gravidade)) : null, ' ',
      h('strong', {}, o.tipo || 'Sem tipo'), o.componente ? ` · ${o.componente}` : '',
      h('div', { style: 'font-size:14px;color:var(--tinta-suave)' }, [rotulo(SITUACOES, o.situacao) || 'Situação não informada', o.protocolo ? `protocolo ${o.protocolo}` : '', o.abertura ? `aberta ${dataBR(o.abertura)}` : ''].filter(Boolean).join(' · ')))) :
      h('p', { style: 'color:var(--tinta-suave);margin:0' }, 'Nenhum defeito registrado.'));

  const blocoMidia = h('section', { class: 'bloco' }, h('h2', {}, 'Fotos e vídeos ', h('span', { class: 'contagem' }, `(${midias.length})`)), await galeria(midias));

  // Dados cadastrais: leitura ou edição.
  const blocoDados = h('details', { class: 'secao' });
  const desenharLeitura = () => {
    montar(blocoDados, h('summary', {}, 'Dados cadastrais'),
      h('div', { class: 'conteudo' },
        h('table', { class: 'tabela-dados' }, h('tbody', {}, CAMPOS.map(([c, t]) => h('tr', {}, h('th', {}, t),
          h('td', {}, c === 'km_atual' ? formatarNumero(eq[c]) : String(eq[c] ?? ''),
            c in originais && String(originais[c]) !== String(eq[c] ?? '') ? h('span', { class: 'original' }, `Original da planilha: ${originais[c] === '' ? '(vazio)' : originais[c]}`) : null))))),
        edita ? h('button', { type: 'button', class: 'btn claro bloco-largo', style: 'margin-top:12px', onclick: desenharEdicao }, 'Corrigir dados') : null));
  };
  const desenharEdicao = () => {
    const entradas = {};
    const linhas = CAMPOS.map(([c, t]) => {
      entradas[c] = h('input', { type: 'text', value: c === 'km_atual' ? formatarNumero(eq[c]) : String(eq[c] ?? ''), inputmode: NUMERICOS.includes(c) ? 'decimal' : null });
      return h('label', { class: 'campo' }, h('span', {}, t), entradas[c]);
    });
    montar(blocoDados, h('summary', {}, 'Corrigir dados cadastrais'),
      h('div', { class: 'conteudo' }, ...linhas,
        h('div', { class: 'acoes' },
          h('button', { type: 'button', class: 'btn claro', onclick: desenharLeitura }, 'Cancelar'),
          h('button', { type: 'button', class: 'btn', onclick: async () => {
            const editado = { ...eq };
            for (const [c] of CAMPOS) {
              const v = entradas[c].value.trim();
              editado[c] = NUMERICOS.includes(c) ? parseNumeroBR(v) : v;
            }
            const alt = alteracoesCadastro(eq, editado, app.sessao.autor);
            if (!alt.length) { desenharLeitura(); return; }
            for (const a of alt) await db.salvar('Alteracoes', a, { autor: app.sessao.autor });
            await db.salvar('Equipamentos', editado, { autor: app.sessao.autor });
            toast(`${alt.length} campo(s) corrigido(s).`, 'ok');
            render(el, { placa: id });
          } }, 'Salvar correções'))));
    blocoDados.open = true;
  };
  desenharLeitura();

  montar(el, 
    h('header', { class: 'cab-tela' }, h('a', { class: 'voltar', href: '#/parque' }, '‹ Parque'),
      h('div', { style: 'display:flex;gap:14px;align-items:center' }, placa(id, true),
        h('div', {}, h('h1', { style: 'font-size:20px' }, eq.marca_modelo || ''), h('p', {}, `${munckCurto(eq)} · ${eq.cidade}`)))),
    resumo, historico, blocoOcorr, blocoMidia, blocoDados);
}
