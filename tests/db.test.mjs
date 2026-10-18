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

describe('limparTudo', () => {
  it('apaga dados e mantém o último nome', async () => {
    await db.salvar('Visitas', { id: 'v1' }, { autor: 'A' });
    await db.setMeta('ultimo_nome', 'Alan');
    await db.setMeta('sessao', { autor: 'Alan' });
    await db.limparTudo();
    expect(await db.todos('Visitas')).toEqual([]);
    expect(await db.outbox()).toEqual([]);
    expect(await db.meta('sessao')).toBeUndefined();
    expect(await db.meta('ultimo_nome')).toBe('Alan');
  });
});

describe('salvarComBlob', () => {
  it('grava registro, outbox e blob juntos', async () => {
    await db.salvarComBlob('Midias', { id: 'm9', placa: 'A' }, new Blob(['xy']), { autor: 'A' });
    expect((await db.get('Midias', 'm9')).placa).toBe('A');
    expect(await (await db.blob('m9')).blob.text()).toBe('xy');
    expect((await db.outbox()).length).toBe(1);
  });
});

// iOS perde o arquivo por trás de um Blob guardado no IndexedDB quando o app é fechado.
// Por isso o banco guarda os bytes (ArrayBuffer), nunca o objeto Blob/File.
describe('arquivos guardados como bytes', () => {
  const brutos = async (nome, id) => {
    const tx = (await new Promise((ok) => { const r = indexedDB.open(nome); r.onsuccess = () => ok(r.result); })).transaction('blobs');
    return new Promise((ok) => { const r = tx.objectStore('blobs').get(id); r.onsuccess = () => ok(r.result); });
  };

  it('salvarComBlob grava ArrayBuffer e tipo, e devolve Blob ao ler', async () => {
    await db.abrir('bytes-1');
    await db.salvarComBlob('Midias', { id: 'm1' }, new Blob(['abc'], { type: 'image/jpeg' }), { autor: 'A' });
    const cru = await brutos('bytes-1', 'm1');
    expect(cru.blob).toBeUndefined();
    expect(cru.dados).toBeInstanceOf(ArrayBuffer);
    expect(cru.tipo).toBe('image/jpeg');
    const b = await db.blob('m1');
    expect(b.blob.size).toBe(3);
    expect(b.blob.type).toBe('image/jpeg');
    expect(await b.blob.text()).toBe('abc');
  });

  it('salvarBlob também grava bytes; blobs() devolve Blobs', async () => {
    await db.abrir('bytes-2');
    await db.salvarBlob('m2', new Blob(['xyz']));
    expect((await brutos('bytes-2', 'm2')).dados).toBeInstanceOf(ArrayBuffer);
    const [b] = await db.blobs();
    expect(await b.blob.text()).toBe('xyz');
  });

  it('marcarRecebido mantém os bytes', async () => {
    await db.abrir('bytes-3');
    await db.salvarBlob('m3', new Blob(['12345']));
    await db.marcarRecebido('m3', 2);
    const b = await db.blob('m3');
    expect(b.recebido).toBe(2);
    expect(await b.blob.text()).toBe('12345');
  });
});
