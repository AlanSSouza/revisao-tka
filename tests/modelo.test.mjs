import { describe, it, expect } from 'vitest';
import { parseNumeroBR, alertaKm, resumoParque, alteracoesCadastro, novoMembro, novaVisita, uuid } from '../app/js/modelo.js';

describe('parseNumeroBR', () => {
  it('milhar com ponto', () => expect(parseNumeroBR('9.512')).toBe(9512));
  it('decimal com vírgula', () => expect(parseNumeroBR('412,5')).toBe(412.5));
  it('milhar e decimal', () => expect(parseNumeroBR('1.234,5')).toBe(1234.5));
  it('vazio', () => expect(parseNumeroBR('')).toBeNull());
  it('texto', () => expect(parseNumeroBR('abc')).toBeNull());
  it('número já numérico', () => expect(parseNumeroBR(42)).toBe(42));
});

describe('alertaKm', () => {
  it('menor que anterior alerta com formatação BR', () => expect(alertaKm(9000, 9334)).toContain('9.334'));
  it('maior não alerta', () => expect(alertaKm(9512, 9334)).toBeNull());
  it('sem anterior não alerta', () => expect(alertaKm(9512, null)).toBeNull());
});

describe('resumoParque', () => {
  it('conta visitadas, hoje e sem data', () => {
    const eq = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const visitas = [{ id: 'v', placa: 'A', concluida: true }, { id: 'w', placa: 'C', concluida: false }];
    const roteiro = [{ id: 'r', placa: 'B', data: '2026-10-20', situacao: 'planejada' }];
    expect(resumoParque(eq, visitas, roteiro, '2026-10-20')).toEqual({ total: 3, visitadas: 1, hoje: 1, semData: 1 });
  });
  it('reagendada não conta para hoje', () => {
    const r = resumoParque([{ id: 'A' }], [], [{ placa: 'A', data: '2026-10-20', situacao: 'reagendada' }], '2026-10-20');
    expect(r.hoje).toBe(0);
    expect(r.semData).toBe(1);
  });
});

describe('alteracoesCadastro', () => {
  it('um item por campo alterado', () => {
    const orig = { id: 'TSN5J65', cod_placa: 'TSN5J65', centro_custo: 'A', cidade: 'ARACAJU', km_atual: 10 };
    const ed = { ...orig, centro_custo: 'B', cidade: 'ITABAIANA' };
    const alt = alteracoesCadastro(orig, ed, 'Alan');
    expect(alt.map((a) => [a.campo, a.valor_original, a.valor_novo])).toEqual([
      ['centro_custo', 'A', 'B'], ['cidade', 'ARACAJU', 'ITABAIANA']]);
    expect(alt[0].placa).toBe('TSN5J65');
    expect(alt[0].id).toBeTruthy();
  });
});

describe('fábricas', () => {
  it('novoMembro com papel inválido lança erro', () => {
    expect(() => novoMembro({ id: 'v' }, { nome: 'X' }, 'chefe')).toThrow();
  });
  it('novoMembro avulso quando sem matrícula cadastrada', () => {
    const m = novoMembro({ id: 'v' }, { nome: 'Fulano', matricula: '' }, 'operador');
    expect(m).toMatchObject({ visita_id: 'v', nome: 'Fulano', papel: 'operador', avulso: true });
  });
  it('novaVisita preenche gps e começa não concluída', () => {
    const v = novaVisita('TSN5J65', 'Alan', { lat: -10.9, lng: -37, precisao: 12 });
    expect(v).toMatchObject({ placa: 'TSN5J65', autor: 'Alan', lat: -10.9, concluida: false });
  });
  it('uuid único', () => expect(uuid()).not.toBe(uuid()));
});

import { primeiroValor } from '../app/js/modelo.js';
describe('primeiroValor', () => {
  it('ignora vazio e null', () => expect(primeiroValor('', null, 9334)).toBe(9334));
  it('mantém zero', () => expect(primeiroValor(0, 5)).toBe(0));
  it('tudo vazio dá null', () => expect(primeiroValor('', undefined)).toBeNull());
});
