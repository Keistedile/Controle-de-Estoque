# Estoque · Paysage Corpal

App de controle de estoque de materiais da assistência técnica. Feito para uso pelo celular em campo, com sincronização em tempo real entre aparelhos diferentes.

- **Aba "Entrada de dados"** — cadastrar novo material (obra, especificação, unidade, valor unitário, quantidade em estoque) e registrar retiradas.
- **Aba "Obras"** — a equipe de campo cadastra e remove obras diretamente pelo app, sem precisar mexer em código: nome, endereço, data de entrega e prazo final da assistência técnica. O app mostra automaticamente se a assistência de cada obra está **vigente** ou **expirada**. Uma obra só pode ser excluída se não houver nenhum material vinculado a ela.
- **Aba "Visão geral"** — valor total em estoque, gráfico dos materiais de maior valor parado, ranking de obras com maior/menor estoque, e tabela geral com busca.

O saldo disponível de cada material é calculado automaticamente: **quantidade em estoque − quantidade retirada**.

---

## 1. Como configurar o banco de dados (Firebase — gratuito)

Como vários técnicos vão usar o app ao mesmo tempo em celulares diferentes, os dados ficam guardados na nuvem (Firebase), não no próprio celular. O GitHub só hospeda os arquivos do app; quem guarda os dados é o Firebase.

1. Acesse **https://console.firebase.google.com** e faça login com uma conta Google.
2. Clique em **"Adicionar projeto"**, dê um nome (ex.: `estoque-paysgae`) e conclua a criação (pode desativar o Google Analytics, não é necessário).
3. No menu lateral, clique em **Compilação (Build) → Firestore Database → Criar banco de dados**.
   - Escolha a localização mais próxima (ex.: `southamerica-east1` — São Paulo).
   - Selecione **"Iniciar no modo de produção"**.
4. Vá em **Regras (Rules)** do Firestore e cole temporariamente:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
   ⚠️ **Isso deixa o banco aberto para qualquer pessoa com o link.** É o jeito mais simples para começar a usar rápido. Assim que possível, troque por autenticação (posso te ajudar a configurar login por e-mail/senha da equipe depois).
5. Volte para a tela inicial do projeto, clique no ícone **"</>"** (Web) para registrar um app.
   - Dê um apelido (ex.: `app-estoque`) e clique em **Registrar app**.
   - Copie o bloco `firebaseConfig` que aparece na tela.
6. Abra o arquivo `js/firebase-config.js` deste projeto e **cole seus dados** no lugar dos valores de exemplo (`apiKey`, `authDomain`, `projectId`, etc.).
7. Salve o arquivo.

Pronto — o app já está conectado ao seu banco de dados.

---

## 2. Como publicar no GitHub Pages

1. Crie um repositório novo no GitHub (ex.: `estoque-paysgae`).
2. Envie todos os arquivos desta pasta para o repositório (pela interface web do GitHub, arrastando os arquivos, ou via `git push`).
3. No repositório, vá em **Settings → Pages**.
4. Em **"Build and deployment"**, escolha **Source: Deploy from a branch**, branch **main**, pasta **/ (root)**. Clique em **Save**.
5. Aguarde 1–2 minutos. O link do app vai aparecer na mesma tela, algo como:
   `https://seu-usuario.github.io/estoque-paysgae/`
6. Envie esse link para a equipe — eles podem salvar como atalho na tela inicial do celular (funciona como um app).

---

## 3. Estrutura dos arquivos

```
estoque-paysgae/
├── index.html          → estrutura das duas abas do app
├── css/style.css        → todo o visual (cores, tipografia, layout)
├── js/firebase-config.js → suas credenciais do Firebase (editar aqui)
├── js/app.js             → lógica do app (formulários, gráfico, sincronização)
└── README.md
```

## 4. Identidade visual aplicada

O layout foi construído em cima do **PAYCO Digital Design System v1.1** (arquivo oficial fornecido pela equipe), reaproveitando os tokens de cor, espaçamento e os componentes de interface (botões, campos, badges, tabelas, tabs) exatamente como definidos nele — nenhuma cor foi inventada fora do documento.

**Tema claro/escuro:** o app segue a abordagem *dark-first* do design system, com um botão no topo para alternar para o tema claro (mais legível sob luz solar direta, útil em campo). A preferência fica salva no navegador de cada aparelho.

**Logotipo:** o app usa o vetor real da marca reduzida (`PAYCO`), extraído do sprite SVG do próprio design system — não é mais uma aproximação em texto.

**Cores principais (dark / light):**

| Uso no app                              | Token                    |
|------------------------------------------|---------------------------|
| Topo (nav), sempre escuro nos dois temas | `--nav-bg`                |
| Botões primários (Salvar material, Adicionar obra) | `--payco-olive` (`#889A48`) |
| Botão de retirada de estoque             | `--payco-terracotta` (`#A76F47`) — extensão do app, mesmo padrão construtivo do botão primário |
| Botão excluir obra                       | `--critical` (variante do terracota) |
| Badge "estoque baixo" / "assistência expirada" | `--critical` |
| Badge "entrada" / "assistência vigente"  | `--success` / `--payco-olive` |
| Fundo, cartões, texto                    | `--bg`, `--surface-card`, `--text-primary/secondary/muted` (variam por tema) |

Todos os tokens ficam no topo do `css/style.css`, copiados 1:1 do arquivo `design-system.html` oficial. Qualquer atualização futura da marca deve primeiro atualizar esse documento oficial e depois ser refletida aqui.

**Tipografia:** apenas **Montserrat** é usada na interface — o design system reserva a Galiwar (fonte do lettering da marca) só para peças editoriais (capa, divisores), nunca para interface funcional.

## 5. Próximos passos sugeridos

- Trocar as regras abertas do Firestore por login da equipe (Firebase Authentication).
- Adicionar exportação da tabela para Excel/PDF.
- Adicionar campo de "estoque mínimo" configurável por material, em vez do limite fixo de 15% usado hoje para o alerta de estoque baixo.
