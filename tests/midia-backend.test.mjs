import { describe, it, expect, beforeEach } from 'vitest';
import { carregarGas, post } from './helpers/gas-mock.mjs';

const ARQ = ['backend/Planilha.gs', 'backend/Codigo.gs', 'backend/Midia.gs'];
const R = { senha: 'reg', autor: 'Alan' };
let ctx, sessao;

// Simula a sessão resumable do Drive: guarda bytes recebidos e responde 308 até completar.
function simularDrive(amb) {
  sessao = { bytes: 0, total: 0, criadas: 0, puts: 0 };
  amb.fetchHandler = (url, opts) => {
    const resp = (code, headers = {}, body = '{}') => ({ getResponseCode: () => code, getHeaders: () => headers, getContentText: () => body });
    if (url.includes('uploadType=resumable')) {
      sessao.criadas++;
      sessao.total = Number(opts.headers['X-Upload-Content-Length']);
      return resp(200, { Location: 'https://upload.example/sessao1' });
    }
    const cr = opts.headers['Content-Range'];
    if (cr.startsWith('bytes */')) {
      return sessao.bytes ? resp(308, { Range: `bytes=0-${sessao.bytes - 1}` }) : resp(308);
    }
    sessao.puts++;
    const [, ini, fim] = cr.match(/bytes (\d+)-(\d+)\//).map(Number);
    if (ini !== sessao.bytes) return resp(400);
    sessao.bytes = fim + 1;
    if (sessao.bytes >= sessao.total) return resp(200, {}, JSON.stringify({ id: 'arq1' }));
    return resp(308, { Range: `bytes=0-${fim}` });
  };
}

const midia = { id: 'm1', visita_id: 'v1', placa: 'TSN5J65', tipo: 'foto', nome_arquivo: 'foto_101010_m1.jpg', mime: 'image/jpeg', tamanho: 8, criado_em: '2026-10-20T12:00:00.000Z' };
const b64 = (s) => Buffer.from(s).toString('base64');

beforeEach(() => {
  ctx = carregarGas(ARQ);
  ctx.amb.props.SENHA_REGISTRO = 'reg';
  ctx.amb.props.SENHA_CONSULTA = 'con';
  ctx.setup();
  simularDrive(ctx.amb);
});

describe('upload de mídia', () => {
  it('upload completo em 2 pedaços grava Midias com link e compartilha', () => {
    expect(post(ctx, { acao: 'uploadInicio', ...R, midia, total_bytes: 8 })).toMatchObject({ ok: true, recebido: 0 });
    expect(post(ctx, { acao: 'uploadPedaco', ...R, id: 'm1', offset: 0, dados_b64: b64('abcd') })).toMatchObject({ recebido: 4 });
    const fim = post(ctx, { acao: 'uploadPedaco', ...R, id: 'm1', offset: 4, dados_b64: b64('efgh') });
    expect(fim).toMatchObject({ ok: true, concluido: true, link: 'https://drive.google.com/file/d/arq1/view' });
    expect(ctx.amb.arquivos.arq1.compartilhado).toEqual(['ANYONE_WITH_LINK', 'VIEW']);
    const m = post(ctx, { acao: 'pull', ...R }).dados.Midias;
    expect(m).toEqual([expect.objectContaining({ id: 'm1', drive_id: 'arq1', link: fim.link })]);
    expect(ctx.amb.props.UP_m1).toBeUndefined();
  });

  it('cria pasta Revisão TKA/<placa>/<data>', () => {
    post(ctx, { acao: 'uploadInicio', ...R, midia, total_bytes: 8 });
    const nomes = Object.values(ctx.amb.pastas).map((p) => p.nome);
    expect(nomes).toEqual(expect.arrayContaining(['Revisão TKA', 'TSN5J65', '2026-10-20']));
  });

  it('uploadInicio repetido de mídia já enviada devolve concluido sem nova sessão', () => {
    post(ctx, { acao: 'uploadInicio', ...R, midia, total_bytes: 8 });
    post(ctx, { acao: 'uploadPedaco', ...R, id: 'm1', offset: 0, dados_b64: b64('abcdefgh') });
    const r = post(ctx, { acao: 'uploadInicio', ...R, midia, total_bytes: 8 });
    expect(r).toMatchObject({ concluido: true, link: 'https://drive.google.com/file/d/arq1/view' });
    expect(sessao.criadas).toBe(1);
  });

  it('pedaço com offset desalinhado devolve recebido do servidor e não chama PUT', () => {
    post(ctx, { acao: 'uploadInicio', ...R, midia, total_bytes: 8 });
    post(ctx, { acao: 'uploadPedaco', ...R, id: 'm1', offset: 0, dados_b64: b64('abcd') });
    const r = post(ctx, { acao: 'uploadPedaco', ...R, id: 'm1', offset: 0, dados_b64: b64('abcd') });
    expect(r).toMatchObject({ ok: true, recebido: 4 });
    expect(sessao.puts).toBe(1);
  });

  it('uploadInicio com sessão aberta retoma em vez de recriar', () => {
    post(ctx, { acao: 'uploadInicio', ...R, midia, total_bytes: 8 });
    post(ctx, { acao: 'uploadPedaco', ...R, id: 'm1', offset: 0, dados_b64: b64('abcd') });
    expect(post(ctx, { acao: 'uploadInicio', ...R, midia, total_bytes: 8 })).toMatchObject({ recebido: 4 });
    expect(sessao.criadas).toBe(1);
  });

  it('uploadStatus após queda devolve bytes já confirmados', () => {
    post(ctx, { acao: 'uploadInicio', ...R, midia, total_bytes: 8 });
    post(ctx, { acao: 'uploadPedaco', ...R, id: 'm1', offset: 0, dados_b64: b64('abcd') });
    expect(post(ctx, { acao: 'uploadStatus', ...R, id: 'm1' })).toMatchObject({ ok: true, recebido: 4 });
  });

  it('consulta não pode enviar mídia', () => {
    expect(post(ctx, { acao: 'uploadInicio', senha: 'con', midia, total_bytes: 8 }).erro).toBe('auth');
  });
});
