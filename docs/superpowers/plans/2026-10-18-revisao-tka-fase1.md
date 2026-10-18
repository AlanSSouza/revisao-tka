# Revisão Guindautos TKA — Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA offline-first em iPhone para registrar visitas técnicas aos 55 guindautos TKA, sincronizando com Planilha Google + Drive do Alan via Apps Script — pronto para uso em campo em 20/10/2026.

**Architecture:** Front estático (HTML + ES modules, sem build) servido pelo GitHub Pages; IndexedDB guarda tudo + fila de saída; `sync.js` envia registros (upsert idempotente por UUID) e mídia em pedaços para um Web App do Apps Script, que grava na Planilha e em sessões *resumable* do Drive. Dados nunca entram no repositório.

**Tech Stack:** HTML/CSS/JS (ES2022 modules), IndexedDB, Service Worker, Google Apps Script (V8), Node 24 + Vitest + fake-indexeddb (testes), SheetJS `xlsx` (ferramentas locais de importação), GitHub Actions → Pages.

**Spec:** `docs/superpowers/specs/2026-10-18-revisao-tka-design.md`

## Global Constraints

- Idioma de toda a interface: português (BR).
- Cores: principal `#00989A` (escuro `#006F71`, texto `#16302F`, fundo `#F3F7F7`); ações/destaques gradiente `#EF4136 → #FBA63C`. Logo `Color logo - no background.png`; selo `GPTW.png` na tela de entrada (sem alterar o arquivo).
- Layout de referência: `.superpowers/brainstorm/1959-1792342730/content/telas-marca-v2.html`.
- Alvo primário: **iPhone Safari** instalado na tela inicial; mobile-first, alvos de toque ≥ 44 px.
- Nenhum `.xlsx`, JSON de dados, senha ou URL com segredo no repositório. `.gitignore` contém `*.xlsx`, `data/`, `.superpowers/`, `node_modules/`.
- Funcionários: somente `matricula, nome, funcao, centro_custo, filial` de ativos (sem `Dt. Demissao`).
- Toda entidade tem `id` (UUID gerado no cliente), `atualizado_em` (ISO), `atualizado_por` (nome).
- Status do equipamento: `normal | restricao | parado`. Papéis da equipe: `motorista_operador | motorista | operador`.
- Ocorrência — tipos: Vazamento, Êmbolo solto, Risco/dano no cilindro, Lentidão/perda de força, Ruído, Elétrico/controle remoto, Sensores NR12, Estrutural, Outro. Gravidade: `leve | moderada | critica`. Situação: `resolvido_visita | garantia | aguardando_peca | aguardando_fabrica | resolvido_depois`.
- Mídia: foto redimensionada para lado maior 1600 px, JPEG qualidade 0,8; aviso para vídeo > 60 s ou > 80 MB (permite salvar). Pedaços de upload de 4 MiB (múltiplo de 256 KiB).
- Papel `consulta` não recebe `Funcionarios` no pull e não pode gravar.

## Review Focus

1. App fechado/morto pelo iOS no meio de uma visita → reabrir mostra o rascunho intacto (Task 7 testa rascunho persistido a cada alteração).
2. Upload interrompido no meio de um vídeo (perda de sinal) → retoma do offset confirmado, sem duplicar arquivo (Task 3 e Task 5 testam retomada).
3. Mesmo registro reenviado duas vezes (timeout depois que o servidor gravou) → uma linha só na Planilha (Task 2 testa upsert idempotente).
4. KM digitado menor que o último conhecido ou com ponto de milhar ("9.512") → normaliza para número e alerta, não bloqueia (Task 4 testa `parseNumeroBR` e `alertaKm`).
5. Senha errada ou expirada durante sync → fila não é descartada; app mostra aviso e mantém pendentes (Task 5 testa erro 401 mantendo outbox).

---

## File Structure

