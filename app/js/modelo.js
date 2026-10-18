// Regras puras do domínio (sem DOM nem IndexedDB).

export const STATUS = [
  { v: 'normal', t: 'Normal', cor: 'verde' },
  { v: 'restricao', t: 'Com restrição', cor: 'amarelo' },
  { v: 'parado', t: 'Parado', cor: 'vermelho' },
];

export const PAPEIS = [
  { v: 'motorista_operador', t: 'Motorista-operador' },
  { v: 'motorista', t: 'Motorista' },
  { v: 'operador', t: 'Operador' },
  { v: 'encarregado', t: 'Encarregado' },
  { v: 'eletricista', t: 'Eletricista' },
  { v: 'sesmt', t: 'SESMT' },
  { v: 'outro', t: 'Outro' },
];

export const TIPOS_OCORRENCIA = ['Vazamento', 'Êmbolo solto', 'Risco/dano no cilindro', 'Lentidão/perda de força',
  'Ruído', 'Elétrico/controle remoto', 'Sensores NR12', 'Estrutural', 'Outro'];

export const COMPONENTES = ['Cilindro de elevação', 'Cilindro de extensão', 'Cilindro do estabilizador',
  'Sistema de giro', 'Bomba', 'Comando/válvulas', 'Mangueira/conexão', 'Tanque/reservatório', 'Lança',
  'Sapata/estabilizador', 'Controle remoto', 'Outro'];

export const GRAVIDADES = [
  { v: 'leve', t: 'Leve' },
  { v: 'moderada', t: 'Moderada' },
  { v: 'critica', t: 'Crítica' },
];

export const SITUACOES = [
  { v: 'resolvido_visita', t: 'Resolvido na visita' },
  { v: 'garantia', t: 'Garantia aberta' },
  { v: 'aguardando_peca', t: 'Aguardando peça' },
  { v: 'aguardando_fabrica', t: 'Aguardando retorno da fábrica' },
  { v: 'resolvido_depois', t: 'Resolvido posteriormente' },
];
export const SITUACOES_ABERTAS = ['garantia', 'aguardando_peca', 'aguardando_fabrica'];

// Respaldo: o que foi alegado × o que se constatou, e a causa provável com parecer da TKA.
export const CONSTATACOES = [
  { v: 'confirmado', t: 'Confirmado' },
  { v: 'parcial', t: 'Parcialmente' },
  { v: 'nao_reproduzido', t: 'Não reproduzido' },
];

export const CAUSAS = [
  { v: 'defeito', t: 'Defeito do equipamento', curto: 'Defeito do equip.' },
  { v: 'operacao', t: 'Operação inadequada', curto: 'Operação inadequada' },
  { v: 'conhecimento', t: 'Desconhecimento do equipamento/kit NR12', curto: 'Desconhecimento/NR12' },
  { v: 'desgaste', t: 'Desgaste ou falta de manutenção', curto: 'Desgaste/manutenção' },
  { v: 'externo', t: 'Dano externo', curto: 'Dano externo' },
  { v: 'investigar', t: 'A investigar', curto: 'A investigar' },
];

export const PARECERES = [
  { v: 'concorda', t: 'Concorda' },
  { v: 'discorda', t: 'Discorda' },
];

export function grupoCausa(causa) {
  if (causa === 'defeito') return 'equipamento';
  if (causa === 'operacao' || causa === 'conhecimento') return 'operacao';
  if (!causa || causa === 'investigar') return 'investigar';
  return 'outras';
}

// Prova prática: o operador demonstra cada tarefa; o domínio sai das respostas.
export const TAREFAS_PROVA = [
  { k: 'prova_inspecao', t: 'Inspeção diária NR12' },
  { k: 'prova_patolamento', t: 'Patolamento (estabilizadores)' },
  { k: 'prova_controle', t: 'Uso do controle remoto' },
  { k: 'prova_diagrama', t: 'Leitura do diagrama de carga' },
  { k: 'prova_alarmes', t: 'Alarmes e bloqueios do kit de segurança' },
  { k: 'prova_emergencia', t: 'Procedimento de emergência' },
];

export const RESULTADOS_PROVA = [
  { v: 'executou', t: 'Executou', cor: 'verde' },
  { v: 'ajuda', t: 'Com ajuda', cor: 'amarelo' },
  { v: 'nao', t: 'Não executou', cor: 'vermelho' },
];

export const DOMINIOS = [
  { v: 'adequado', t: 'Opera com domínio', curto: 'Com domínio' },
  { v: 'parcial', t: 'Opera com dificuldade', curto: 'Com dificuldade' },
  { v: 'insuficiente', t: 'Não domina a operação', curto: 'Não domina' },
];

