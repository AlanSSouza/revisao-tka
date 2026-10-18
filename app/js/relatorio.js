// Números dos relatórios (geral e por placa), calculados a partir das tabelas locais. Sem DOM.
import {
  STATUS, GRAVIDADES, SITUACOES_ABERTAS, CAUSAS, CONSTATACOES, DOMINIOS, TAREFAS_PROVA,
  verdadeiro, primeiroValor, grupoCausa, dominioOperacao, provaIniciada,
} from './modelo.js';

const ativos = (lista = []) => lista.filter((r) => !verdadeiro(r.removido));
const porInicio = (a, b) => String(a.inicio).localeCompare(String(b.inicio));

export function diasEntre(de, ate) {
  if (!de || !ate) return null;
  const d = (s) => new Date(String(s).slice(0, 10) + 'T12:00:00Z');
  return Math.round((d(ate) - d(de)) / 864e5);
}

// Conta por chave e devolve [{rotulo, valor}] do maior para o menor.
function contar(lista, chave) {
  const m = new Map();
  for (const x of lista) {
    const k = x[chave] || 'Não informado';
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m].map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo));
}

const abertaGarantia = (o) => SITUACOES_ABERTAS.includes(o.situacao);
const resolvida = (o) => String(o.situacao || '').startsWith('resolvido');

function preparar(d) {
  const visitas = ativos(d.Visitas);
  const idsVisita = new Set(visitas.map((v) => v.id));
  const concluidas = visitas.filter((v) => verdadeiro(v.concluida)).sort(porInicio);
  const ultima = {};
  for (const v of concluidas) ultima[v.placa] = v;
  const treinamentos = ativos(d.Treinamentos).filter((t) => idsVisita.has(t.visita_id));
  const idsTrein = new Set(treinamentos.map((t) => t.id));
  return {
    equipamentos: ativos(d.Equipamentos),
    visitas, concluidas, ultima,
    ocorrencias: ativos(d.Ocorrencias).filter((o) => !o.visita_id || idsVisita.has(o.visita_id)),
    equipe: ativos(d.Equipe).filter((e) => idsVisita.has(e.visita_id)),
    treinamentos,
    participantes: ativos(d.TreinamentoParticipantes).filter((p) => idsTrein.has(p.treinamento_id)),
    midias: ativos(d.Midias).filter((m) => m.tipo !== 'assinatura'),
    alteracoes: ativos(d.Alteracoes),
  };
}

const horas = (o) => Number(o.horas_paradas) || 0;

function respaldo(p) {
  const oc = p.ocorrencias;
  const grupos = { equipamento: 0, operacao: 0, outras: 0, investigar: 0 };
  const horasParadas = { total: 0, equipamento: 0, operacao: 0, outras: 0, investigar: 0, ocorrenciasQueImpediram: 0 };
  for (const o of oc) {
    const g = grupoCausa(o.causa);
    grupos[g]++;
    horasParadas[g] += horas(o);
    horasParadas.total += horas(o);
    if (verdadeiro(o.impediu_operacao)) horasParadas.ocorrenciasQueImpediram++;
  }
  // Domínio: a prova mais recente de cada máquina.
  const comProva = p.visitas.filter(provaIniciada).sort(porInicio);
  const ultimaProva = {};
  for (const v of comProva) ultimaProva[v.placa] = v;
  const dominioPlaca = Object.fromEntries(Object.entries(ultimaProva).map(([k, v]) => [k, dominioOperacao(v)]));
  return {
    porCausa: CAUSAS.map((c) => ({ v: c.v, rotulo: c.curto, valor: oc.filter((o) => (o.causa || 'investigar') === c.v).length })),
    grupos,
    porConstatacao: CONSTATACOES.map((c) => ({ v: c.v, rotulo: c.t, valor: oc.filter((o) => o.constatacao === c.v).length })),
    parecer: {
      concorda: oc.filter((o) => o.parecer_tka === 'concorda').length,
      discorda: oc.filter((o) => o.parecer_tka === 'discorda').length,
      sem: oc.filter((o) => !o.parecer_tka).length,
    },
    horasParadas,
    provas: comProva.length,
    porDominio: DOMINIOS.map((d) => ({ v: d.v, rotulo: d.curto, valor: Object.values(dominioPlaca).filter((x) => x === d.v).length })),
    dificuldades: TAREFAS_PROVA.map((t) => {
      const ajuda = comProva.filter((v) => v[t.k] === 'ajuda').length;
      const nao = comProva.filter((v) => v[t.k] === 'nao').length;
      return { k: t.k, rotulo: t.t, ajuda, nao, valor: ajuda + nao };
    }).sort((a, b) => b.valor - a.valor),
    dominioPlaca,
  };
}

const unicos = (lista) => new Set(lista.map((p) => String(p.matricula || p.nome).trim()).filter(Boolean)).size;

