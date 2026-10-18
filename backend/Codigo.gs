// Web App: ponto de entrada do app. Corpo POST = JSON {acao, senha, autor, ...}.

function erroParam(msg) { var e = new Error(msg); e.param = true; return e; }

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function papelDaSenha(senha) {
  if (!senha) return null;
  if (senha === prop('SENHA_REGISTRO')) return 'registro';
  if (senha === prop('SENHA_CONSULTA')) return 'consulta';
  return null;
}

function acoes() {
  return {
    login: { run: function (req, papel) { return { papel: papel }; } },
    pull: { run: acaoPull },
    upsert: { escrita: true, run: acaoUpsert },
    seed: { escrita: true, run: acaoSeed },
    uploadInicio: { escrita: true, run: acaoUploadInicio },
    uploadPedaco: { escrita: true, run: acaoUploadPedaco },
    uploadStatus: { escrita: true, run: acaoUploadStatus }
  };
}

function acaoPull(req, papel) {
  var dados = {};
  Object.keys(TABELAS).forEach(function (nome) {
    if (nome === 'Funcionarios' && papel !== 'registro') return;
    dados[nome] = lerTabela(nome);
  });
  return { dados: dados, servidor_em: new Date().toISOString() };
}

function acaoUpsert(req) {
  if (!Array.isArray(req.registros)) throw erroParam('registros');
  return { gravados: upsertRegistros(req.tabela, req.registros) };
}

function acaoSeed(req) {
  aba(req.tabela);
  if (req.substituir) limparTabela(req.tabela);
  return acaoUpsert(req);
}

function doGet() {
  return responder({ ok: true, servico: 'Revisão TKA' });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var papel = papelDaSenha(req.senha);
    if (!papel) return responder({ ok: false, erro: 'auth', msg: 'Senha inválida' });
    var acao = acoes()[req.acao];
    if (!acao) return responder({ ok: false, erro: 'param', msg: 'Ação desconhecida' });
    if (acao.escrita && papel !== 'registro') return responder({ ok: false, erro: 'auth', msg: 'Acesso somente consulta' });
    var r = acao.run(req, papel);
    r.ok = true;
    return responder(r);
  } catch (err) {
    return responder({ ok: false, erro: err.param ? 'param' : 'interno', msg: String(err && err.message || err) });
  }
}
