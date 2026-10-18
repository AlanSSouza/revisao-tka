# Revisão Guindautos TKA — Design

**Data:** 18/10/2026 · **Dono:** Alan Souza (Frota/Manutenção — Mariuá Construção e Energia)
**Prazo crítico:** app instalado e testado no celular até a noite de **19/10/2026**; visitas começam **20/10/2026**.

## 1. Intenção e porquê

Os guindautos (Munck) TKA novos da frota começaram a apresentar defeitos no início de operação (principalmente vazamentos; também êmbolo solto, risco em cilindro, lentidão). A fábrica TKA está enviando um engenheiro (chega 19/10) para percorrer **todo o parque — 55 caminhões**, inclusive os que estão em campo, em Sergipe (Aracaju), Bahia (Serrinha, Feira de Santana, Jacobina) e Minas Gerais (Itajubá). É a primeira vez que a empresa faz uma abordagem assim.

Precisamos de um controle de visitas no celular para:
- saber o que já foi visitado e planejar o roteiro do que falta;
- registrar em cada visita: nº de série do Munck, KM, horímetro, status, equipe que opera, defeitos com fotos/vídeos, e treinamentos rápidos dados no local;
- acompanhar os defeitos que viram garantia até serem resolvidos;
- gerar relatório geral do parque e relatório individual por equipamento (para cobrar a fábrica e para gestão);
- corrigir dados cadastrais (centro de custo, cidade, KM etc.) e exportar essas correções para atualizar a base da empresa.

## 2. Objetivos, não-objetivos, anti-objetivos

**Objetivos**
- Registro de visita completo em campo, no celular, **sem sinal**.
- Nada se perde: tudo que foi registrado offline sobe sozinho quando houver conexão.
- Dados centralizados e acessíveis a mais de uma pessoa (o Alan é o principal usuário; outros podem registrar ou consultar).
- Relatórios que transformam as ocorrências em evidência (quantos equipamentos com vazamento, qual componente mais falha, garantias abertas há X dias).

**Não-objetivos**
- Integração com o rastreador (localização é colada/digitada manualmente).
- Integração automática com o sistema de manutenção (GPM) — a saída é uma exportação de correções.
- Gestão de manutenção geral da frota; foco é este programa de revisão TKA.

**Anti-objetivos (seria fracasso mesmo "funcionando")**
- Perder fotos/visitas por falta de sinal, fechamento do app ou reenvio duplicado.
- App lento/complicado em campo — preencher uma visita deve ser rápido com uma mão e luva.
- Expor dados pessoais de funcionários (LGPD) — ver §7.

## 3. Restrições

- Plataforma: **celular** (Android/iPhone, navegador), uso **offline** obrigatório.
- Armazenamento: **Google Drive pessoal do Alan** (alanssouza.23@gmail.com). Volume estimado de mídia: ~5 GB com compressão.
- Hospedagem: **GitHub Pages** na conta GitHub do Alan (repositório público ⇒ só código, **nenhum dado** no repositório).
- Custo: zero.
- Identidade visual: **logo Mariuá** (`Color logo - no background.png`), verde-petróleo `#00989A` como cor principal, gradiente laranja `#EF4136 → #FBA63C` para ações/destaques; **selo GPTW Certificada 2026** (`GPTW.png`, arquivo oficial) na tela de entrada e no rodapé dos relatórios. Esboço aprovado: `.superpowers/brainstorm/.../telas-marca-v2.html`.
- Idioma: português (BR).

## 4. Arquitetura (decidida)

```
Celular (PWA no GitHub Pages)                Conta Google do Alan
┌──────────────────────────────┐   HTTPS   ┌────────────────────────────────┐
│ UI + Service Worker (offline)│ ───────▶ │ Google Apps Script (Web App)   │
│ IndexedDB: dados + fila +    │  JSON +   │  executa como Alan, valida     │
│ blobs de mídia               │  chunks   │  senha, grava ▼                │
└──────────────────────────────┘           │ Planilha "Revisão TKA – Base"  │
                                            │ Pasta Drive "Revisão TKA/"     │
                                            └────────────────────────────────┘
```

- **PWA** instalável ("Adicionar à tela inicial"), app shell cacheado pelo Service Worker; funciona 100% offline após o primeiro acesso.
- **IndexedDB** guarda equipamentos, funcionários, roteiros, visitas, ocorrências e os arquivos de mídia até serem enviados. Fila de sincronização com retry automático ao voltar a conexão (evento `online` + tentativa periódica + botão "Sincronizar agora").
- **IDs gerados no celular (UUID)** em todo registro e mídia ⇒ reenvio é idempotente (o servidor faz upsert pelo ID; nunca duplica).
- **Apps Script Web App** ("Executar como: eu", "Acesso: qualquer pessoa") é a ponte: quem usa o app **não precisa** de acesso ao Drive do Alan.
- **Acesso por senha**: duas senhas definidas pelo Alan nas Propriedades do Script — **registro** (pode criar/editar) e **consulta** (só leitura, ex.: engenheiro TKA). O usuário informa nome + senha no primeiro acesso; o nome vai como "autor" em cada registro.
- **Download de dados para o celular**: ao entrar e a cada sync, o app baixa a base atual (equipamentos, funcionários, roteiros, visitas/ocorrências) para funcionar offline com informação recente.
- **Conflitos**: último a salvar vence, por registro, com `atualizado_em`. Uso esperado é praticamente de um único registrador.