```
.gitignore
package.json                      # vitest, fake-indexeddb, xlsx (dev)
.github/workflows/pages.yml       # publica app/ no Pages
tools/
  importar.mjs                    # xlsx → data/equipamentos.json, data/funcionarios.json
  transform.mjs                   # funções puras usadas por importar.mjs
  enviar-seed.mjs                 # POST seed ao Apps Script
backend/                          # colado no editor do Apps Script
  appsscript.json
  Codigo.gs                       # doPost, roteamento, auth
  Planilha.gs                     # setup, leitura, upsert
  Midia.gs                        # upload resumable + compartilhamento
app/
  index.html  manifest.webmanifest  sw.js
  assets/ logo.png gptw.png icon-192.png icon-512.png apple-touch-icon.png
  css/app.css
  js/
    config.js       # API_URL
    db.js           # IndexedDB
    modelo.js       # regras puras (criação, validação, contadores)
    api.js          # fetch ao Apps Script
    sync.js         # outbox, pull, upload em pedaços
    midia.js        # captura/compressão
    ui.js           # helpers DOM, toasts, chips
    main.js         # boot, roteador por hash, barra de abas
    telas/ entrada.js hoje.js planejar.js parque.js equipamento.js visita.js ocorrencia.js treinamento.js
tests/
  transform.test.mjs backend.test.mjs midia-backend.test.mjs db.test.mjs modelo.test.mjs sync.test.mjs midia.test.mjs
  helpers/gas-mock.mjs            # mocks de SpreadsheetApp/DriveApp/UrlFetchApp + loader via vm
```

---

### Task 1: Repositório + importação local dos dados

**Files:**
- Create: `.gitignore`, `package.json`, `tools/transform.mjs`, `tools/importar.mjs`, `tests/transform.test.mjs`

**Interfaces:**
- Produces: `linhasParaEquipamentos(linhas: object[]): Equipamento[]` — mantém todas as colunas originais do Mapa com os mesmos nomes (`cod_placa`, `centro_custo`, `km_atual`…), adiciona `id` = `cod_placa`, `serie_munck:''`, `horimetro_atual:null`, `local_previsto:''`; `km_atual` vazio → `null`, número → Number.
- Produces: `linhasParaFuncionarios(linhas: object[]): Funcionario[]` — de `ATIVOS GERAL.xlsx` usa colunas `Matricula, Nome, Desc.Funcao, Centro Custo, Filial, Dt. Demissao`; descarta quem tem `Dt. Demissao` preenchida (valor diferente de vazio e de `"  /  /    "` após trim de espaços e barras); saída `{id: matricula, matricula, nome, funcao, centro_custo, filial}` com strings trimadas. **Nenhum outro campo.**
- Produces: `data/equipamentos.json`, `data/funcionarios.json` (gitignored).

- [ ] **Step 1:** `git init`; `.gitignore` conforme Global Constraints; `package.json` com `"type":"module"`, scripts `test: vitest run`, `importar: node tools/importar.mjs`; `npm i -D vitest fake-indexeddb xlsx`.
- [ ] **Step 2: Testes que falham** em `tests/transform.test.mjs`:
  - `equipamento mantém colunas e cria id`: entrada `{cod_placa:'TSN5J65', km_atual:9334, centro_custo:'SERVIÇOS EM ENERGIA - ARACAJU'}` → `id==='TSN5J65'`, `km_atual===9334`, `centro_custo` igual, `serie_munck===''`.
  - `km vazio vira null`: `{cod_placa:'UTM9I28', km_atual:''}` → `km_atual===null`.
  - `funcionario demitido é descartado`: duas linhas, uma com `Dt. Demissao:'15/03/2025'` → resultado length 1.
  - `funcionario com data vazia "  /  /    " é ativo`.
  - `funcionario não carrega dados sensíveis`: entrada com `CPF`, `Salário`, `Nome Mae` → `Object.keys(r[0]).sort()` igual a `['centro_custo','filial','funcao','id','matricula','nome']`.
- [ ] **Step 3:** `npm test` → FAIL (módulo inexistente).
- [ ] **Step 4:** Implementar `tools/transform.mjs`; `tools/importar.mjs` lê `Mapa equipamentos TKA.xlsx` e `ATIVOS GERAL.xlsx` da raiz com `XLSX.readFile` + `sheet_to_json({defval:''})`, grava os JSON em `data/` e imprime contagens.
- [ ] **Step 5:** `npm test` → PASS; `npm run importar` → imprime `55 equipamentos` e `N funcionários ativos` (N < 1388).
- [ ] **Step 6:** `git status` não lista nenhum `.xlsx` nem `data/`. Commit `chore: estrutura e importação local dos dados`.

