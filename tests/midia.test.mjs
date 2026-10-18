import { describe, it, expect } from 'vitest';
import { dimensoesAlvo, avisoVideo, nomeArquivo } from '../app/js/midia.js';

describe('dimensoesAlvo', () => {
  it('paisagem grande reduz para 1600', () => expect(dimensoesAlvo(4032, 3024)).toEqual({ w: 1600, h: 1200 }));
  it('pequena fica igual', () => expect(dimensoesAlvo(800, 600)).toEqual({ w: 800, h: 600 }));
  it('retrato grande reduz para 1600 de altura', () => expect(dimensoesAlvo(3024, 4032)).toEqual({ w: 1200, h: 1600 }));
});

describe('avisoVideo', () => {
  it('longo avisa', () => expect(avisoVideo({ duracao: 90, tamanho: 5e7 })).not.toBeNull());
  it('pesado avisa', () => expect(avisoVideo({ duracao: 30, tamanho: 9e7 })).not.toBeNull());
  it('normal não avisa', () => expect(avisoVideo({ duracao: 30, tamanho: 5e7 })).toBeNull());
});

describe('nomeArquivo', () => {
  it('tipo_hora_id8.ext', () => {
    const d = new Date(2026, 9, 20, 9, 52, 7);
    expect(nomeArquivo('foto', 'abcdef12-3456', 'jpg', d)).toBe('foto_095207_abcdef12.jpg');
  });
});
