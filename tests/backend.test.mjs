import { describe, it, expect, beforeEach } from 'vitest';
import { carregarGas, post } from './helpers/gas-mock.mjs';

const ARQ = ['backend/Planilha.gs', 'backend/Codigo.gs'];
let ctx;
const R = { senha: 'reg', autor: 'Alan' };
const C = { senha: 'con', autor: 'Eng' };

beforeEach(() => {
  ctx = carregarGas(ARQ);
  ctx.amb.props.SENHA_REGISTRO = 'reg';
  ctx.amb.props.SENHA_CONSULTA = 'con';
  ctx.setup();
});

const aba = (nome) => ctx.amb.planilhas[ctx.amb.props.PLANILHA_ID].getSheetByName(nome);

describe('backend', () => {
  it('senha errada → erro auth', () => {
    expect(post(ctx, { acao: 'login', senha: 'x' })).toMatchObject({ ok: false, erro: 'auth' });
  });
  it('login registro e consulta', () => {
    expect(post(ctx, { acao: 'login', ...R }).papel).toBe('registro');
    expect(post(ctx, { acao: 'login', ...C }).papel).toBe('consulta');
  });
  it('upsert duas vezes o mesmo id grava uma linha só', () => {
    post(ctx, { acao: 'upsert', ...R, tabela: 'Visitas', registros: [{ id: 'v1', placa: 'TSN5J65', km: 9334 }] });
    const r = post(ctx, { acao: 'upsert', ...R, tabela: 'Visitas', registros: [{ id: 'v1', placa: 'TSN5J65', km: 9512 }] });
    expect(r.gravados).toBe(1);
    const dados = aba('Visitas').data.slice(1);
    expect(dados.length).toBe(1);
    const cab = aba('Visitas').data[0];
    expect(dados[0][cab.indexOf('km')]).toBe(9512);
  });
  it('consulta não pode upsert', () => {
    expect(post(ctx, { acao: 'upsert', ...C, tabela: 'Visitas', registros: [{ id: 'v1' }] }).erro).toBe('auth');
  });
  it('pull consulta não traz Funcionarios; registro traz', () => {
    post(ctx, { acao: 'seed', ...R, tabela: 'Funcionarios', registros: [{ id: '1', matricula: '1', nome: 'A' }], substituir: true });
    expect(post(ctx, { acao: 'pull', ...C }).dados.Funcionarios).toBeUndefined();
    expect(post(ctx, { acao: 'pull', ...R }).dados.Funcionarios).toEqual([expect.objectContaining({ matricula: '1', nome: 'A' })]);
  });
  it('tabela inválida → erro param', () => {
    expect(post(ctx, { acao: 'upsert', ...R, tabela: 'Hack', registros: [] }).erro).toBe('param');
  });
  it('setup é idempotente', () => {
    ctx.setup();
    expect(ctx.amb.planilhas[ctx.amb.props.PLANILHA_ID].getSheets().length).toBe(10);
  });
  it('seed substituir limpa linhas anteriores', () => {
    post(ctx, { acao: 'seed', ...R, tabela: 'Funcionarios', registros: [{ id: '1' }, { id: '2' }], substituir: true });
    post(ctx, { acao: 'seed', ...R, tabela: 'Funcionarios', registros: [{ id: '3' }], substituir: true });
    expect(post(ctx, { acao: 'pull', ...R }).dados.Funcionarios.map((f) => f.id)).toEqual(['3']);
  });
});
