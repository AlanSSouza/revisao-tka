// Estrutura da planilha "Revisão TKA – Base" e operações de leitura/gravação.

var META = ['removido', 'atualizado_em', 'atualizado_por'];

var TABELAS = {
  Equipamentos: ['id', 'cod_placa', 'cod_renavam', 'cod_chassi', 'cidade', 'lotacao', 'tipo_veiculo', 'estado',
    'centro_custo', 'des_cor', 'ano_modelo', 'ano_fabricacao', 'des_mod_veic', 'marca_modelo', 'km_atual',
    'porte_veiculo', 'status_veiculo', 'setor_veiculo', 'serie_munck', 'horimetro_atual', 'km_atual_campo',
    'local_previsto'].concat(META),
  Alteracoes: ['id', 'placa', 'campo', 'valor_original', 'valor_novo'].concat(META),
  Funcionarios: ['id', 'matricula', 'nome', 'funcao', 'centro_custo', 'filial'].concat(META),
  Roteiro: ['id', 'data', 'ordem', 'placa', 'local_previsto', 'situacao', 'motivo'].concat(META),
  Visitas: ['id', 'placa', 'inicio', 'fim', 'lat', 'lng', 'precisao', 'autor', 'engenheiro', 'status', 'km',
    'horimetro', 'serie_munck', 'observacoes', 'concluida'].concat(META),
  Equipe: ['id', 'visita_id', 'matricula', 'nome', 'papel', 'avulso'].concat(META),
  Ocorrencias: ['id', 'visita_id', 'placa', 'tipo', 'componente', 'gravidade', 'descricao', 'situacao', 'protocolo',
    'abertura', 'previsao', 'solucao', 'resolvido_em', 'resolvido_por'].concat(META),
  Treinamentos: ['id', 'visita_id', 'assunto', 'ministrante', 'duracao_min', 'observacoes'].concat(META),
  TreinamentoParticipantes: ['id', 'treinamento_id', 'matricula', 'nome', 'assinatura_midia_id'].concat(META),
  Midias: ['id', 'visita_id', 'ocorrencia_id', 'placa', 'tipo', 'legenda', 'nome_arquivo', 'mime', 'tamanho',
    'drive_id', 'link', 'criado_em', 'enviado_em'].concat(META)
};

// Colunas mantidas como número; as demais ficam como texto puro (o Sheets não converte datas nem matrículas).
var NUMERICOS = ['km_atual', 'horimetro_atual', 'km_atual_campo', 'ordem', 'lat', 'lng', 'precisao', 'km',
  'horimetro', 'duracao_min', 'tamanho', 'ano_modelo', 'ano_fabricacao'];

function prop(k) { return PropertiesService.getScriptProperties().getProperty(k); }

function planilha() { return SpreadsheetApp.openById(prop('PLANILHA_ID')); }

function setup() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PLANILHA_ID')) {
    props.setProperty('PLANILHA_ID', SpreadsheetApp.create('Revisão TKA – Base').getId());
  }
  if (!props.getProperty('PASTA_ID')) {
    props.setProperty('PASTA_ID', DriveApp.createFolder('Revisão TKA').getId());
  }
  var ss = planilha();
  Object.keys(TABELAS).forEach(function (nome) {
    var sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
    var cab = TABELAS[nome];
    var atual = sh.getLastRow() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    var faltando = cab.filter(function (c) { return atual.indexOf(c) < 0; });
    if (!faltando.length) return;
    var novo = atual.filter(String).concat(faltando);
    sh.getRange(1, 1, 1, novo.length).setValues([novo]);
    sh.getRange(1, 1, 1, novo.length).setFontWeight('bold');
    sh.setFrozenRows(1);
    novo.forEach(function (c, i) {
      if (NUMERICOS.indexOf(c) < 0) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    });
  });
  ss.getSheets().forEach(function (sh) {
    if (!TABELAS[sh.getName()] && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
}

function aba(nome) {
  if (!TABELAS.hasOwnProperty(nome)) throw erroParam('tabela inválida: ' + nome);
  return planilha().getSheetByName(nome);
}

function valorLido(v) {
  return v instanceof Date ? v.toISOString() : v;
}

function lerTabela(nome) {
  var sh = aba(nome);
  if (sh.getLastRow() < 2) return [];
  var vals = sh.getDataRange().getValues();
  var cab = vals[0];
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    if (vals[i][0] === '' || vals[i][0] == null) continue;
    var o = {};
    for (var j = 0; j < cab.length; j++) if (cab[j]) o[cab[j]] = valorLido(vals[i][j]);
    out.push(o);
  }
  return out;
}

function valorGravado(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function upsertRegistros(nome, registros) {
  var sh = aba(nome);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var vals = sh.getDataRange().getValues();
    var cab = vals[0];
    var linhaDoId = {};
    for (var i = 1; i < vals.length; i++) if (vals[i][0] !== '') linhaDoId[String(vals[i][0])] = i;
    var novos = [];
    registros.forEach(function (reg) {
      if (!reg || reg.id === undefined || reg.id === '') throw erroParam('registro sem id');
      var idx = linhaDoId[String(reg.id)];
      if (idx === undefined) {
        var linhaNova = cab.map(function (c) { return c in reg ? valorGravado(reg[c]) : ''; });
        linhaDoId[String(reg.id)] = -1 - novos.length;
        novos.push(linhaNova);
      } else if (idx < 0) {
        var pendente = novos[-1 - idx];
        cab.forEach(function (c, j) { if (c in reg) pendente[j] = valorGravado(reg[c]); });
      } else {
        var linha = cab.map(function (c, j) { return c in reg ? valorGravado(reg[c]) : vals[idx][j]; });
        sh.getRange(idx + 1, 1, 1, cab.length).setValues([linha]);
        vals[idx] = linha;
      }
    });
    if (novos.length) sh.getRange(vals.length + 1, 1, novos.length, cab.length).setValues(novos);
    return registros.length;
  } finally {
    lock.releaseLock();
  }
}

function limparTabela(nome) {
  var sh = aba(nome);
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
}