export const provaIniciada = (v) => TAREFAS_PROVA.some((t) => v?.[t.k]);

export function dominioOperacao(v) {
  const r = TAREFAS_PROVA.map((t) => v?.[t.k]).filter(Boolean);
  if (!r.length) return '';
  if (r.includes('nao')) return 'insuficiente';
  if (r.includes('ajuda')) return 'parcial';
  return 'adequado';
}

export const MOTIVOS_REAGENDAR = ['Não localizado', 'Em serviço distante', 'Equipamento em manutenção', 'Outro'];

export const ASSUNTOS_TREINAMENTO = ['Operação do estabilizador', 'Inspeção diária NR12',
  'Operação do controle remoto', 'Limites de carga', 'Outro'];

const CAMPOS_SISTEMA = ['id', 'atualizado_em', 'atualizado_por'];

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const agoraISO = () => new Date().toISOString();

export function hojeLocal(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const verdadeiro = (v) => v === true || v === 'true' || v === 'TRUE';

export function parseNumeroBR(txt) {
  if (typeof txt === 'number') return Number.isFinite(txt) ? txt : null;
  let s = String(txt ?? '').trim().replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const formatarNumero = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('pt-BR'));

export function alertaKm(novo, anterior) {
  if (novo == null || anterior == null || anterior === '') return null;
  if (Number(novo) < Number(anterior)) return `KM menor que o último registrado (${formatarNumero(anterior)})`;
  return null;
}

export function novaVisita(placa, autor, gps = {}) {
  return {
    id: uuid(), placa, inicio: agoraISO(), fim: '',
    lat: gps.lat ?? null, lng: gps.lng ?? null, precisao: gps.precisao ?? null,
    autor, engenheiro: '', status: '', km: null, horimetro: null, serie_munck: '', observacoes: '',
    concluida: false,
  };
}

export function novaOcorrencia(visita) {
  return {
    id: uuid(), visita_id: visita.id, placa: visita.placa, tipo: '', componente: '', gravidade: '',
    relato: '', constatacao: '', causa: 'investigar', parecer_tka: '', impediu_operacao: '', horas_paradas: null,
    descricao: '', situacao: '', protocolo: '', abertura: '', previsao: '', solucao: '',
    resolvido_em: '', resolvido_por: '',
  };
}

export function novoMembro(visita, pessoa, papel) {
  if (!PAPEIS.some((p) => p.v === papel)) throw new Error('Papel inválido: ' + papel);
  const matricula = String(pessoa.matricula ?? '').trim();
  return {
    id: uuid(), visita_id: visita.id, matricula, nome: String(pessoa.nome ?? '').trim(), papel,
    funcao: String(pessoa.funcao ?? '').trim(), avulso: !pessoa.id,
  };
}

export function resumoParque(equipamentos, visitas, roteiro, hoje) {
  const visitadas = new Set(visitas.filter((v) => verdadeiro(v.concluida)).map((v) => v.placa));
  const ativas = roteiro.filter((r) => r.situacao !== 'reagendada');
  const agendadas = new Set(ativas.filter((r) => r.data >= hoje).map((r) => r.placa));
  return {
    total: equipamentos.length,
    visitadas: equipamentos.filter((e) => visitadas.has(e.id)).length,
    hoje: ativas.filter((r) => r.data === hoje).length,
    semData: equipamentos.filter((e) => !visitadas.has(e.id) && !agendadas.has(e.id)).length,
  };
}

export function alteracoesCadastro(original, editado, autor) {
  const placa = original.cod_placa || original.id;
  return Object.keys(editado)
    .filter((c) => !CAMPOS_SISTEMA.includes(c))
    .filter((c) => String(original[c] ?? '') !== String(editado[c] ?? ''))
    .map((campo) => ({
      id: uuid(), placa, campo,
      valor_original: original[campo] ?? '', valor_novo: editado[campo] ?? '',
      atualizado_por: autor,
    }));
}

// Primeiro valor preenchido (ignora '', null e undefined; mantém zero).
export function primeiroValor(...valores) {
  const v = valores.find((x) => x !== '' && x !== null && x !== undefined);
  return v === undefined ? null : v;
}

// Link do ponto GPS no Google Maps (abre o app no celular ou o navegador no computador).
export function linkCoordenadas(lat, lng) {
  if (lat === '' || lng === '' || lat == null || lng == null) return null;
  const a = Number(lat), b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${a.toFixed(6)},${b.toFixed(6)}`;
}
