import { describe, it, expect } from 'vitest';
import { criarRascunho } from '../app/js/rascunho.js';

describe('rascunho', () => {
  it('flush sem alteração não salva', async () => {
    let n = 0;
    const r = criarRascunho({ id: 1 }, { salvar: async () => { n++; }, ms: 10 });
    await r.flush();
    expect(n).toBe(0);
  });
  it('flush com alteração salva uma vez', async () => {
    const salvos = [];
    const r = criarRascunho({ id: 1 }, { salvar: async (d) => { salvos.push({ ...d }); }, ms: 10000 });
    r.set('km', 5);
    await r.flush();
    await r.flush();
    expect(salvos).toEqual([{ id: 1, km: 5 }]);
  });
  it('inativo (consulta) nunca salva', async () => {
    let n = 0;
    const r = criarRascunho({ id: 1 }, { salvar: async () => { n++; }, ms: 10, ativo: false });
    r.set('km', 5);
    await r.flush();
    expect(n).toBe(0);
    expect(r.dados.km).toBe(5);
  });
  it('salva sozinho após o intervalo', async () => {
    let n = 0;
    const r = criarRascunho({ id: 1 }, { salvar: async () => { n++; }, ms: 5 });
    r.set('a', 1);
    await new Promise((ok) => setTimeout(ok, 30));
    expect(n).toBe(1);
  });
});
