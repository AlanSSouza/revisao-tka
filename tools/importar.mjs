import XLSX from 'xlsx';
import { mkdirSync, writeFileSync } from 'node:fs';
import { linhasParaEquipamentos, linhasParaFuncionarios } from './transform.mjs';

const ler = (arq) => {
  const wb = XLSX.readFile(arq);
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
};

mkdirSync('data', { recursive: true });
const equipamentos = linhasParaEquipamentos(ler('Mapa equipamentos TKA.xlsx'));
const funcionarios = linhasParaFuncionarios(ler('ATIVOS GERAL.xlsx'));
writeFileSync('data/equipamentos.json', JSON.stringify(equipamentos, null, 1));
writeFileSync('data/funcionarios.json', JSON.stringify(funcionarios));
console.log(`${equipamentos.length} equipamentos`);
console.log(`${funcionarios.length} funcionários ativos`);