### 4.1 Upload de mídia
- **Fotos**: comprimidas no celular (lado maior 1600 px, JPEG ~0,8 ⇒ ~0,3–0,6 MB).
- **Vídeos**: sem recompressão no navegador (não é viável com qualidade/rapidez). Mitigação: a câmera é aberta pelo app; orientar gravar em 720p; alerta se vídeo > 60 s ou > 80 MB (permite salvar mesmo assim).
- **Envio em partes**: o Apps Script abre uma sessão de upload *resumable* do Drive; o app envia o arquivo em pedaços (~5–8 MB, base64) ao Apps Script, que repassa cada pedaço à sessão. Pedaço que falha é reenviado; upload retoma de onde parou.
- Pasta: `Revisão TKA/<PLACA>/<AAAA-MM-DD>/<tipo>_<hora>_<id-curto>.<ext>`. Link do arquivo gravado na aba `Midias`.
- Mídia só é apagada do celular depois de confirmada no Drive.

## 5. Dados (Planilha Google "Revisão TKA – Base")

Cada aba = uma tabela; primeira linha = cabeçalho; chave = `id`.

| Aba | Conteúdo principal |
|---|---|
| `Equipamentos` | todas as colunas do Mapa TKA (placa, renavam, chassi, cidade, lotação, estado, centro de custo, modelo, marca/modelo, km, porte, status_veiculo/descrição do Munck, setor) **+** `serie_munck`, `horimetro_atual`, `km_atual_campo`, `local_previsto`, `atualizado_em/por` |
| `Alteracoes` | log de edição cadastral: placa, campo, valor original (planilha), valor novo, data, autor ⇒ gera "correções para a base" |
| `Funcionarios` | só **matrícula, nome, função, centro de custo, filial** de ativos (sem data de demissão) importados da `ATIVOS GERAL.xlsx` |
| `Roteiro` | data, ordem, placa, local previsto (texto/link), situação (planejada / visitada / reagendada), motivo do reagendamento |
| `Visitas` | id, placa, data/hora início e fim, GPS (lat/long/precisão), autor, presença do engenheiro TKA (nome), status do equipamento, KM, horímetro, nº série lido, observações gerais |
| `Equipe` | visita_id, matrícula, nome, papel (**Motorista-operador** / **Motorista** / **Operador**), avulso? (não estava na lista) |
| `Ocorrencias` | id, visita_id, placa, tipo, componente, gravidade, descrição, situação, protocolo, data abertura, previsão, solução, resolvido em/por |
| `Treinamentos` | id, visita_id, assunto, ministrante, duração (min), observações; participantes em `TreinamentoParticipantes` (matrícula, nome, assinatura→link de imagem no Drive) |
| `Midias` | id, visita_id, ocorrencia_id (opcional), placa, tipo (foto/vídeo/assinatura), legenda, link Drive, tamanho, criado em |

**Carga inicial**: 55 equipamentos do `Mapa equipamentos TKA.xlsx` (acentuação do arquivo está correta em UTF-8). 3 equipamentos estão sem KM na planilha; ficam em branco.

## 6. Funcionalidades

### Fase 1 — pronta até 19/10 (uso em campo)
1. **Entrada**: logo, nome + senha, selo GPTW. Indicador de modo (registro/consulta).
2. **Hoje** (tela inicial): contadores (parque / visitadas / hoje / sem data), fila do dia em ordem, parada atual destacada, "Abrir no Maps/Waze" (a partir do local previsto), "Iniciar visita", reagendar com motivo, indicador de pendências de envio e de sem-sinal.
3. **Planejar**: escolher data, selecionar máquinas com filtros (cidade, lotação, status, "nunca visitada"), ordenar arrastando, informar local previsto (texto ou link colado do rastreador).
4. **Parque**: lista/busca das 55 (placa, modelo, cidade, última visita, status, nº de ocorrências abertas) → **Ficha do equipamento**: dados cadastrais (editáveis, mostrando original × atual), histórico de visitas, ocorrências e mídias.
5. **Visita**: GPS e hora automáticos; status em um toque (🟢 Normal / 🟡 Com restrição / 🔴 Parado; ⚪ Não localizado vem do reagendamento); KM (mostra o da base para comparação, alerta se menor que o anterior); horímetro; nº de série do Munck (pré-preenchido se já conhecido); equipe (busca por matrícula ou nome na lista de funcionários; papéis conforme acima; cadastro avulso); ocorrências; mídia geral; treinamento (recolhido, opcional); observações; "Concluir visita". Rascunho salvo continuamente — fechar o app não perde nada.
6. **Ocorrência**: tipo (Vazamento · Êmbolo solto · Risco/dano no cilindro · Lentidão/perda de força · Ruído · Elétrico/controle remoto · Sensores NR12 · Estrutural · Outro), componente (lista: cilindro de elevação, cilindro de extensão, cilindro de estabilizador, sistema de giro, bomba, comando/válvulas, mangueira/conexão, tanque/reservatório, lança, sapata/estabilizador, controle remoto, outro), gravidade (Leve / Moderada / Crítica — impede operação), descrição, fotos/vídeos vinculados, situação (Resolvido na visita · Garantia aberta · Aguardando peça · Aguardando retorno da fábrica · Resolvido posteriormente) + protocolo, abertura, previsão, solução. Editável depois (para fechar garantias).
7. **Treinamento no local**: assunto (lista + livre), ministrante, duração, participantes (puxados da equipe + outros), assinatura opcional na tela.
8. **Sincronização** offline/online como §4.
9. **Instalação**: guia de 1 tela para "Adicionar à tela inicial".

