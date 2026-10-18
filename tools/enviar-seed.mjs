// Carrega equipamentos e funcionários (data/*.json) na Planilha via Apps Script.
// Uso: node tools/enviar-seed.mjs <URL_DO_WEB_APP> <SENHA_REGISTRO>
import { readFileSync } from 'node:fs';

const [url, senha] = process.argv.slice(2);
if (!url || !senha) {
  console.error('Uso: node tools/enviar-seed.mjs <URL_DO_WEB_APP> <SENHA_REGISTRO>');
  process.exit(1);
}

async function chamar(corpo) {
  const r = await fetch(url, { method: 'POST', body: JSON.stringify({ senha, autor: 'carga inicial', ...corpo }), redirect: 'follow' });
  const j = await r.json();
  if (!j.ok) throw new Error(`${corpo.acao}: ${j.erro} ${j.msg || ''}`);
  return j;
}

const { dados } = await chamar({ acao: 'pull' });
const equipamentos = JSON.parse(readFileSync('data/equipamentos.json', 'utf8'));
const funcionarios = JSON.parse(readFileSync('data/funcionarios.json', 'utf8'));

if (dados.Equipamentos.length) {
  console.log(`Equipamentos já carregados (${dados.Equipamentos.length}); não substituí para não perder correções.`);
} else {
  const r = await chamar({ acao: 'seed', tabela: 'Equipamentos', registros: equipamentos, substituir: true });
  console.log(`${r.gravados} equipamentos carregados.`);
}

for (let i = 0; i < funcionarios.length; i += 500) {
  const r = await chamar({ acao: 'seed', tabela: 'Funcionarios', registros: funcionarios.slice(i, i + 500), substituir: i === 0 });
  console.log(`funcionários ${i + 1}–${i + r.gravados}`);
}
console.log('Carga concluída.');
