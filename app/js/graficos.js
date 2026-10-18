// Gráficos em SVG (texto), usados na tela e convertidos em imagem para o PDF. Sem bibliotecas.

export const CORES = {
  petroleo: '#00989A', fundo: '#0B4F51', tinta: '#16302F', suave: '#4F6968', nevoa: '#EEF4F4', linha: '#D2E1E1',
  laranja1: '#EF4136', laranja2: '#FBA63C', verde: '#1F9D57', ambar: '#E9A100', vermelho: '#D63B30', cinza: '#A9B8B7',
};
const PALETA = [CORES.petroleo, CORES.laranja1, CORES.laranja2, CORES.fundo, '#6FC3C4', CORES.cinza, '#B23A63', '#5B7C99'];
const FONTE = "font-family=\"Barlow, 'Helvetica Neue', Arial, sans-serif\"";

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cortar = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
const svg = (alt, corpo, titulo, L = 340) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L} ${alt}" width="${L}" height="${alt}" ${FONTE} role="img" aria-label="${esc(titulo || 'Gráfico')}">${corpo}</svg>`;
const semDados = () => svg(40, `<text x="0" y="24" font-size="13" fill="${CORES.suave}">Sem dados ainda.</text>`);

// Barras horizontais: [{rotulo, valor, cor?}]. max limita barras; o resto vira "Outros (n)".
export function barras(itens, { max = 8, cor = CORES.petroleo, titulo, largura: L = 340 } = {}) {
  let lista = itens.filter((i) => i.valor > 0);
  if (!lista.length) return semDados();
  if (lista.length > max) {
    const resto = lista.slice(max);
    lista = [...lista.slice(0, max), { rotulo: `Outros (${resto.length})`, valor: resto.reduce((s, i) => s + i.valor, 0), cor: CORES.cinza }];
  }
  const maior = Math.max(...lista.map((i) => i.valor));
  const x0 = 132, area = L - x0 - 34, alt = 26;
  const corpo = lista.map((i, n) => {
    const y = n * alt;
    const w = Math.max(2, (i.valor / maior) * area);
    return `<text x="0" y="${y + 17}" font-size="12.5" fill="${CORES.tinta}">${esc(cortar(i.rotulo, 21))}</text>`
      + `<rect class="barra" x="${x0}" y="${y + 5}" rx="3" height="16" width="${w.toFixed(1)}" fill="${i.cor || cor}"/>`
      + `<text x="${(x0 + w + 6).toFixed(1)}" y="${y + 17.5}" font-size="12.5" font-weight="700" fill="${CORES.tinta}">${i.valor}</text>`;
  }).join('');
  return svg(lista.length * alt + 4, corpo, titulo, L);
}

function arco(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)].map((n) => n.toFixed(2)).join(' ');
  return `M ${p(a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`;
}

// Rosca com legenda: [{rotulo, valor, cor?}]. O total fica no centro.
export function rosca(itens, { titulo, centro, largura: L = 340 } = {}) {
  const lista = itens.map((i, n) => ({ ...i, cor: i.cor || PALETA[n % PALETA.length] }));
  const total = lista.reduce((s, i) => s + i.valor, 0);
  if (!total) return semDados();
  const cx = 70, cy = 70, r = 54, esp = 22;
  const comValor = lista.filter((i) => i.valor > 0);
  let a = 0;
  const fatias = comValor.length === 1
    ? `<circle class="fatia" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${comValor[0].cor}" stroke-width="${esp}"/>`
    : comValor.map((i) => {
      const a1 = a + (i.valor / total) * Math.PI * 2;
      const d = arco(cx, cy, r, a, a1 - 0.012);
      a = a1;
      return `<path class="fatia" d="${d}" fill="none" stroke="${i.cor}" stroke-width="${esp}"/>`;
    }).join('');
  const meio = `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="26" font-weight="700" fill="${CORES.tinta}">${total}</text>`
    + `<text x="${cx}" y="${cy + 21}" text-anchor="middle" font-size="11" fill="${CORES.suave}">${esc(centro || 'total')}</text>`;
  const legenda = lista.map((i, n) => {
    const y = 18 + n * 22;
    const pct = Math.round((i.valor / total) * 100);
    return `<rect x="160" y="${y - 10}" width="12" height="12" rx="3" fill="${i.cor}"/>`
      + `<text x="180" y="${y}" font-size="12.5" fill="${CORES.tinta}">${esc(cortar(i.rotulo, 17))}</text>`
      + `<text x="${L}" y="${y}" text-anchor="end" font-size="12.5" font-weight="700" fill="${CORES.tinta}">${i.valor} <tspan font-weight="400" fill="${CORES.suave}">${pct}%</tspan></text>`;
  }).join('');
  return svg(Math.max(140, lista.length * 22 + 10), fatias + meio + legenda, titulo, L);
}

// Progresso por grupo: [{rotulo, total, visitadas}].
export function colunasProgresso(grupos, { titulo, largura: L = 340 } = {}) {
  if (!grupos.length) return semDados();
  const alt = 36;
  const corpo = grupos.map((g, n) => {
    const y = n * alt;
    const w = g.total ? (g.visitadas / g.total) * L : 0;
    return `<text x="0" y="${y + 13}" font-size="12.5" fill="${CORES.tinta}">${esc(cortar(g.rotulo, 34))}</text>`
      + `<text x="${L}" y="${y + 13}" text-anchor="end" font-size="12.5" font-weight="700" fill="${CORES.tinta}">${g.visitadas} de ${g.total}</text>`
      + `<rect x="0" y="${y + 19}" width="${L}" height="9" rx="4.5" fill="${CORES.nevoa}"/>`
      + (w ? `<rect x="0" y="${y + 19}" width="${w.toFixed(1)}" height="9" rx="4.5" fill="${CORES.petroleo}"/>` : '');
  }).join('');
  return svg(grupos.length * alt, corpo, titulo, L);
}
