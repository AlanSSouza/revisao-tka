import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../app/js/db.js';
import { excluirVisita, excluirTreinamento } from '../app/js/exclusao.js';

let n = 0;
const A = { autor: 'Alan' };
beforeEach(async () => {
  await db.abrir('exclusao-' + ++n);
  await db.salvar('Visitas', { id: 'v1', placa: 'P1', concluida: false }, A);
  await db.salvar('Visitas', { id: 'v2', placa: 'P1', concluida: false }, A);
  await db.salvar('Equipe', { id: 'e1', visita_id: 'v1', nome: 'Ana' }, A);
  await db.salvar('Equipe', { id: 'e2', visita_id: 'v2', nome: 'Beto' }, A);
  await db.salvar('Ocorrencias', { id: 'o1', visita_id: 'v1', placa: 'P1' }, A);
  await db.salvar('Treinamentos', { id: 't1', visita_id: 'v1' }, A);
  await db.salvar('TreinamentoParticipantes', { id: 'p1', treinamento_id: 't1', nome: 'Ana' }, A);
  await db.salvar('Midias', { id: 'm1', visita_id: 'v1', placa: 'P1' }, A);
});

const removido = async (t, id) => (await db.get(t, id)).removido === true;

describe('excluirVisita', () => {
  it('marca a visita e tudo ligado a ela como removido, sem tocar nas outras', async () => {
    await excluirVisita('v1', A);
    for (const [t, id] of [['Visitas', 'v1'], ['Equipe', 'e1'], ['Ocorrencias', 'o1'], ['Treinamentos', 't1'], ['TreinamentoParticipantes', 'p1'], ['Midias', 'm1']]) {
      expect(await removido(t, id), `${t} ${id}`).toBe(true);
    }
    expect(await removido('Visitas', 'v2')).toBe(false);
    expect(await removido('Equipe', 'e2')).toBe(false);
  });

  it('recusa visita concluída', async () => {
    await db.salvar('Visitas', { id: 'v3', placa: 'P1', concluida: 'true' }, A);
    await expect(excluirVisita('v3', A)).rejects.toThrow(/concluída/);
    expect(await removido('Visitas', 'v3')).toBe(false);
  });

  it('gera envio ao servidor para cada registro removido', async () => {
    const antes = (await db.outbox()).length;
    await excluirVisita('v1', A);
    expect((await db.outbox()).length - antes).toBe(6);
  });
});

describe('excluirTreinamento', () => {
  it('remove o treinamento e seus participantes', async () => {
    await excluirTreinamento('t1', A);
    expect(await removido('Treinamentos', 't1')).toBe(true);
    expect(await removido('TreinamentoParticipantes', 'p1')).toBe(true);
    expect(await removido('Visitas', 'v1')).toBe(false);
  });
});