### Task 2: Backend Apps Script — setup, auth, pull, upsert

**Files:**
- Create: `backend/appsscript.json`, `backend/Codigo.gs`, `backend/Planilha.gs`, `tests/helpers/gas-mock.mjs`, `tests/backend.test.mjs`

**Interfaces:**
- Tabelas (abas) e cabeçalhos: `Equipamentos` (colunas do Mapa + extras da Task 1 + `atualizado_em, atualizado_por`), `Alteracoes` (`id, placa, campo, valor_original, valor_novo, atualizado_em, atualizado_por`), `Funcionarios`, `Roteiro` (`id, data, ordem, placa, local_previsto, situacao[planejada|visitada|reagendada], motivo, atualizado_em, atualizado_por`), `Visitas` (`id, placa, inicio, fim, lat, lng, precisao, autor, engenheiro, status, km, horimetro, serie_munck, observacoes, concluida, atualizado_em, atualizado_por`), `Equipe` (`id, visita_id, matricula, nome, papel, avulso, …`), `Ocorrencias` (`id, visita_id, placa, tipo, componente, gravidade, descricao, situacao, protocolo, abertura, previsao, solucao, resolvido_em, resolvido_por, …`), `Treinamentos` (`id, visita_id, assunto, ministrante, duracao_min, observacoes, …`), `TreinamentoParticipantes` (`id, treinamento_id, matricula, nome, assinatura_midia_id, …`), `Midias` (`id, visita_id, ocorrencia_id, placa, tipo[foto|video|assinatura], legenda, nome_arquivo, mime, tamanho, drive_id, link, enviado_em, …`). Cabeçalhos ficam numa constante `TABELAS` em `Planilha.gs`.
- Protocolo: `POST` com corpo `text/plain` contendo JSON `{acao, senha, autor, ...}`; resposta JSON `{ok:true, ...}` ou `{ok:false, erro:'auth'|'param'|'interno', msg}`.
- Ações: `login → {papel:'registro'|'consulta'}`; `pull → {dados:{<Tabela>: obj[]}, servidor_em}` (sem `Funcionarios` para `consulta`); `upsert {tabela, registros[]} → {gravados:n}` (só `registro`; tabela fora de `TABELAS` → `erro:'param'`); `seed {tabela, registros[], substituir:bool}`.
- Senhas: `PropertiesService.getScriptProperties()` chaves `SENHA_REGISTRO`, `SENHA_CONSULTA`; IDs: `PLANILHA_ID`, `PASTA_ID` (criados por `setup()`).
- Functions: `setup()` cria planilha "Revisão TKA – Base" + pasta "Revisão TKA" se faltarem e garante abas/cabeçalhos; `lerTabela(nome): obj[]`; `upsertRegistros(nome, registros): number` (atualiza linha cujo `id` existe, senão anexa; colunas novas no objeto são ignoradas; usa `LockService.getScriptLock()`).
- Consumes: nada.

- [ ] **Step 1:** `tests/helpers/gas-mock.mjs`: `carregarGas(arquivos: string[], mocks): context` executa os `.gs` num `vm.createContext` com mocks em memória de `SpreadsheetApp` (planilha → abas → matriz `getDataRange().getValues()`, `appendRow`, `getRange(r,c,nr,nc).setValues`), `PropertiesService`, `LockService`, `ContentService`, `DriveApp`, `UrlFetchApp`, `ScriptApp.getOAuthToken`, `Utilities.base64Decode/newBlob`.
- [ ] **Step 2: Testes que falham** (`tests/backend.test.mjs`), chamando `doPost({postData:{contents: JSON.stringify(...)}})` e lendo o JSON retornado:
  - `senha errada → ok:false erro:'auth'`.
  - `login registro → papel:'registro'`; `login consulta → papel:'consulta'`.
  - `upsert duas vezes o mesmo id grava uma linha só` (Visitas com `id:'v1'`, depois `id:'v1', km:9512` → aba tem 1 linha de dados com km 9512).
  - `consulta não pode upsert → erro:'auth'`.
  - `pull consulta não traz Funcionarios`; `pull registro traz Funcionarios`.
  - `tabela inválida → erro:'param'`.
  - `setup é idempotente`: chamar 2× mantém 9 abas.
