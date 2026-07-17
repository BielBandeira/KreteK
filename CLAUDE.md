# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Sobre o projeto

Site do KRETEK, coletivo artístico de Sofia Eufrasino, para catalogar/vender roupas. Projeto em estágio inicial (protótipo): stack 100% JavaScript (front-end vanilla + back-end Node/Express + SQLite), sem build system, sem testes. Tem duas áreas: catálogo público (leitura) e backoffice em `/admin` (CRUD de peças) protegido por login — só a dona do site acessa.

## Rodando o projeto

```bash
npm install
cp .env.example .env
npm run gerar-hash -- "sua-senha-aqui"   # cole o hash gerado em ADMIN_PASSWORD_HASH no .env
npm start
```

O servidor recusa subir sem `SESSION_SECRET`, `ADMIN_USER` e `ADMIN_PASSWORD_HASH` no `.env` (validação no topo do `server.js`). Isso sobe o Express em `http://localhost:5000`, servindo a API, o catálogo público (`public/`) e o backoffice protegido (`views/`). Não precisa de servidor HTTP separado para o front-end.

Não existem comandos de lint, build ou testes configurados neste projeto.

## Arquitetura

- `server.js` — API Express + autenticação. Persistência via SQLite (`better-sqlite3`), arquivo `kretek.db` na raiz (não versionado, criado/populado/migrado automaticamente ao iniciar — colunas `preco`, `foto`, `descricao` são adicionadas via `ALTER TABLE` se o banco já existir sem elas). Rotas REST em `/roupas` (GET lista/por id são públicas; POST, PUT, DELETE exigem sessão). `cor`/`tamanho` são armazenados como JSON string nas colunas e convertidos de/para array pela função `paraRoupa`.
- **Duas middlewares de auth distintas, não uma só**: `exigirAutenticacaoPagina` (redireciona pro `/login`, usada na rota `GET /admin`) e `exigirAutenticacaoApi` (sempre `401` JSON, usada em POST/PUT/DELETE `/roupas`). Não unificar isso checando `req.accepts("html")` — um `fetch` sem `Accept` explícito também "aceita" HTML, então a rota de API acabaria redirecionando em vez de retornar 401, e o front-end interpretaria o redirect como sucesso.
- `public/` — servido estaticamente por `express.static`: `index.html` (catálogo público, cards linkam pra `produto.html`), `produto.html` (detalhe de uma peça), `style.css`, `script.js` (busca/renderiza os cards do catálogo), `produto.js` (lê `?id=` da query string, busca `GET /roupas/:id` e renderiza), `admin.js` (lógica do backoffice: adicionar/remover peça, logout), `login.js`.
- **Detalhe da peça é página própria (`produto.html?id=`), não modal**: identificação da peça é por query string lida no client (`new URLSearchParams(window.location.search)`), não por rota de servidor — `produto.html` continua sendo um arquivo estático comum, sem precisar de rota nova no `server.js` pra cada produto.
- `views/` — **propositalmente fora de `public/`**, para não ser servido como estático: `admin.html` e `login.html` só são alcançáveis pelas rotas `GET /admin` (protegida) e `GET /login`. Se esses arquivos fossem movidos para dentro de `public/`, o backoffice ficaria acessível direto pela URL sem login.
- `scripts/gerar-hash.js` — gera o hash bcrypt de uma senha em texto puro, para colocar em `ADMIN_PASSWORD_HASH` no `.env`.
- **Botão "Comprar" ainda é placeholder** (`alert()` em `produto.js`) — a integração real com WhatsApp (`https://wa.me/<numero>?text=...`) é próximo passo pendente, o número/mensagem ainda não foram definidos.

## Pontos a ter em atenção

- SQLite não é ideal para alta concorrência de escrita — se isso virar gargalo, avaliar migração para Postgres (ver README).
- A URL da API está hardcoded em `script.js`/`produto.js`/`admin.js`; ao mudar host/porta do servidor, atualizar também esse valor.
- `node_modules` e `.env` não devem ser versionados (estão no `.gitignore`).
- Autenticação é single-user por variáveis de ambiente — não há tabela de usuários. Se isso mudar (mais de uma pessoa administrando), a abordagem de auth precisa ser revista, não só adicionar mais um usuário no `.env`.
- `foto` é uma URL de imagem externa, não upload de arquivo — não assumir que existe armazenamento de imagem no servidor.
- **`style.css` tem uma regra global `[hidden] { display: none !important }`.** Não remover nem contornar isso: sem ela, qualquer elemento escondido via atributo `hidden` que também tenha `display` definido por outra regra (`display: grid/flex`, comum em seções de layout) fica visível mesmo "escondido" — a regra de display do autor vence o `[hidden]` do navegador na cascata. Foi um bug real (modal que não fechava) antes dessa regra existir.

## Infraestrutura

Hospedagem decidida: VM Oracle Cloud "Always Free" + subdomínio DuckDNS (domínio próprio fica para o futuro). Detalhes completos, incluindo o cron de heartbeat contra reclamação de conta por inatividade, o lembrete mensal de login no console e o budget alert de US$ 1, estão documentados na seção "Infraestrutura / Hospedagem" do `README.md` — mantenha os dois em sincronia se algo mudar aqui.
