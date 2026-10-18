// PDF dos relatórios (A4) com jsPDF, gerado no próprio aparelho: logo Mariuá no topo, selo GPTW no rodapé.
import * as db from './db.js';
import {
  STATUS, GRAVIDADES, SITUACOES, PAPEIS, CAUSAS, CONSTATACOES, PARECERES, DOMINIOS, TAREFAS_PROVA, RESULTADOS_PROVA,
  formatarNumero, verdadeiro, provaIniciada, linkCoordenadas,
} from './modelo.js';
import { gruposCausa, coresConstatacao, coresDominio, pct } from './telas/relatorios.js';
import { CORES, barras, rosca, colunasProgresso } from './graficos.js';
import { urlDrive } from './midia.js';

const M = 14;            // margem (mm)
const LARG = 210 - 2 * M;
const TOPO = 26;          // início do conteúdo abaixo do cabeçalho
const BASE = 297 - 22;    // limite inferior antes do rodapé

const rotulo = (lista, v) => lista.find((o) => o.v === v)?.t || v || '';
// Fontes padrão do PDF só cobrem Latin-1: troca travessões, reticências e aspas curvas.
const limpo = (s) => String(s ?? '').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  .replace(/[^\x00-\xFF]/g, '');
const dataHora = (iso, hora = true) => {
  if (!iso) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T12:00:00') : new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleString('pt-BR', hora ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const num = (v, suf = '') => (v === null || v === undefined || v === '' ? '-' : formatarNumero(v) + suf);

let carregando = null;
function carregarJsPDF() {
  if (globalThis.jspdf) return Promise.resolve(globalThis.jspdf);
  carregando ||= new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = 'vendor/jspdf.umd.min.js';
    s.onload = () => ok(globalThis.jspdf);
    s.onerror = () => { carregando = null; erro(new Error('Não foi possível carregar o gerador de PDF.')); };
    document.head.append(s);
  });
  return carregando;
}

function carregarUmaVez(src) {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => ok(img);
    img.onerror = () => erro(new Error('imagem'));
    img.src = src;
  });
}

// O Google às vezes recusa muitas miniaturas seguidas (429): tenta de novo com espera.
async function carregarImagem(src, tentativas = 3) {
  for (let i = 0; ; i++) {
    try { return await carregarUmaVez(src); } catch (e) {
      if (i + 1 >= tentativas || !/^https?:/.test(src)) throw e;
      await new Promise((ok) => setTimeout(ok, 1500 * (i + 1)));
    }
  }
}

// Desenha a imagem num canvas (reduzida) e devolve {data, w, h} pronto para o PDF.
async function paraJpeg(src, maxLado = 1000, tipo = 'image/jpeg') {
  const img = await carregarImagem(src);
  const f = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * f);
  c.height = Math.round(img.naturalHeight * f);
  const g = c.getContext('2d');
  if (tipo === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
  g.drawImage(img, 0, 0, c.width, c.height);
  return { data: c.toDataURL(tipo, 0.82), w: c.width, h: c.height };
}

