// Exclusão de registros lançados por engano: marca como removido (a linha fica na planilha) e leva junto o que depende dele.
import * as db from './db.js';
import { verdadeiro } from './modelo.js';

const ativos = (lista) => lista.filter((r) => !verdadeiro(r.removido));

async function marcar(tabela, registros, opts) {
  for (const r of ativos(registros)) await db.salvar(tabela, { ...r, removido: true }, opts);
}

export async function excluirTreinamento(id, opts) {
  const t = await db.get('Treinamentos', id);
  if (!t) return;
  await marcar('TreinamentoParticipantes', await db.por('TreinamentoParticipantes', 'treinamento_id', id), opts);
  await marcar('Treinamentos', [t], opts);
}

// Só visitas em andamento: uma visita concluída é registro de respaldo e não pode sumir.
export async function excluirVisita(id, opts) {
  const v = await db.get('Visitas', id);
  if (!v) return;
  if (verdadeiro(v.concluida)) throw new Error('Visita concluída não pode ser excluída.');
  for (const t of ativos(await db.por('Treinamentos', 'visita_id', id))) await excluirTreinamento(t.id, opts);
  for (const tabela of ['Equipe', 'Ocorrencias', 'Midias']) await marcar(tabela, await db.por(tabela, 'visita_id', id), opts);
  await marcar('Visitas', [v], opts);
}
