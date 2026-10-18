// Upload de fotos/vídeos em pedaços para uma sessão resumable do Drive.
// Estado da sessão fica em ScriptProperties (UP_<id>) para sobreviver entre chamadas.

var DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id';

function estadoUpload(id) {
  var s = prop('UP_' + id);
  return s ? JSON.parse(s) : null;
}

function salvarEstadoUpload(id, st) {
  PropertiesService.getScriptProperties().setProperty('UP_' + id, JSON.stringify(st));
}

function apagarEstadoUpload(id) {
  PropertiesService.getScriptProperties().deleteProperty('UP_' + id);
}

function subpasta(pai, nome) {
  var it = pai.getFoldersByName(nome);
  return it.hasNext() ? it.next() : pai.createFolder(nome);
}

function pastaDestino(midia) {
  var raiz = DriveApp.getFolderById(prop('PASTA_ID'));
  var data = String(midia.criado_em || new Date().toISOString()).slice(0, 10);
  return subpasta(subpasta(raiz, String(midia.placa || 'sem-placa')), data);
}

function midiaEnviada(id) {
  var achada = lerTabela('Midias').filter(function (m) { return String(m.id) === String(id) && m.link; });
  return achada[0] || null;
}

function cabecalho(headers, nome) {
  var alvo = nome.toLowerCase();
  for (var k in headers) if (k.toLowerCase() === alvo) return headers[k];
  return null;
}

function recebidoDoRange(resp) {
  var range = cabecalho(resp.getHeaders(), 'Range');
  if (!range) return 0;
  return Number(String(range).split('-')[1]) + 1;
}

function acaoUploadInicio(req) {
  var m = req.midia;
  if (!m || !m.id) throw erroParam('midia');
  var ja = midiaEnviada(m.id);
  if (ja) return { concluido: true, link: ja.link, drive_id: ja.drive_id, recebido: Number(req.total_bytes) };
  if (estadoUpload(m.id)) return acaoUploadStatus({ id: m.id });

  var total = Number(req.total_bytes);
  var resp = UrlFetchApp.fetch(DRIVE_UPLOAD, {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      'X-Upload-Content-Type': m.mime,
      'X-Upload-Content-Length': String(total)
    },
    payload: JSON.stringify({ name: m.nome_arquivo, parents: [pastaDestino(m).getId()], mimeType: m.mime }),
    muteHttpExceptions: true
  });
  var sessao = cabecalho(resp.getHeaders(), 'Location');
  if (!sessao) throw new Error('Drive não abriu sessão de upload (' + resp.getResponseCode() + ')');
  salvarEstadoUpload(m.id, { sessao: sessao, total: total, recebido: 0, midia: m });
  return { recebido: 0 };
}

function finalizarUpload(id, st, resp) {
  var driveId = JSON.parse(resp.getContentText()).id;
  DriveApp.getFileById(driveId).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var link = 'https://drive.google.com/file/d/' + driveId + '/view';
  var reg = {};
  for (var k in st.midia) reg[k] = st.midia[k];
  reg.drive_id = driveId;
  reg.link = link;
  reg.enviado_em = new Date().toISOString();
  upsertRegistros('Midias', [reg]);
  apagarEstadoUpload(id);
  return { concluido: true, link: link, drive_id: driveId, recebido: st.total };
}

function tratarRespostaSessao(id, st, resp) {
  var code = resp.getResponseCode();
  if (code === 200 || code === 201) return finalizarUpload(id, st, resp);
  if (code === 308) {
    st.recebido = recebidoDoRange(resp);
    salvarEstadoUpload(id, st);
    return { recebido: st.recebido };
  }
  if (code === 404 || code === 410) {
    apagarEstadoUpload(id);
    return { expirada: true, recebido: 0 };
  }
  throw new Error('Falha no envio ao Drive (' + code + ')');
}

function acaoUploadPedaco(req) {
  var st = estadoUpload(req.id);
  if (!st) {
    var ja = midiaEnviada(req.id);
    if (ja) return { concluido: true, link: ja.link, drive_id: ja.drive_id };
    return { expirada: true, recebido: 0 };
  }
  if (Number(req.offset) !== st.recebido) return { recebido: st.recebido };
  var bytes = Utilities.base64Decode(req.dados_b64);
  var fim = st.recebido + bytes.length - 1;
  var resp = UrlFetchApp.fetch(st.sessao, {
    method: 'put',
    headers: { 'Content-Range': 'bytes ' + st.recebido + '-' + fim + '/' + st.total },
    payload: bytes,
    muteHttpExceptions: true
  });
  return tratarRespostaSessao(req.id, st, resp);
}

function acaoUploadStatus(req) {
  var st = estadoUpload(req.id);
  if (!st) {
    var ja = midiaEnviada(req.id);
    return ja ? { concluido: true, link: ja.link, drive_id: ja.drive_id } : { expirada: true, recebido: 0 };
  }
  var resp = UrlFetchApp.fetch(st.sessao, {
    method: 'put',
    headers: { 'Content-Range': 'bytes */' + st.total },
    muteHttpExceptions: true
  });
  return tratarRespostaSessao(req.id, st, resp);
}
