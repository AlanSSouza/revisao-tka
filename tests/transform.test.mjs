import { describe, it, expect } from 'vitest';
import { linhasParaEquipamentos, linhasParaFuncionarios } from '../tools/transform.mjs';

describe('equipamentos', () => {
  it('equipamento mantém colunas e cria id', () => {
    const [e] = linhasParaEquipamentos([{ cod_placa: 'TSN5J65', km_atual: 9334, centro_custo: 'SERVIÇOS EM ENERGIA - ARACAJU' }]);
    expect(e.id).toBe('TSN5J65');
    expect(e.km_atual).toBe(9334);
    expect(e.centro_custo).toBe('SERVIÇOS EM ENERGIA - ARACAJU');
    expect(e.serie_munck).toBe('');
  });
  it('km vazio vira null', () => {
    const [e] = linhasParaEquipamentos([{ cod_placa: 'UTM9I28', km_atual: '' }]);
    expect(e.km_atual).toBeNull();
  });
});

describe('funcionarios', () => {
  const base = { Matricula: '000123', Nome: ' JOAO SILVA ', 'Desc.Funcao': 'MOTORISTA', 'Centro Custo': '12501005', Filial: '10101' };
  it('funcionario demitido é descartado', () => {
    const r = linhasParaFuncionarios([{ ...base, 'Dt. Demissao': '15/03/2025' }, { ...base, Matricula: '2', 'Dt. Demissao': '' }]);
    expect(r.length).toBe(1);
  });
  it('funcionario com data vazia "  /  /    " é ativo', () => {
    expect(linhasParaFuncionarios([{ ...base, 'Dt. Demissao': '  /  /    ' }]).length).toBe(1);
  });
  it('funcionario não carrega dados sensíveis', () => {
    const r = linhasParaFuncionarios([{ ...base, CPF: '111', 'Salário': 9, 'Nome Mae': 'X', 'Dt. Demissao': '' }]);
    expect(Object.keys(r[0]).sort()).toEqual(['centro_custo', 'filial', 'funcao', 'id', 'matricula', 'nome']);
    expect(r[0].nome).toBe('JOAO SILVA');
  });
});