// Gráfico SVG rasterizado em 3x para ficar nítido no papel.
async function svgParaPng(svg) {
  try {
    const img = await carregarImagem('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    const c = document.createElement('canvas');
    c.width = img.naturalWidth * 3;
    c.height = img.naturalHeight * 3;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/png'), w: c.width, h: c.height };
  } catch {
    return null;
  }
}

async function fotoDaMidia(m) {
  if (m.drive_id) return paraJpeg(urlDrive(m.drive_id), 900).catch(() => null);
  const b = await db.blob(m.id);
  if (!b || m.tipo === 'video') return null;
  const url = URL.createObjectURL(b.blob);
  try { return await paraJpeg(url, 900); } catch { return null; } finally { URL.revokeObjectURL(url); }
}

class Folha {
  constructor(jsPDF, titulo, marca) {
    this.doc = new jsPDF({ unit: 'mm', format: 'a4' });
    this.titulo = titulo;
    this.marca = marca;
    this.y = TOPO;
    this.cabecalho();
  }

  cabecalho() {
    const { doc, marca } = this;
    if (marca.logo) doc.addImage(marca.logo.data, 'PNG', M, 9, 40, 40 * marca.logo.h / marca.logo.w, 'logo');
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(CORES.suave);
    doc.text(limpo(this.titulo), 210 - M, 14, { align: 'right' });
    doc.setDrawColor(CORES.petroleo).setLineWidth(0.6).line(M, 20, 210 - M, 20);
  }

  novaPagina() {
    this.doc.addPage();
    this.y = TOPO;
    this.cabecalho();
  }

  garantir(alt) { if (this.y + alt > BASE) this.novaPagina(); }

  titulo1(t, sub) {
    const { doc } = this;
    this.garantir(16);
    doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(CORES.tinta).text(limpo(t), M, this.y + 6);
    this.y += 9;
    if (sub) { doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(CORES.suave).text(limpo(sub), M, this.y + 3); this.y += 6; }
    this.y += 3;
  }

  // reserva: espaço mínimo do conteúdo que vem logo abaixo, para o título não ficar sozinho no fim da página.
  titulo2(t, reserva = 30) {
    const { doc } = this;
    this.garantir(14 + reserva);
    this.y += 3;
    doc.setFont('helvetica', 'bold').setFontSize(12.5).setTextColor(CORES.fundo).text(limpo(t), M, this.y + 4);
    doc.setDrawColor(CORES.linha).setLineWidth(0.3).line(M, this.y + 6.5, 210 - M, this.y + 6.5);
    this.y += 10;
  }

  paragrafo(t, { tam = 10, cor = CORES.tinta, negrito = false, x = M, largura = LARG } = {}) {
    if (!t) return;
    const { doc } = this;
    doc.setFont('helvetica', negrito ? 'bold' : 'normal').setFontSize(tam).setTextColor(cor);
    const linhas = doc.splitTextToSize(limpo(t), largura);
    const lh = tam * 0.42;
    for (const l of linhas) {
      this.garantir(lh + 1);
      doc.text(l, x, this.y + lh * 0.8);
      this.y += lh;
    }
    this.y += 1.5;
  }

  // Pares rótulo/valor em duas colunas.
  campos(pares) {
    const { doc } = this;
    const lista = pares.filter(([, v]) => v !== null && v !== undefined && v !== '');
    const col = LARG / 2;
    for (let i = 0; i < lista.length; i += 2) {
      this.garantir(10);
      lista.slice(i, i + 2).forEach(([r, v, url], j) => {
        const x = M + j * col;
        const texto = doc.splitTextToSize(limpo(v), col - 4)[0] || '';
        doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(CORES.suave).text(limpo(r), x, this.y + 3);
        doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(url ? CORES.petroleo : CORES.tinta);
        if (url) doc.textWithLink(texto, x, this.y + 7.5, { url });
        else doc.text(texto, x, this.y + 7.5);
      });
      this.y += 10;
    }
    this.y += 1;
  }

  indicadores(itens) {
    const { doc } = this;
    this.garantir(22);
    const w = (LARG - (itens.length - 1) * 3) / itens.length;
    itens.forEach(([valor, legenda], i) => {
      const x = M + i * (w + 3);
      doc.setFillColor(CORES.nevoa).roundedRect(x, this.y, w, 19, 2, 2, 'F');
      doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(CORES.fundo).text(limpo(valor), x + 4, this.y + 9);
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(CORES.suave).text(doc.splitTextToSize(limpo(legenda), w - 8), x + 4, this.y + 14);
    });
    this.y += 23;
  }

  async grafico(svg, { x = M, largura = LARG, avancar = true } = {}) {
    const img = await svgParaPng(svg);
    const m = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg);
    const alt = m ? largura * Number(m[2]) / Number(m[1]) : 30;
    this.garantir(alt + 2);
    if (img) this.doc.addImage(img.data, 'PNG', x, this.y, largura, alt, undefined, 'FAST');
    if (avancar) this.y += alt + 4;
    return alt;
  }

  // Dois gráficos lado a lado, cada um com título curto.
  async par(a, b) {
    const w = (LARG - 8) / 2;
    const alturas = [a, b].map(([, svg]) => {
      const m = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg);
      return w * Number(m[2]) / Number(m[1]);
    });
    this.garantir(Math.max(...alturas) + 10);
    const y0 = this.y;
    for (const [i, [t, svg]] of [a, b].entries()) {
      this.y = y0;
      const x = M + i * (w + 8);
      this.doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(CORES.fundo).text(limpo(t), x, this.y + 3);
      this.y += 6;
      await this.grafico(svg, { x, largura: w, avancar: false });
    }
    this.y = y0 + 6 + Math.max(...alturas) + 5;
  }

  tabela(colunas, linhas, { tam = 8.5 } = {}) {
    const { doc } = this;
    const total = colunas.reduce((s, c) => s + c.w, 0);
    const ws = colunas.map((c) => (c.w / total) * LARG);
    const cab = () => {
      doc.setFillColor(CORES.fundo).rect(M, this.y, LARG, 7, 'F');
      doc.setFont('helvetica', 'bold').setFontSize(tam).setTextColor('#FFFFFF');
      let x = M;
      colunas.forEach((c, i) => { doc.text(limpo(c.t), c.dir ? x + ws[i] - 2 : x + 2, this.y + 4.8, { align: c.dir ? 'right' : 'left' }); x += ws[i]; });
      this.y += 7;
    };
    this.garantir(14);
    cab();
    linhas.forEach((l, n) => {
      doc.setFont('helvetica', 'normal').setFontSize(tam);
      const celulas = l.map((v, i) => doc.splitTextToSize(limpo(v), ws[i] - 4));
      const alt = Math.max(...celulas.map((c) => c.length)) * tam * 0.42 + 3;
      if (this.y + alt > BASE) { this.novaPagina(); cab(); }
      if (n % 2) doc.setFillColor(CORES.nevoa).rect(M, this.y, LARG, alt, 'F');
      doc.setTextColor(CORES.tinta);
      let x = M;
      celulas.forEach((c, i) => {
        doc.text(c, colunas[i].dir ? x + ws[i] - 2 : x + 2, this.y + tam * 0.42 + 0.6, { align: colunas[i].dir ? 'right' : 'left' });
        x += ws[i];
      });
      this.y += alt;
    });
    this.y += 4;
  }

  async fotos(midias) {
    const { doc } = this;
    const fotos = [];
    const videos = [];
    for (const m of midias) {
      const img = await fotoDaMidia(m);
      if (img) fotos.push({ m, img }); else if (m.tipo === 'video' || m.link) videos.push(m);
    }
    const w = (LARG - 8) / 3;
    for (let i = 0; i < fotos.length; i += 3) {
      const linha = fotos.slice(i, i + 3);
      const alt = Math.min(w * 1.34, Math.max(...linha.map(({ img }) => w * img.h / img.w)));
      this.garantir(alt + 4);
      linha.forEach(({ m, img }, j) => {
        const x = M + j * (w + 4);
        const h = Math.min(alt, w * img.h / img.w);
        const lw = h * img.w / img.h;
        doc.addImage(img.data, 'JPEG', x + (w - lw) / 2, this.y, lw, h);
        if (m.link) doc.link(x, this.y, w, h, { url: m.link });
        if (m.tipo === 'video') {
          doc.setFillColor(CORES.tinta).roundedRect(x + 2, this.y + 2, 13, 5, 1, 1, 'F');
          doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor('#FFFFFF').text('VIDEO', x + 3.5, this.y + 5.5);
        }
      });
      this.y += alt + 4;
    }
    for (const m of videos) {
      this.garantir(6);
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(CORES.petroleo);
      if (m.link) doc.textWithLink(limpo(`${m.tipo === 'video' ? 'Vídeo' : 'Arquivo'}: ${m.nome_arquivo || ''} (abrir)`), M, this.y + 3.5, { url: m.link });
      else doc.setTextColor(CORES.suave).text(limpo(`${m.nome_arquivo || 'Arquivo'}: ainda não enviado ao Drive`), M, this.y + 3.5);
      this.y += 5.5;
    }
  }

  rodapes(autor) {
    const { doc, marca } = this;
    const n = doc.getNumberOfPages();
    const gerado = `Gerado em ${dataHora(new Date().toISOString())}${autor ? ' por ' + autor : ''}`;
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setDrawColor(CORES.linha).setLineWidth(0.3).line(M, 297 - 17, 210 - M, 297 - 17);
      if (marca.gptw) doc.addImage(marca.gptw.data, 'PNG', M, 297 - 15.5, 9 * marca.gptw.w / marca.gptw.h, 9, 'gptw');
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(CORES.suave);
      doc.text(limpo('Mariuá Construção e Energia - Frota e Manutenção'), M + 11, 297 - 11.5);
      doc.text(limpo(gerado), M + 11, 297 - 7.5);
      doc.text(`Página ${i} de ${n}`, 210 - M, 297 - 9.5, { align: 'right' });
    }
  }
}

