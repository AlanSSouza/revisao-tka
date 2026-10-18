import { describe, it, expect } from 'vitest';
import { barras, rosca, colunasProgresso, CORES } from '../app/js/graficos.js';

const conta = (s, re) => (s.match(re) || []).length;

describe('barras', () => {
  it('uma barra por item, largura proporcional ao maior, texto escapado', () => {
    const s = barras([{ rotulo: 'Vazamento <A&B>', valor: 4 }, { rotulo: 'Ruído', valor: 2 }]);
    expect(s.startsWith('<svg')).toBe(true);
    expect(conta(s, /<rect class="barra"/g)).toBe(2);
    expect(s).toContain('Vazamento &lt;A&amp;B&gt;');
    const larguras = [...s.matchAll(/class="barra"[^>]*width="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(larguras[0]).toBeCloseTo(larguras[1] * 2, 0);
  });

  it('lista vazia vira aviso', () => {
    expect(barras([])).toContain('Sem dados');
  });

  it('limita a quantidade de barras e agrupa o resto em "Outros"', () => {
    const itens = Array.from({ length: 10 }, (_, i) => ({ rotulo: 'T' + i, valor: 10 - i }));
    const s = barras(itens, { max: 4 });
    expect(conta(s, /<rect class="barra"/g)).toBe(5);
    expect(s).toContain('Outros (6)');
  });
});

describe('rosca', () => {
  it('um arco por fatia com valor e o total no centro', () => {
    const s = rosca([{ rotulo: 'A', valor: 1, cor: CORES.verde }, { rotulo: 'B', valor: 3 }, { rotulo: 'C', valor: 0 }]);
    expect(conta(s, /<path class="fatia"/g)).toBe(2);
    expect(s).toContain('>4<');
    expect(s).toContain(CORES.verde);
  });

  it('fatia única desenha círculo inteiro', () => {
    const s = rosca([{ rotulo: 'A', valor: 5 }]);
    expect(conta(s, /<circle class="fatia"/g)).toBe(1);
  });
});

describe('colunasProgresso', () => {
  it('mostra visitadas de total por grupo', () => {
    const s = colunasProgresso([{ rotulo: 'Itajubá', total: 4, visitadas: 1 }]);
    expect(s).toContain('1 de 4');
    expect(s).toContain('Itajubá');
  });
});
