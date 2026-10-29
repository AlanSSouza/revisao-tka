import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Módulos que os testes não importam (pdf.js, telas) também precisam ao menos compilar.
const pasta = join(import.meta.dirname, '..', 'app', 'js');
const arquivos = readdirSync(pasta, { recursive: true }).filter((f) => f.endsWith('.js'));

describe('sintaxe dos módulos do app', () => {
  it.each(arquivos)('%s', (f) => {
    const r = spawnSync(process.execPath, ['--check', join(pasta, f)], { encoding: 'utf8' });
    expect(r.stderr).toBe('');
  });
});
