import { describe, it, expect } from 'vitest';
import { resumoGeral, relatorioPlaca, diasEntre } from '../app/js/relatorio.js';

const base = () => ({
  Equipamentos: [
    { id: 'AAA1A11', cidade: 'Itajubá', serie_munck: 'S1', km_atual: 1000, km_atual_campo: 1200, horimetro_atual: 50 },
    { id: 'BBB2B22', cidade: 'Itajubá', serie_munck: '', km_atual: 2000, km_atual_campo: '', horimetro_atual: '' },
    { id: 'CCC3C33', cidade: 'Lavras', serie_munck: '', km_atual: 3000 },
  ],
  Visitas: [
    { id: 'v1', placa: 'AAA1A11', inicio: '2026-10-20T10:00:00Z', status: 'normal', concluida: 'true' },
    { id: 'v2', placa: 'AAA1A11', inicio: '2026-10-22T10:00:00Z', status: 'parado', concluida: 'true', km: 1200, horimetro: 50 },
    { id: 'v3', placa: 'BBB2B22', inicio: '2026-10-21T10:00:00Z', status: 'restricao', concluida: 'false' },
    { id: 'v4', placa: 'CCC3C33', inicio: '2026-10-21T10:00:00Z', status: 'normal', concluida: 'true', removido: 'true' },
  ],
  Ocorrencias: [
    { id: 'o1', visita_id: 'v1', placa: 'AAA1A11', tipo: 'Vazamento', componente: 'Bomba', gravidade: 'critica', situacao: 'garantia', abertura: '2026-10-20', protocolo: 'P-1' },
    { id: 'o2', visita_id: 'v2', placa: 'AAA1A11', tipo: 'Vazamento', componente: 'Lança', gravidade: 'leve', situacao: 'resolvido_visita', abertura: '2026-10-22' },
    { id: 'o3', visita_id: 'v3', placa: 'BBB2B22', tipo: 'Ruído', componente: 'Bomba', gravidade: 'moderada', situacao: 'aguardando_peca', abertura: '2026-10-21' },
    { id: 'o4', visita_id: 'v3', placa: 'BBB2B22', tipo: 'Ruído', componente: 'Bomba', gravidade: 'leve', situacao: 'garantia', removido: 'true' },
  ],
  Equipe: [
    { id: 'e1', visita_id: 'v1', matricula: '10', nome: 'Ana', papel: 'motorista_operador' },
    { id: 'e2', visita_id: 'v2', matricula: '10', nome: 'Ana', papel: 'motorista_operador' },
    { id: 'e3', visita_id: 'v3', matricula: '20', nome: 'Beto', papel: 'operador' },
  ],
  Treinamentos: [
    { id: 't1', visita_id: 'v1', assunto: 'Inspeção diária NR12', duracao_min: 20 },
    { id: 't2', visita_id: 'v4', assunto: 'Limites de carga', duracao_min: 10 },
  ],
  TreinamentoParticipantes: [
    { id: 'p1', treinamento_id: 't1', matricula: '10', nome: 'Ana' },
    { id: 'p2', treinamento_id: 't1', matricula: '30', nome: 'Caio' },
  ],
  Midias: [
    { id: 'm1', visita_id: 'v1', ocorrencia_id: 'o1', placa: 'AAA1A11', tipo: 'foto', link: 'x', drive_id: 'd1' },
    { id: 'm2', visita_id: 'v2', ocorrencia_id: '', placa: 'AAA1A11', tipo: 'video', link: '', drive_id: '' },
    { id: 'm3', visita_id: 'v1', ocorrencia_id: '', placa: 'AAA1A11', tipo: 'assinatura' },
  ],
  Alteracoes: [{ id: 'a1', placa: 'AAA1A11', campo: 'serie_munck', valor_original: '', valor_novo: 'S1' }],
});

describe('diasEntre', () => {
  it('conta dias corridos entre datas ISO', () => {
    expect(diasEntre('2026-10-20', '2026-10-25')).toBe(5);
    expect(diasEntre('2026-10-20T23:00:00Z', '2026-10-21')).toBe(1);
    expect(diasEntre('', '2026-10-21')).toBe(null);
  });
});