- [ ] **Step 3:** `npm test -- backend` → FAIL.
- [ ] **Step 4:** Implementar `Codigo.gs` (`doPost`, `responder(obj)`, `papelDaSenha(senha)`), `Planilha.gs`. `appsscript.json`: `runtimeVersion V8`, `timeZone America/Sao_Paulo`, `webapp:{executeAs:'USER_DEPLOYING', access:'ANYONE_ANONYMOUS'}`, escopos `spreadsheets, drive, script.external_request`.
- [ ] **Step 5:** `npm test -- backend` → PASS. Commit `feat(backend): setup, auth, pull e upsert idempotente`.

### Task 3: Backend — upload de mídia em pedaços

**Files:**
- Create: `backend/Midia.gs`, `tests/midia-backend.test.mjs`

**Interfaces:**
- Ações: `uploadInicio {midia: Midia (sem link), total_bytes}` → `{ok, recebido:0}`; cria pasta `Revisão TKA/<placa>/<AAAA-MM-DD>` (data de `midia.criado_em`), abre sessão resumable `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable` (header `Authorization: Bearer ScriptApp.getOAuthToken()`, metadata `{name, parents:[pastaId], mimeType}`), guarda `{sessao, total}` em `CacheService.getScriptCache()` (6 h) **e** em `ScriptProperties` chave `UP_<id>`. Se já existe linha em `Midias` com esse `id` e `link` → `{ok, concluido:true, link}` (idempotente).
- `uploadPedaco {id, offset, dados_b64}` → `PUT` na sessão com `Content-Range: bytes offset-fim/total`; resposta 308 → `{recebido: fim+1}` (lido do header `Range`); 200/201 → define compartilhamento `anyone with link / reader` (`DriveApp.getFileById(id).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)`), grava linha em `Midias` com `drive_id`, `link`, `enviado_em`, remove `UP_<id>` → `{concluido:true, link}`. Offset ≠ `recebido` atual do servidor → `{ok:true, recebido:<valor do servidor>}` sem enviar (cliente se realinha).
- `uploadStatus {id}` → `{recebido}` consultando a sessão (`PUT` vazio com `Content-Range: bytes */total`).

- [ ] **Step 1: Testes que falham** com `UrlFetchApp` mockado simulando sessão resumable:
  - `upload completo em 2 pedaços grava Midias com link e compartilha`.
  - `uploadInicio repetido de mídia já enviada devolve concluido sem nova sessão`.
  - `pedaço com offset desalinhado devolve recebido do servidor e não chama PUT`.
  - `uploadStatus após queda devolve bytes já confirmados`.
- [ ] **Step 2:** `npm test -- midia-backend` → FAIL.
- [ ] **Step 3:** Implementar `Midia.gs` e registrar as ações no roteador de `Codigo.gs`.
- [ ] **Step 4:** `npm test` → PASS. Commit `feat(backend): upload resumable de mídia`.

### Task 4: Front — IndexedDB e regras de modelo

**Files:**
- Create: `app/js/db.js`, `app/js/modelo.js`, `tests/db.test.mjs`, `tests/modelo.test.mjs`

**Interfaces:**
- `db.js`: stores = os mesmos nomes das tabelas do backend + `outbox` (keyPath `seq` autoIncrement: `{tabela, registro}`), `blobs` (key = midia id: `{blob, recebido}`), `meta` (key/val: `sessao`, `ultimo_pull`, `rascunho_visita`). API: `abrir(): Promise<void>`, `get(store, id)`, `todos(store)`, `por(store, campo, valor)`, `salvar(tabela, registro, {autor}): Promise<registro>` (define `atualizado_em/por`, grava no store **e** na outbox na mesma transação), `substituirTudo(dadosPull)` (não sobrescreve registros que estão na outbox), `outbox(): Promise<item[]>`, `removerOutbox(seqs[])`, `salvarBlob(id, blob)`, `blob(id)`, `removerBlob(id)`, `meta(k)`, `setMeta(k,v)`.
- `modelo.js` (puro, sem DOM/IDB): `uuid()`, `parseNumeroBR(txt): number|null` ("9.512"→9512, "412,5"→412.5, ""→null), `alertaKm(novo, anterior): string|null` (menor → "KM menor que o último registrado (9.334)"), `novaVisita(placa, autor, gps)`, `novaOcorrencia(visita)`, `novoMembro(visita, funcionario|{nome,matricula}, papel)`, `resumoParque(equipamentos, visitas, roteiro, hoje): {total, visitadas, hoje, semData}` (visitada = existe visita `concluida` da placa; semData = sem visita concluída e sem roteiro com data ≥ hoje), `alteracoesCadastro(original, editado, autor): Alteracao[]` (um item por campo diferente, `campo` = nome da coluna).

