import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../app/js/db.js';

let n = 0;
beforeEach(async () => { await db.abrir('teste-' + ++n); });

describe('db', () => {
  it('salvar grava no store e na outbox', async () => {
    const r = await db.salvar('Visitas', { id: 'v1', placa: 'A' }, { autor: 'Alan' });
    expect(r.atualizado_por).toBe('Alan');
    expect(await db.get('Visitas', 'v1')).toMatchObject({ placa: 'A' });
    const ob = await db.outbox();
    expect(ob).toEqual([expect.objectContaining({ tabela: 'Visitas', registro: expect.objectContaining({ id: 'v1' }) })]);
  });

  it('substituirTudo preserva registro pendente na outbox', async () => {
    await db.salvar('Visitas', { id: 'v1', km: 9512 }, { autor: 'Alan' });
    await db.substituirTudo({ Visitas: [{ id: 'v1', km: 1 }, { id: 'v2', km: 2 }] });
    expect((await db.get('Visitas', 'v1')).km).toBe(9512);
    expect((await db.get('Visitas', 'v2')).km).toBe(2);
  });

  it('substituirTudo remove registros que sumiram do servidor', async () => {
    await db.substituirTudo({ Roteiro: [{ id: 'r1' }] });
    await db.substituirTudo({ Roteiro: [{ id: 'r2' }] });
    expect((await db.todos('Roteiro')).map((r) => r.id)).toEqual(['r2']);
  });

  it('removerOutbox tira os confirmados', async () => {
    await db.salvar('Visitas', { id: 'v1' }, { autor: 'A' });
    await db.salvar('Visitas', { id: 'v2' }, { autor: 'A' });
    const ob = await db.outbox();
    await db.removerOutbox([ob[0].seq]);
    expect((await db.outbox()).map((i) => i.registro.id)).toEqual(['v2']);
  });

  it('blob salvo e recuperado é idêntico', async () => {
    await db.salvarBlob('m1', new Blob(['abc'], { type: 'image/jpeg' }));
    const b = await db.blob('m1');
    expect(b.recebido).toBe(0);
    expect(await b.blob.text()).toBe('abc');
    await db.removerBlob('m1');
    expect(await db.blob('m1')).toBeUndefined();
  });

  it('meta guarda e lê', async () => {
    await db.setMeta('sessao', { autor: 'Alan' });
    expect(await db.meta('sessao')).toEqual({ autor: 'Alan' });
  });

  it('por filtra por campo', async () => {
    await db.salvar('Ocorrencias', { id: 'o1', visita_id: 'v1' }, { autor: 'A' });
    await db.salvar('Ocorrencias', { id: 'o2', visita_id: 'v2' }, { autor: 'A' });
    expect((await db.por('Ocorrencias', 'visita_id', 'v1')).map((o) => o.id)).toEqual(['o1']);
  });
});