async function preparar(titulo) {
  const { jsPDF } = await carregarJsPDF();
  const [logo, gptw] = await Promise.all([
    paraJpeg('assets/logo.png', 600, 'image/png').catch(() => null),
    paraJpeg('assets/gptw.png', 240, 'image/png').catch(() => null),
  ]);
  return new Folha(jsPDF, titulo, { logo, gptw });
}

const coresStatus = { normal: CORES.verde, restricao: CORES.ambar, parado: CORES.vermelho, nao_visitada: CORES.cinza };
const coresGravidade = { leve: CORES.verde, moderada: CORES.ambar, critica: CORES.vermelho };

export async function pdfGeral(r, { autor, filtro } = {}) {
  const f = await preparar('Revisão Guindautos TKA - Relatório geral');
  f.titulo1('Relatório geral do parque TKA', `${filtro ? 'Cidade: ' + filtro + ' - ' : ''}Situação em ${dataHora(new Date().toISOString())}`);
  f.indicadores([
    [`${r.visitadas}/${r.total}`, 'máquinas visitadas'],
    [String(r.ocorrencias), 'ocorrências registradas'],
    [`${pct(r.grupos.equipamento, r.ocorrencias)}%`, 'por defeito do equipamento'],
  ]);
  f.indicadores([
    [`${pct(r.grupos.operacao, r.ocorrencias)}%`, 'por operação ou conhecimento'],
    [`${num(Math.round(r.horasParadas.total * 10) / 10)} h`, 'paradas registradas'],
    [String(r.garantias.abertas), 'garantias em aberto'],
  ]);
  const hh = (n) => num(Math.round(n * 10) / 10);
  f.titulo2('Defeito do equipamento × operação', 60);
  await f.par(['Ocorrências por grupo de causa', rosca(gruposCausa(r), { centro: 'ocorrências' })],
    ['Causa provável', barras(r.porCausa)]);
  f.paragrafo(`Horas paradas: ${hh(r.horasParadas.equipamento)} h por defeito do equipamento, ${hh(r.horasParadas.operacao)} h por operação/conhecimento e ${hh(r.horasParadas.outras + r.horasParadas.investigar)} h por outras causas ou a investigar. ${r.horasParadas.ocorrenciasQueImpediram} ocorrência(s) impediram a operação.`);
  f.titulo2('Relato × constatação e domínio da operação', 60);
  await f.par(['Defeito relatado foi constatado?', rosca(r.porConstatacao.map((c) => ({ ...c, cor: coresConstatacao[c.v] })), { centro: 'avaliadas' })],
    ['Domínio da operação (última prova)', rosca(r.porDominio.map((d) => ({ ...d, cor: coresDominio[d.v] })), { centro: 'máquinas' })]);
  f.paragrafo(`Parecer do engenheiro TKA sobre a causa: concorda em ${r.parecer.concorda}, discorda em ${r.parecer.discorda}, sem parecer em ${r.parecer.sem}. ${r.provas} prova(s) prática(s) aplicada(s).`);
  f.titulo2('Tarefas com dificuldade na prova prática', 30);
  await f.grafico(barras(r.dificuldades, { cor: CORES.laranja2, largura: 680 }));
  f.titulo2('Progresso das visitas por cidade');
  await f.grafico(colunasProgresso(r.porCidade, { largura: 680 }));
  f.titulo2('Situação do parque e gravidade', 60);
  await f.par(
    ['Status na última visita', rosca(r.status.map((s) => ({ ...s, cor: coresStatus[s.v] })), { centro: 'máquinas' })],
    ['Gravidade das ocorrências', rosca(r.porGravidade.map((g) => ({ ...g, cor: coresGravidade[g.v] })), { centro: 'ocorrências' })]);
  f.titulo2('Ocorrências', 60);
  await f.par(['Por tipo', barras(r.porTipo)], ['Por componente', barras(r.porComponente, { cor: CORES.laranja1 })]);
  f.titulo2(`Garantias em aberto (${r.garantias.abertas})`);
  if (r.garantias.lista.length) {
    f.tabela([{ t: 'Placa', w: 18 }, { t: 'Defeito', w: 40 }, { t: 'Situação', w: 32 }, { t: 'Protocolo', w: 22 }, { t: 'Aberta em', w: 18 }, { t: 'Dias', w: 10, dir: true }],
      r.garantias.lista.map((g) => [g.placa, [g.tipo, g.componente].filter(Boolean).join(' - '), rotulo(SITUACOES, g.situacao), g.protocolo || '-', dataHora(g.abertura, false), g.dias ?? '-']));
  } else f.paragrafo('Nenhuma garantia em aberto.', { cor: CORES.suave });
  f.titulo2('Treinamentos');
  f.paragrafo(`${r.treinamentos} treinamento(s) no local, ${r.pessoasTreinadas} pessoa(s) treinada(s). ${r.pessoasEquipe} pessoa(s) registradas nas equipes.`);
  f.titulo2('Situação por equipamento');
  f.tabela([{ t: 'Placa', w: 15 }, { t: 'Cidade', w: 20 }, { t: 'Série Munck', w: 16 }, { t: 'KM', w: 12, dir: true }, { t: 'Horím.', w: 9, dir: true },
    { t: 'Última visita', w: 14 }, { t: 'Status', w: 14 }, { t: 'Domínio', w: 18 }, { t: 'Ocorr.', w: 8, dir: true }, { t: 'Abertas', w: 9, dir: true }],
  r.linhas.map((l) => [l.placa, l.cidade, l.serie || '-', num(l.km), num(l.horimetro), l.ultimaVisita ? dataHora(l.ultimaVisita, false) : 'Não visitada',
    rotulo(STATUS, l.status) || '-', rotulo(DOMINIOS, l.dominio) || '-', l.ocorrencias, l.abertas]), { tam: 7.5 });
  f.rodapes(autor);
  return f.doc.output('blob');
}