export function resumoGeral(d, hoje) {
  const p = preparar(d);
  const visitadas = new Set(p.concluidas.map((v) => v.placa));
  const eqs = p.equipamentos;

  const cidades = new Map();
  for (const e of eqs) {
    const c = cidades.get(e.cidade) || { rotulo: e.cidade || 'Sem cidade', total: 0, visitadas: 0 };
    c.total++;
    if (visitadas.has(e.id)) c.visitadas++;
    cidades.set(e.cidade, c);
  }

  const status = STATUS.map((s) => ({ v: s.v, rotulo: s.t, valor: eqs.filter((e) => p.ultima[e.id]?.status === s.v).length }));
  status.push({ v: 'nao_visitada', rotulo: 'Não visitada', valor: eqs.filter((e) => !p.ultima[e.id]).length });

  const abertas = p.ocorrencias.filter(abertaGarantia);
  const lista = abertas.map((o) => ({
    id: o.id, placa: o.placa, tipo: o.tipo, componente: o.componente, situacao: o.situacao,
    protocolo: o.protocolo || '', abertura: o.abertura, dias: diasEntre(o.abertura || o.atualizado_em, hoje),
  })).sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1));

  const linhas = eqs.map((e) => {
    const oc = p.ocorrencias.filter((o) => o.placa === e.id);
    return {
      placa: e.id, cidade: e.cidade || '', serie: e.serie_munck || '',
      km: primeiroValor(e.km_atual_campo, e.km_atual), horimetro: primeiroValor(e.horimetro_atual),
      status: p.ultima[e.id]?.status || '', ultimaVisita: p.ultima[e.id]?.inicio || '',
      visitas: p.concluidas.filter((v) => v.placa === e.id).length,
      ocorrencias: oc.length, abertas: oc.filter(abertaGarantia).length,
    };
  }).sort((a, b) => a.cidade.localeCompare(b.cidade) || a.placa.localeCompare(b.placa));

  const rs = respaldo(p);
  for (const l of linhas) l.dominio = rs.dominioPlaca[l.placa] || '';
  const { dominioPlaca, ...extra } = rs;

  return {
    ...extra,
    total: eqs.length,
    visitadas: eqs.filter((e) => visitadas.has(e.id)).length,
    porCidade: [...cidades.values()].sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo)),
    status,
    ocorrencias: p.ocorrencias.length,
    porTipo: contar(p.ocorrencias, 'tipo'),
    porComponente: contar(p.ocorrencias, 'componente'),
    porGravidade: GRAVIDADES.map((g) => ({ v: g.v, rotulo: g.t, valor: p.ocorrencias.filter((o) => o.gravidade === g.v).length })),
    garantias: { abertas: abertas.length, resolvidas: p.ocorrencias.filter(resolvida).length, lista },
    treinamentos: p.treinamentos.length,
    pessoasTreinadas: unicos(p.participantes),
    pessoasEquipe: unicos(p.equipe),
    linhas,
  };
}

export function relatorioPlaca(d, placa, hoje) {
  const p = preparar(d);
  const eq = p.equipamentos.find((e) => e.id === placa) || null;
  const midias = p.midias.filter((m) => m.placa === placa);
  const ocorr = p.ocorrencias.filter((o) => o.placa === placa);
  const visitas = p.visitas.filter((v) => v.placa === placa).sort(porInicio).map((v) => ({
    ...v,
    dominio: dominioOperacao(v),
    ocorrencias: ocorr.filter((o) => o.visita_id === v.id).map((o) => ({ ...o, midias: midias.filter((m) => m.ocorrencia_id === o.id) })),
    midiasVisita: midias.filter((m) => m.visita_id === v.id && !m.ocorrencia_id),
    equipe: p.equipe.filter((e) => e.visita_id === v.id),
    treinamentos: p.treinamentos.filter((t) => t.visita_id === v.id)
      .map((t) => ({ ...t, participantes: p.participantes.filter((x) => x.treinamento_id === t.id) })),
  }));
  return {
    eq, visitas,
    km: eq ? primeiroValor(eq.km_atual_campo, eq.km_atual) : null,
    horimetro: eq ? primeiroValor(eq.horimetro_atual) : null,
    status: p.ultima[placa]?.status || '',
    ocorrencias: ocorr,
    garantiasAbertas: ocorr.filter(abertaGarantia).map((o) => ({ ...o, dias: diasEntre(o.abertura || o.atualizado_em, hoje) })),
    alteracoes: p.alteracoes.filter((a) => a.placa === placa),
    horasParadas: ocorr.reduce((s, o) => s + horas(o), 0),
    totalFotos: midias.filter((m) => m.tipo !== 'video').length,
    totalVideos: midias.filter((m) => m.tipo === 'video').length,
  };
}