### Fase 2 — durante a semana de 20/10
10. **Garantias**: lista de ocorrências não resolvidas, dias em aberto, filtro por situação/tipo/cidade, atualização rápida de situação.
11. **Painel geral**: progresso (visitadas × total, por cidade), status do parque, ocorrências por tipo e por componente, gravidade, garantias abertas × resolvidas, treinamentos e pessoas treinadas.
12. **Relatório por equipamento (PDF)**: cabeçalho com logo Mariuá; dados cadastrais; série/KM/horímetro; equipe; cada visita com ocorrências e fotos; situação das garantias; rodapé com selo GPTW.
13. **Relatório geral (PDF)**: consolidado do painel + tabela por equipamento.
14. **Exportar correções para a base** (CSV/XLSX): só campos alterados, com original × novo.
15. **Mapa** das visitas realizadas (pontos de GPS) — desejável.

Os dados coletados desde 20/10 entram nos relatórios da Fase 2 sem migração.

## 7. Privacidade (LGPD)
- `ATIVOS GERAL.xlsx` contém CPF, salário, dados bancários, filiação, raça, deficiência. **Somente** matrícula, nome, função, centro de custo e filial de ativos são extraídos; o arquivo original não é enviado a lugar nenhum.
- Lista de funcionários e todos os dados ficam **apenas** na Planilha/Drive privados; o repositório público contém só código.
- Senhas não ficam no código; ficam nas Propriedades do Script.

## 8. Passos do Alan (guiados)
1. Criar a planilha/pasta (ou rodar o script de instalação que cria) e colar o Apps Script; implantar como Web App e autorizar.
2. Definir as duas senhas.
3. Criar o repositório no GitHub e ativar o Pages (ou o Claude faz via git com a credencial já configurada).
4. Abrir o link no celular, entrar, adicionar à tela inicial, testar uma visita fictícia com foto e vídeo **em modo avião** e depois sincronizar.

## 9. Decisões complementares

**Do Alan**
- **Celular principal: iPhone (Safari).** Consequências: iOS pode limpar IndexedDB após dias sem uso e não tem Background Sync ⇒ o app tenta enviar a cada salvamento e ao abrir/voltar ao app, pede armazenamento persistente (`navigator.storage.persist()`), mostra alerta destacado quando houver mídia pendente há mais de X horas ou mais de ~500 MB acumulados, e orienta manter o app instalado na tela inicial. Testes obrigatórios em iPhone real (câmera, vídeo, modo avião, reabrir app).
- **Mídia compartilhada como "qualquer pessoa com o link"** (somente leitura) ao ser enviada ao Drive, para que outros usuários e o engenheiro vejam fotos/vídeos no app. O app exibe miniaturas via link do Drive.

**Do Claude (revisáveis)**
- Prioridade se a Fase 1 apertar: (1) visita + ocorrências + mídia + offline/sync + instalação; (2) Hoje/roteiro + edição cadastral; (3) arrastar para reordenar e assinatura no treinamento.
- Reagendar **não cria visita**: fica no `Roteiro` com situação "Não localizado/Reagendado" + motivo; não conta como visitada.
- Senha de **consulta não recebe a aba `Funcionarios`** (só os nomes já vinculados às visitas); endpoint de download filtra por papel.
- Concorrência: visita, equipe, ocorrência, mídia são registros separados por ID; upsert por registro não sobrescreve filhos de outro usuário.
- `Alteracoes` registra o campo pelo **nome de coluna original da planilha** (`cod_placa`, `centro_custo`, `km_atual`…) para facilitar reimportação no GPM.
- Código do app em subpasta própria (`app/`), com `.gitignore` excluindo `*.xlsx`; importação de funcionários roda localmente e grava direto na Planilha.

## 10. Deixado para o construtor
- Stack do front (preferência: sem build complexo — HTML/JS modular ou Vite gerando estático; mobile-first; leve).
- Layout exato, ícones, microinterações, dentro da identidade e do esboço aprovado.
- Formato exato do protocolo app ↔ Apps Script, tamanho dos chunks, estratégia de retry/backoff.
- Biblioteca de PDF (Fase 2).
- Testes: priorizar a fila offline/sincronização e a idempotência; teste manual em celular real em modo avião.