export async function pdfPlaca(r, { autor } = {}) {
  const e = r.eq;
  const f = await preparar(`Revisão Guindautos TKA - ${e.id}`);
  f.titulo1(`Relatório do equipamento ${e.id}`, [e.marca_modelo || e.des_mod_veic, e.status_veiculo, e.cidade].filter(Boolean).join(' - '));
  f.campos([
    ['Nº de série do Munck', e.serie_munck || 'Não registrado'], ['Status na última visita', rotulo(STATUS, r.status) || 'Não visitado'],
    ['KM', num(r.km)], ['Horímetro', num(r.horimetro, ' h')],
    ['Cidade', e.cidade], ['Lotação', e.lotacao], ['Centro de custo', e.centro_custo], ['Chassi', e.cod_chassi],
    ['Renavam', e.cod_renavam], ['Ano fabricação/modelo', [e.ano_fabricacao, e.ano_modelo].filter(Boolean).join('/')],
  ]);
  f.indicadores([
    [String(r.visitas.filter((v) => verdadeiro(v.concluida)).length), 'visitas concluídas'],
    [String(r.ocorrencias.length), 'ocorrências'],
    [String(r.garantiasAbertas.length), 'garantias em aberto'],
    [`${num(r.horasParadas)} h`, 'paradas registradas'],
  ]);
  if (r.garantiasAbertas.length) {
    f.titulo2('Garantias em aberto');
    f.tabela([{ t: 'Defeito', w: 40 }, { t: 'Situação', w: 30 }, { t: 'Protocolo', w: 20 }, { t: 'Aberta em', w: 18 }, { t: 'Dias', w: 10, dir: true }],
      r.garantiasAbertas.map((o) => [[o.tipo, o.componente].filter(Boolean).join(' - '), rotulo(SITUACOES, o.situacao), o.protocolo || '-', dataHora(o.abertura, false), o.dias ?? '-']));
  }
  for (const v of r.visitas) {
    f.titulo2(`Visita de ${dataHora(v.inicio)}${verdadeiro(v.concluida) ? '' : ' (em andamento)'}`);
    f.campos([
      ['Registrada por', v.autor], ['Engenheiro TKA', v.engenheiro], ['Status', rotulo(STATUS, v.status)],
      ['KM / horímetro', `${num(v.km)} / ${num(v.horimetro, ' h')}`], ['Nº de série informado', v.serie_munck],
      ['Local da visita (abrir no mapa)', linkCoordenadas(v.lat, v.lng) ? `${Number(v.lat).toFixed(5)}, ${Number(v.lng).toFixed(5)}${v.precisao ? ` (±${v.precisao} m)` : ''}` : '', linkCoordenadas(v.lat, v.lng)],
      ['Domínio da operação', v.dominio ? rotulo(DOMINIOS, v.dominio) : ''], ['Operador avaliado', v.prova_operador],
    ]);
    if (provaIniciada(v)) {
      f.paragrafo('Prova prática: ' + TAREFAS_PROVA.filter((t) => v[t.k]).map((t) => `${t.t}: ${rotulo(RESULTADOS_PROVA, v[t.k])}`).join('; '), { tam: 9.5 });
    }
    if (v.observacoes) f.paragrafo('Observações: ' + v.observacoes);
    if (v.equipe.length) f.paragrafo('Equipe: ' + v.equipe.map((p) => `${p.nome}${p.matricula ? ' (' + p.matricula + ')' : ''} - ${[rotulo(PAPEIS, p.papel), p.funcao].filter(Boolean).join(', ')}`).join('; '), { tam: 9.5 });
    for (const o of v.ocorrencias) {
      f.garantir(20);
      f.y += 1;
      f.doc.setFillColor(coresGravidade[o.gravidade] || CORES.cinza).rect(M, f.y, 1.4, 6, 'F');
      f.paragrafo(`${o.tipo || 'Ocorrência'}${o.componente ? ' - ' + o.componente : ''}${o.gravidade ? ' (' + rotulo(GRAVIDADES, o.gravidade) + ')' : ''}`, { negrito: true, tam: 10.5, x: M + 3.5 });
      if (o.relato) f.paragrafo('Relato: ' + o.relato, { x: M + 3.5, largura: LARG - 3.5 });
      if (o.descricao) f.paragrafo('Constatado na visita: ' + o.descricao, { x: M + 3.5, largura: LARG - 3.5 });
      f.paragrafo([o.constatacao ? `Constatação: ${rotulo(CONSTATACOES, o.constatacao)}` : '', `Causa provável: ${rotulo(CAUSAS, o.causa || 'investigar')}`,
        o.parecer_tka ? `Engenheiro TKA ${rotulo(PARECERES, o.parecer_tka).toLowerCase()}` : 'Sem parecer da TKA',
        o.impediu_operacao !== '' && o.impediu_operacao != null ? (verdadeiro(o.impediu_operacao) ? 'Impediu a operação' : 'Não impediu a operação') : '',
        Number(o.horas_paradas) ? `${num(o.horas_paradas)} h parado` : ''].filter(Boolean).join(' | '),
      { tam: 9.5, negrito: true, cor: CORES.fundo, x: M + 3.5, largura: LARG - 3.5 });
      f.paragrafo([`Situação: ${rotulo(SITUACOES, o.situacao) || 'não informada'}`, o.protocolo ? `Protocolo: ${o.protocolo}` : '',
        o.abertura ? `Aberta em ${dataHora(o.abertura, false)}` : '', o.previsao ? `Previsão ${dataHora(o.previsao, false)}` : '',
        o.resolvido_em ? `Resolvida em ${dataHora(o.resolvido_em, false)}${o.resolvido_por ? ' por ' + o.resolvido_por : ''}` : ''].filter(Boolean).join(' | '),
      { tam: 9, cor: CORES.suave, x: M + 3.5, largura: LARG - 3.5 });
      if (o.solucao) f.paragrafo('Solução: ' + o.solucao, { tam: 9.5, x: M + 3.5, largura: LARG - 3.5 });
      if (o.midias.length) await f.fotos(o.midias);
    }
    if (v.midiasVisita.length) {
      f.paragrafo('Fotos e vídeos da visita', { negrito: true, tam: 10 });
      await f.fotos(v.midiasVisita);
    }
    for (const t of v.treinamentos) {
      f.paragrafo(`Treinamento: ${t.assunto || 'sem assunto'}${t.duracao_min ? ' (' + t.duracao_min + ' min)' : ''}${t.ministrante ? ' - ministrado por ' + t.ministrante : ''}`, { negrito: true, tam: 10 });
      if (t.participantes.length) f.paragrafo('Participantes: ' + t.participantes.map((p) => `${p.nome}${p.matricula ? ' (' + p.matricula + ')' : ''}${p.funcao ? ' - ' + p.funcao : ''}${p.assinatura_midia_id ? ', assinado' : ''}`).join('; '), { tam: 9.5 });
    }
  }
  if (!r.visitas.length) f.paragrafo('Nenhuma visita registrada ainda.', { cor: CORES.suave });
  if (r.alteracoes.length) {
    f.titulo2('Correções no cadastro');
    f.tabela([{ t: 'Campo', w: 25 }, { t: 'Valor original', w: 30 }, { t: 'Valor novo', w: 30 }, { t: 'Por', w: 20 }],
      r.alteracoes.map((a) => [a.campo, a.valor_original === '' ? '(vazio)' : a.valor_original, a.valor_novo, a.atualizado_por || '']));
  }
  f.rodapes(autor);
  return f.doc.output('blob');
}
