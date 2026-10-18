import { describe, it, expect, beforeEach } from 'vitest';
import { carregarGas, post } from './helpers/gas-mock.mjs';

const ARQ = ['backend/Planilha.gs', 'backend/Codigo.gs', 'backend/Midia.gs'];
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
  it('setup acrescenta colunas novas no fim sem perder linhas antigas', () => {
    const sh = aba('Equipe');
    const antigo = ['id', 'visita_id', 'matricula', 'nome', 'papel', 'avulso', 'removido', 'atualizado_em', 'atualizado_por'];
    sh.data = [antigo, ['e1', 'v1', '10', 'Ana', 'operador', 'false', '', '', 'Alan']];
    ctx.setup();
    expect(sh.data[0].slice(0, antigo.length)).toEqual(antigo);
    expect(sh.data[0]).toContain('funcao');
    post(ctx, { acao: 'upsert', ...R, tabela: 'Equipe', registros: [{ id: 'e1', funcao: 'ELETRICISTA' }] });
    const e1 = post(ctx, { acao: 'pull', ...R }).dados.Equipe[0];
    expect(e1).toMatchObject({ id: 'e1', nome: 'Ana', papel: 'operador', funcao: 'ELETRICISTA' });
  });
  it('seed substituir limpa linhas anteriores', () => {
    post(ctx, { acao: 'seed', ...R, tabela: 'Funcionarios', registros: [{ id: '1' }, { id: '2' }], substituir: true });
    post(ctx, { acao: 'seed', ...R, tabela: 'Funcionarios', registros: [{ id: '3' }], substituir: true });
    expect(post(ctx, { acao: 'pull', ...R }).dados.Funcionarios.map((f) => f.id)).toEqual(['3']);
  });
});

describe('limites e proteção', () => {
  it('seed de 1107 funcionários passa da linha 1000', () => {
    const regs = Array.from({ length: 1107 }, (_, i) => ({ id: String(i + 1), nome: 'P' + i }));
    for (let i = 0; i < regs.length; i += 500) {
      const r = post(ctx, { acao: 'seed', ...R, tabela: 'Funcionarios', registros: regs.slice(i, i + 500), substituir: i === 0 });
      expect(r.ok).toBe(true);
    }
    expect(post(ctx, { acao: 'pull', ...R }).dados.Funcionarios.length).toBe(1107);
  });
  it('upsert sem link não apaga link já gravado da mídia', () => {
    post(ctx, { acao: 'upsert', ...R, tabela: 'Midias', registros: [{ id: 'm1', link: 'L', drive_id: 'D', enviado_em: 'E' }] });
    post(ctx, { acao: 'upsert', ...R, tabela: 'Midias', registros: [{ id: 'm1', link: '', drive_id: '', enviado_em: '', legenda: 'x' }] });
    expect(post(ctx, { acao: 'pull', ...R }).dados.Midias[0]).toMatchObject({ link: 'L', drive_id: 'D', enviado_em: 'E', legenda: 'x' });
  });
});