describe('resumoGeral', () => {
  const r = resumoGeral(base(), '2026-10-25');

  it('progresso conta só visitas concluídas e não removidas', () => {
    expect(r.total).toBe(3);
    expect(r.visitadas).toBe(1);
    expect(r.porCidade).toEqual([
      { rotulo: 'Itajubá', total: 2, visitadas: 1 },
      { rotulo: 'Lavras', total: 1, visitadas: 0 },
    ]);
  });

  it('status do parque vem da última visita concluída; sem visita conta à parte', () => {
    expect(r.status).toEqual([
      { v: 'normal', rotulo: 'Normal', valor: 0 },
      { v: 'restricao', rotulo: 'Com restrição', valor: 0 },
      { v: 'parado', rotulo: 'Parado', valor: 1 },
      { v: 'nao_visitada', rotulo: 'Não visitada', valor: 2 },
    ]);
  });

  it('ocorrências por tipo e componente em ordem decrescente, ignorando removidas', () => {
    expect(r.ocorrencias).toBe(3);
    expect(r.porTipo).toEqual([{ rotulo: 'Vazamento', valor: 2 }, { rotulo: 'Ruído', valor: 1 }]);
    expect(r.porComponente[0]).toEqual({ rotulo: 'Bomba', valor: 2 });
    expect(r.porGravidade.map((g) => g.valor)).toEqual([1, 1, 1]);
  });

  it('garantias: abertas com dias em aberto, mais antigas primeiro', () => {
    expect(r.garantias.abertas).toBe(2);
    expect(r.garantias.resolvidas).toBe(1);
    expect(r.garantias.lista.map((g) => [g.placa, g.dias, g.protocolo])).toEqual([
      ['AAA1A11', 5, 'P-1'], ['BBB2B22', 4, ''],
    ]);
  });

  it('treinamentos e pessoas', () => {
    expect(r.treinamentos).toBe(1);
    expect(r.pessoasTreinadas).toBe(2);
    expect(r.pessoasEquipe).toBe(2);
  });

  it('linha por placa com KM de campo, série e ocorrências abertas', () => {
    const a = r.linhas.find((l) => l.placa === 'AAA1A11');
    expect(a).toMatchObject({ cidade: 'Itajubá', serie: 'S1', km: 1200, horimetro: 50, status: 'parado', visitas: 2, ocorrencias: 2, abertas: 1 });
    expect(a.ultimaVisita).toBe('2026-10-22T10:00:00Z');
    const b = r.linhas.find((l) => l.placa === 'BBB2B22');
    expect(b).toMatchObject({ km: 2000, status: '', visitas: 0, abertas: 1 });
  });
});

describe('relatorioPlaca', () => {
  const r = relatorioPlaca(base(), 'AAA1A11', '2026-10-25');

  it('visitas em ordem cronológica com ocorrências, equipe, mídias e treinamentos', () => {
    expect(r.eq.id).toBe('AAA1A11');
    expect(r.visitas.map((v) => v.id)).toEqual(['v1', 'v2']);
    const v1 = r.visitas[0];
    expect(v1.ocorrencias.map((o) => o.id)).toEqual(['o1']);
    expect(v1.ocorrencias[0].midias.map((m) => m.id)).toEqual(['m1']);
    expect(v1.equipe.map((e) => e.nome)).toEqual(['Ana']);
    expect(v1.treinamentos[0].participantes.map((p) => p.nome)).toEqual(['Ana', 'Caio']);
    expect(v1.midiasVisita).toEqual([]);
    expect(r.visitas[1].midiasVisita.map((m) => m.id)).toEqual(['m2']);
  });

  it('resume garantias abertas, KM e alterações cadastrais', () => {
    expect(r.km).toBe(1200);
    expect(r.garantiasAbertas.map((o) => [o.id, o.dias])).toEqual([['o1', 5]]);
    expect(r.alteracoes).toHaveLength(1);
    expect(r.totalFotos).toBe(1);
    expect(r.totalVideos).toBe(1);
  });
});
