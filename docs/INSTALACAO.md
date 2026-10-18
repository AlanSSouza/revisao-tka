# Instalação — Revisão Guindautos TKA

Leva cerca de 15 minutos. Tudo fica na conta Google **alanssouza.23@gmail.com**.

## 1. Criar a ponte no Google (Apps Script)

1. Abra **https://script.google.com** com a sua conta e clique em **Novo projeto**.
2. Renomeie o projeto (no topo, "Projeto sem título") para **Revisão TKA**.
3. No arquivo `Código.gs` que já existe, apague tudo e cole o conteúdo de `backend/Codigo.gs`.
4. Clique em **+** ao lado de "Arquivos" → **Script** → nome `Planilha` → cole `backend/Planilha.gs`.
5. Repita para `Midia` → cole `backend/Midia.gs`.
6. Salve (ícone de disquete ou Ctrl+S).

## 2. Criar a planilha e a pasta

1. No seletor de funções (ao lado de "Executar"), escolha **setup** e clique em **Executar**.
2. O Google vai pedir autorização: **Revisar permissões** → escolha sua conta → **Avançado** → **Acessar Revisão TKA (não seguro)** → **Permitir**.
   (O aviso aparece porque o script é seu e não foi publicado na loja do Google.)
3. No seu Drive aparecem a planilha **Revisão TKA – Base** e a pasta **Revisão TKA**.

## 3. Definir as senhas

1. Menu à esquerda: **Configurações do projeto** (engrenagem) → **Propriedades do script** → **Adicionar propriedade**.
2. Crie:
   - `SENHA_REGISTRO` → senha de quem registra visitas (você e quem mais for preencher).
   - `SENHA_CONSULTA` → senha só para ver (ex.: engenheiro da TKA).
3. **Salvar propriedades do script**. Não apague `PLANILHA_ID` e `PASTA_ID`, que o setup criou.

## 4. Publicar a ponte

1. **Implantar** → **Nova implantação** → engrenagem → **App da Web**.
2. Descrição: `Revisão TKA`. **Executar como:** Eu. **Quem pode acessar:** Qualquer pessoa.
3. **Implantar** e copie a **URL do app da Web** (termina em `/exec`).

> Se alterar o código depois: **Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão → Implantar**. A URL continua a mesma.

## 5. Ligar o app à ponte e carga inicial (feita pelo Claude)

1. A URL do passo 4 vai em `app/js/config.js` (`API_URL`). Sem isso o app mostra "Sem conexão" no login.
2. Com a URL e a `SENHA_REGISTRO`:

```
node tools/enviar-seed.mjs <URL> <SENHA_REGISTRO>
```

Carrega as 55 máquinas e a lista de funcionários ativos (somente matrícula, nome, função, centro de custo e filial).

## 6. Publicar o app (GitHub Pages)

1. Crie o repositório **revisao-tka** em https://github.com/new (público, sem README).
2. Após o primeiro push: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. O endereço do app fica `https://<seu-usuario>.github.io/revisao-tka/`.

## 7. Teste no iPhone (obrigatório antes de 20/10)

1. Abra o endereço no **Safari** → entre com seu nome e a senha de registro.
2. **Compartilhar → Adicionar à Tela de Início**. Feche o Safari e abra pelo ícone.
3. Ative o **modo avião**.
4. Faça uma visita de teste: status, KM, horímetro, 1 pessoa na equipe, 1 ocorrência com **2 fotos** e **1 vídeo de ~20 s**.
5. Feche o app pelo multitarefa e abra de novo: tudo tem que estar lá.
6. Desligue o modo avião. O selo no topo deve mudar para **Sincronizado hh:mm**.
7. Confira na planilha e na pasta `Revisão TKA/<placa>/<data>/`; abra um arquivo pelo link numa aba anônima.
8. Depois do teste, apague na planilha as linhas da visita de teste (abas Visitas, Equipe, Ocorrencias, Midias, Alteracoes) e a pasta da data. Na aba Equipamentos, limpe `serie_munck`, `km_atual_campo` e `horimetro_atual` da placa usada no teste.

## Dia a dia

- O selo no topo mostra quantos itens faltam enviar. Tocar nele força o envio.
- Se aparecer o aviso vermelho de fotos/vídeos acumulados, conecte-se a uma rede (Wi-Fi do hotel, por exemplo) e deixe o app aberto até zerar.
- Para trocar uma senha: altere a propriedade no Apps Script. Quem estiver com a senha antiga recebe o aviso para sair e entrar de novo.