- [ ] **Step 1: Testes que falham**:
  - db (com `fake-indexeddb/auto`): `salvar grava no store e na outbox`; `substituirTudo preserva registro pendente na outbox`; `blob salvo e recuperado é idêntico`.
  - modelo: `parseNumeroBR('9.512')===9512`, `('412,5')===412.5`, `('')===null`, `('abc')===null`; `alertaKm(9000,9334)` contém `"9.334"`, `alertaKm(9512,9334)===null`, `alertaKm(9512,null)===null`; `resumoParque` com 3 equipamentos, 1 visita concluída, 1 no roteiro de hoje → `{total:3, visitadas:1, hoje:1, semData:1}`; `alteracoesCadastro` com `centro_custo` e `cidade` mudados → 2 itens com `valor_original` correto; `novoMembro` papel inválido lança erro.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar `db.js` e `modelo.js`.
- [ ] **Step 4:** `npm test` → PASS. Commit `feat(app): banco local e regras de modelo`.

### Task 5: Front — API e sincronização

**Files:**
- Create: `app/js/config.js`, `app/js/api.js`, `app/js/sync.js`, `tests/sync.test.mjs`

**Interfaces:**
- Consumes: `db.js`, protocolo das Tasks 2–3.
- `config.js`: `export const API_URL = '<preenchido na Task 10>'`; `export const PEDACO = 4 * 1024 * 1024`.
- `api.js`: `chamar(acao, params): Promise<obj>` — `fetch(API_URL,{method:'POST', body: JSON.stringify({acao, senha, autor, ...params})})` sem headers customizados (evita preflight), senha/autor de `db.meta('sessao')`; timeout 60 s via `AbortController`; `ok:false, erro:'auth'` → lança `ErroAuth`; falha de rede → lança `ErroRede`.
- `sync.js`: `sincronizar(): Promise<{enviados, midiasEnviadas, pendentes}>` — com trava (uma execução por vez): (1) agrupa outbox por tabela, `upsert` em lotes de 50, remove os confirmados; (2) para cada `Midias` sem `link` cujo blob existe: `uploadInicio` → laço `uploadPedaco` a partir de `recebido` (atualiza `blobs.recebido` a cada pedaço) → ao concluir grava `link` local e `removerBlob`; (3) `pull` → `substituirTudo`. `ErroRede` em qualquer passo: para e mantém o resto. `ErroAuth`: para, mantém tudo, emite evento `sync:auth`. Emite `sync:estado` `{pendentes, emAndamento, ultimoOk, erro}` via `EventTarget` exportado `eventos`.
- `pendentes(): Promise<{registros, midias, bytes, maisAntiga}>`.
- `agendar()`: chama `sincronizar()` em `online`, `visibilitychange` visível, a cada 2 min com app aberto, e após cada `salvar` (debounce 3 s). Chama `navigator.storage.persist()` uma vez.

- [ ] **Step 1: Testes que falham** com `fetch` mockado:
  - `envia outbox e esvazia`;
  - `ErroRede no meio mantém itens não confirmados`;
  - `ErroAuth mantém outbox e emite sync:auth`;
  - `upload retoma do recebido salvo` (blob 10 MiB, 1º pedaço ok, rede cai, 2ª chamada começa no offset 4 MiB);
  - `mídia concluída remove blob e grava link`;
  - `duas chamadas simultâneas de sincronizar executam uma vez`.
