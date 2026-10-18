import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../app/js/db.js';
import { sincronizar, eventos } from '../app/js/sync.js';
import { PEDACO } from '../app/js/config.js';

let n = 0;
let chamadas;
let handler;

beforeEach(async () => {
  await db.abrir('sync-' + ++n);
  await db.setMeta('sessao', { autor: 'Alan', senha: 'reg', papel: 'registro' });
  chamadas = [];
  handler = (req) => {
    if (req.acao === 'upsert') return { ok: true, gravados: req.registros.length };
    if (req.acao === 'pull') return { ok: true, dados: {}, servidor_em: 'x' };
    return { ok: true };
  };
  globalThis.fetch = async (url, opts) => {
    const req = JSON.parse(opts.body);
    chamadas.push(req);
    const r = handler(req);
    if (r instanceof Error) throw r;
    return { ok: true, json: async () => r };
  };
});

const acoes = () => chamadas.map((c) => c.acao);

describe('sincronizar', () => {
  it('envia outbox e esvazia', async () => {
    await db.salvar('Visitas', { id: 'v1' }, { autor: 'Alan' });
    await db.salvar('Visitas', { id: 'v1', km: 2 }, { autor: 'Alan' });
    const r = await sincronizar();
    const up = chamadas.find((c) => c.acao === 'upsert');
    expect(up.registros).toEqual([expect.objectContaining({ id: 'v1', km: 2 })]);
    expect(up.senha).toBe('reg');
    expect(await db.outbox()).toEqual([]);
    expect(r.pendentes.registros).toBe(0);
  });

  it('ErroRede no meio mantém itens não confirmados', async () => {
    await db.salvar('Visitas', { id: 'v1' }, { autor: 'A' });
    await db.salvar('Ocorrencias', { id: 'o1' }, { autor: 'A' });
    handler = (req) => (req.acao === 'upsert' && req.tabela === 'Ocorrencias' ? new TypeError('Failed to fetch') : { ok: true, gravados: 1 });
    await sincronizar();
    const ob = await db.outbox();
    expect(ob.map((i) => i.tabela)).toEqual(['Ocorrencias']);
  });

  it('ErroAuth mantém outbox e emite sync:auth', async () => {
    await db.salvar('Visitas', { id: 'v1' }, { autor: 'A' });
    handler = () => ({ ok: false, erro: 'auth' });
    let auth = false;
    eventos.addEventListener('sync:auth', () => { auth = true; }, { once: true });
    await sincronizar();
    expect(auth).toBe(true);
    expect((await db.outbox()).length).toBe(1);
  });

  it('upload retoma do recebido salvo', async () => {
    const tamanho = 10 * 1024 * 1024;
    await db.salvar('Midias', { id: 'm1', placa: 'A', mime: 'video/mp4' }, { autor: 'A' });
    await db.salvarBlob('m1', new Blob([new Uint8Array(tamanho)]));
    let servidor = 0;
    let falhar = true;
    handler = (req) => {
      if (req.acao === 'uploadInicio') return { ok: true, recebido: servidor };
      if (req.acao === 'uploadPedaco') {
        if (servidor > 0 && falhar) { falhar = false; return new TypeError('Failed to fetch'); }
        servidor = req.offset + Buffer.from(req.dados_b64, 'base64').length;
        return servidor >= tamanho ? { ok: true, concluido: true, link: 'L', drive_id: 'D' } : { ok: true, recebido: servidor };
      }
      if (req.acao === 'upsert') return { ok: true, gravados: 1 };
      return { ok: true, dados: {} };
    };
    await sincronizar();
    expect(servidor).toBe(PEDACO);
    chamadas = [];
    await sincronizar();
    const pedacos = chamadas.filter((c) => c.acao === 'uploadPedaco').map((c) => c.offset);
    expect(pedacos[0]).toBe(PEDACO);
    expect(servidor).toBe(tamanho);
  });

  it('mídia concluída remove blob e grava link', async () => {
    await db.salvar('Midias', { id: 'm1', placa: 'A', mime: 'image/jpeg' }, { autor: 'A' });
    await db.salvarBlob('m1', new Blob(['abc']));
    handler = (req) => {
      if (req.acao === 'uploadInicio') return { ok: true, recebido: 0 };
      if (req.acao === 'uploadPedaco') return { ok: true, concluido: true, link: 'https://drive/x', drive_id: 'x' };
      if (req.acao === 'upsert') return { ok: true, gravados: 1 };
      return { ok: true, dados: {} };
    };
    await sincronizar();
    expect(await db.blob('m1')).toBeUndefined();
    expect((await db.get('Midias', 'm1')).link).toBe('https://drive/x');
  });

  it('duas chamadas simultâneas de sincronizar executam uma vez', async () => {
    await db.salvar('Visitas', { id: 'v1' }, { autor: 'A' });
    await Promise.all([sincronizar(), sincronizar()]);
    expect(acoes().filter((a) => a === 'pull').length).toBe(1);
  });

  it('pull atualiza dados locais', async () => {
    handler = (req) => (req.acao === 'pull' ? { ok: true, dados: { Equipamentos: [{ id: 'TSN5J65' }] } } : { ok: true });
    await sincronizar();
    expect((await db.todos('Equipamentos')).map((e) => e.id)).toEqual(['TSN5J65']);
  });
});