- [ ] **Step 2:** `npm test -- sync` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test` → PASS. Commit `feat(app): sincronização offline com retomada de upload`.

### Task 6: Front — captura e compressão de mídia

**Files:**
- Create: `app/js/midia.js`, `tests/midia.test.mjs`

**Interfaces:**
- `dimensoesAlvo(w, h, max=1600): {w,h}` (puro).
- `avisoVideo({duracao, tamanho}): string|null` (> 60 s ou > 80 MB → texto do aviso).
- `comprimirFoto(file): Promise<Blob>` — `createImageBitmap(file, {imageOrientation:'from-image'})` → canvas `dimensoesAlvo` → `toBlob('image/jpeg', 0.8)`; se falhar, devolve o arquivo original.
- `lerDuracaoVideo(file): Promise<number>` via `<video>` `loadedmetadata`.
- `capturar({tipo:'foto'|'video', placa, visitaId, ocorrenciaId?, legenda?, autor}): Promise<Midia|null>` — abre `<input type=file accept="image/*"|"video/*" capture="environment">`, processa, grava via `db.salvarBlob` + `db.salvar('Midias', …)`; nome de arquivo `<tipo>_<HHmmss>_<id 8 chars>.<ext>`.
- `galeria` alternativa: mesmo fluxo com `accept` sem `capture` e `multiple` (para escolher do rolo de câmera).

- [ ] **Step 1: Testes que falham**: `dimensoesAlvo(4032,3024)` → `{w:1600,h:1200}`; `dimensoesAlvo(800,600)` inalterado; `dimensoesAlvo(3024,4032)` → `{w:1200,h:1600}`; `avisoVideo({duracao:90,tamanho:5e7})` não nulo; `avisoVideo({duracao:30,tamanho:9e7})` não nulo; `avisoVideo({duracao:30,tamanho:5e7})===null`.
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS. Commit `feat(app): captura e compressão de mídia`.

### Task 7: Casca do app, entrada, PWA offline

**Files:**
- Create: `app/index.html`, `app/manifest.webmanifest`, `app/sw.js`, `app/css/app.css`, `app/js/ui.js`, `app/js/main.js`, `app/js/telas/entrada.js`, `app/assets/*`, `tools/mock-api.mjs` (servidor Node local que implementa `login/pull/upsert/seed/uploadInicio/uploadPedaco` em memória, senhas `reg`/`con`, carrega `data/*.json`; usado pelas verificações das Tasks 7–9)

**Interfaces:**
- Consumes: `db`, `api.chamar('login')`, `sync.agendar/sincronizar/eventos/pendentes`.
- Rotas hash: `#/entrar`, `#/hoje` (padrão), `#/planejar`, `#/parque`, `#/equipamento/:placa`, `#/visita/:id`, `#/ocorrencia/:id`, `#/treinamento/:visitaId`. Cada tela exporta `render(container, params): Promise<void>`.
- `ui.js`: `h(tag, attrs, ...filhos)`, `chips(opcoes, valor, onChange)`, `toast(msg, tipo)`, `campoNumero(label, valor, onChange)`, `confirmar(msg): Promise<bool>` (modal próprio — nunca `alert/confirm` nativos).
- Barra superior: logo + "REVISÃO TKA"; selo de sync (`⏳ N pendentes`, `sem sinal`, `✓ sincronizado hh:mm`) clicável → `sincronizar()`; alerta destacado se mídia pendente > 12 h ou > 500 MB (iOS). Barra de abas: Hoje · Planejar · Parque (Garantias/Relatórios aparecem como "em breve" na Fase 1). Papel `consulta`: oculta botões de criação/edição.
- Entrada: logo, "Revisão Guindautos TKA", nome, senha, botão Entrar (gradiente), selo GPTW no rodapé; após login faz primeiro `sincronizar()` com tela de carregamento; se o app não está em modo standalone em iOS, mostra cartão "Instale na tela inicial: Compartilhar → Adicionar à Tela de Início".
- `sw.js`: precache de todos os arquivos de `app/` (lista versionada `VERSAO`), estratégia cache-first para o shell, rede direta para `API_URL`; nova versão → `skipWaiting` + aviso "Nova versão — toque para atualizar".
- `manifest`: `name "Revisão TKA – Mariuá"`, `display standalone`, `theme_color #00989A`, ícones gerados a partir do símbolo do logo (recorte do círculo laranja) em 192/512/180.

- [ ] **Step 1:** Implementar; `npx serve app` (ou `python -m http.server` dentro de `app/`).
- [ ] **Step 2: Verificação no navegador (Playwright, viewport 390×844):** entrada renderiza com logo e GPTW; após stub de login (`API_URL` apontando para um mock local `tools/mock-api.mjs` que implementa `login/pull/upsert` em memória), navega para `#/hoje`; recarregar com rede desligada (`context.setOffline(true)`) ainda abre o app.
- [ ] **Step 3:** Commit `feat(app): casca PWA, entrada e navegação`.

### Task 8: Visita, ocorrência, equipe, treinamento

**Files:**
- Create: `app/js/telas/visita.js`, `app/js/telas/ocorrencia.js`, `app/js/telas/treinamento.js`

**Interfaces:**
- Consumes: `modelo.*`, `db.*`, `midia.capturar`, `ui.*`.
- **Visita** (`#/visita/:id`; criada por "Iniciar visita" com `novaVisita` + `navigator.geolocation.getCurrentPosition` timeout 10 s — sem GPS grava vazio): status em chips; KM (mostra `km_atual` da base, `alertaKm`); horímetro; nº série do Munck (pré-preenche `equipamento.serie_munck`; ao concluir, se diferente, atualiza equipamento + `Alteracoes`); engenheiro presente (texto, lembra o último); equipe: busca incremental por matrícula/nome em `Funcionarios` (mín. 2 caracteres, até 8 resultados), papel em chips, "Adicionar sem cadastro"; sugere a equipe da última visita da placa; lista de ocorrências com miniaturas; botões "+ Ocorrência", "📷 Foto", "🎥 Vídeo", "🖼 Da galeria"; seção recolhida "Treinamento no local"; observações; "Concluir visita" (exige status; marca `concluida:true`, `fim`, marca `Roteiro` do dia como `visitada`, atualiza `Equipamentos.km_atual_campo/horimetro_atual`). **Todo campo salva ao alterar** (`db.salvar` com debounce 800 ms) — não existe botão "salvar rascunho".
- **Ocorrência**: campos e listas exatamente como Global Constraints + componentes: cilindro de elevação, cilindro de extensão, cilindro do estabilizador, sistema de giro, bomba, comando/válvulas, mangueira/conexão, tanque/reservatório, lança, sapata/estabilizador, controle remoto, outro. Protocolo/abertura/previsão visíveis só quando situação ∈ {garantia, aguardando_peca, aguardando_fabrica}; solução visível quando resolvido_*. Mídias vinculadas (`ocorrencia_id`).
- **Treinamento**: assunto (sugestões: Operação do estabilizador, Inspeção diária NR12, Operação do controle remoto, Limites de carga, Outro + livre), ministrante, duração (min), participantes = equipe da visita pré-marcada + busca; assinatura opcional por participante em `<canvas>` (pointer events) salva como mídia `tipo:'assinatura'` (PNG).
- Miniaturas: blob local via `URL.createObjectURL` enquanto pendente; depois `https://drive.google.com/thumbnail?id=<drive_id>&sz=w400`; toque abre `link`.

- [ ] **Step 1:** Implementar as três telas.
- [ ] **Step 2: Verificação Playwright (390×844, mock-api, offline):** iniciar visita em `TSN5J65` → status Com restrição → KM "9.512" → adicionar membro por matrícula → criar ocorrência Vazamento/cilindro de extensão/moderada/garantia prot. "88123" com 1 foto (arquivo de teste) → **recarregar a página no meio** → dados continuam → concluir → `#/hoje` mostra a placa como visitada; ficar online → selo vai a `✓ sincronizado`, mock-api recebeu Visitas/Equipe/Ocorrencias/Midias.
- [ ] **Step 3:** Commit `feat(app): visita, ocorrência, equipe e treinamento`.

### Task 9: Hoje, Planejar, Parque e ficha do equipamento

**Files:**
- Create: `app/js/telas/hoje.js`, `app/js/telas/planejar.js`, `app/js/telas/parque.js`, `app/js/telas/equipamento.js`

**Interfaces:**
- Consumes: `modelo.resumoParque`, `modelo.alteracoesCadastro`, `db.*`, `ui.*`.
- **Hoje**: data atual; `resumoParque`; paradas do `Roteiro` de hoje por `ordem`; parada atual = 1ª `planejada`; por parada: placa, modelo, `status_veiculo`, local; botões "Abrir no Maps" (`local_previsto` é URL → abre; senão `https://maps.apple.com/?q=<texto>`; e "Waze" `https://waze.com/ul?q=<texto>`), "Iniciar visita" (retoma visita não concluída da placa se existir), "Reagendar" (motivo obrigatório: Não localizado / Em serviço distante / Equipamento em manutenção / Outro + data nova opcional → situacao `reagendada`, cria nova linha de roteiro na nova data). Sem roteiro hoje → atalho para Planejar e para "Visita avulsa" (escolher placa).
- **Planejar**: seletor de data (padrão amanhã); filtros chips: cidade (valores distintos de `cidade`), "Nunca visitadas"; lista com checkbox; selecionadas formam a ordem; reordenar com botões ▲▼ (arrastar é melhoria opcional); campo local previsto por parada (aceita link colado).
- **Parque**: busca por placa/cidade/modelo; filtros cidade e situação (visitada / não visitada / com ocorrência aberta); cada item: placa, modelo curto, cidade, última visita (data + bolinha de status), nº de ocorrências não resolvidas.
- **Equipamento** (`#/equipamento/:placa`): cabeçalho com placa e Munck; botão "Iniciar visita"; seção "Dados cadastrais" — todas as colunas do Mapa editáveis (modo editar/salvar), campos alterados mostram "original: …" (valor da 1ª `Alteracoes` do campo ou valor carregado no seed); salvar gera `Alteracoes` via `alteracoesCadastro`; histórico de visitas (data, status, autor, KM, horímetro) com link para a visita; ocorrências com situação editável (abre `#/ocorrencia/:id`); galeria de mídias.

- [ ] **Step 1:** Implementar as telas.
- [ ] **Step 2: Verificação Playwright:** planejar amanhã com 3 placas de Aracaju, reordenar; `#/hoje` (data simulada) mostra 3 paradas na ordem; reagendar a 2ª como "Não localizado" → some da fila e não conta como visitada; Parque filtra "Aracaju"; editar `centro_custo` de `TSN5J65` → `Alteracoes` com original correto.
- [ ] **Step 3:** `npm test` → PASS geral. Commit `feat(app): roteiro do dia, planejamento e parque`.

### Task 10: Publicação, carga e teste em iPhone

**Files:**
- Create: `.github/workflows/pages.yml`, `tools/enviar-seed.mjs`, `docs/INSTALACAO.md`
- Modify: `app/js/config.js` (API_URL)

**Interfaces:**
- `enviar-seed.mjs <API_URL> <SENHA_REGISTRO>`: envia `seed` de `data/equipamentos.json` (`substituir:true` só se a aba estiver vazia) e `data/funcionarios.json` (`substituir:true`).
- `pages.yml`: on push to `main`, `actions/upload-pages-artifact` com `path: app`, `actions/deploy-pages`.

- [ ] **Step 1:** `docs/INSTALACAO.md` com passos para o Alan: script.google.com → novo projeto "Revisão TKA" → colar os 3 `.gs` + `appsscript.json` → executar `setup` e autorizar → Propriedades do Script: `SENHA_REGISTRO`, `SENHA_CONSULTA` → Implantar como app da Web (executar como eu, qualquer pessoa) → copiar URL.
- [ ] **Step 2:** Alan executa o Step 1 (guiado em tempo real); colocar a URL em `config.js`.
- [ ] **Step 3:** `node tools/enviar-seed.mjs …` → Planilha mostra 55 linhas em Equipamentos e N em Funcionarios.
- [ ] **Step 4:** Criar repositório GitHub `revisao-tka` (público), push, ativar Pages com origem "GitHub Actions"; verificar `git ls-files | grep -Ei 'xlsx|data/'` vazio **antes** do push.
- [ ] **Step 5: Teste em iPhone real (Alan):** abrir URL no Safari → entrar → adicionar à tela inicial → abrir pelo ícone → **modo avião** → visita completa fictícia com 2 fotos + 1 vídeo de 20 s + ocorrência → fechar o app pelo multitarefa → reabrir (dados intactos) → desligar modo avião → selo chega a `✓ sincronizado` → conferir linhas na Planilha e arquivos em `Revisão TKA/<placa>/<data>/` abrindo pelo link em aba anônima.
- [ ] **Step 6:** Apagar dados do teste (linhas da visita fictícia + pasta) ou marcá-los; commit `chore: publicação e guia de instalação`.
