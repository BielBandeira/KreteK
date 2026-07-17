# 4zandeira — guia do projeto KRETEK pra quem tá começando

Esse arquivo é pra você. A ideia é explicar como o projeto funciona por dentro, de um jeito
simples, sem assumir que você já manja de tudo. Se ler algo aqui e ainda ficar com dúvida,
é sinal de que o texto precisa melhorar — pergunta e a gente atualiza esse arquivo.

Ele não substitui o `README.md` (que fala mais de negócio/decisões) nem o `CLAUDE.md` (que é
voltado pra IA); esse aqui é sobre **entender o código**.

---

## 1. O que esse projeto faz, em uma frase

É o site do KRETEK (coletivo de moda) com duas partes: uma página pública onde qualquer
pessoa vê o catálogo de roupas, e um backoffice (área restrita) onde a dona do site cadastra,
edita e remove peças.

## 2. As 3 peças que formam o projeto

```
┌─────────────┐        ┌──────────────┐        ┌─────────────┐
│  Navegador  │ <----> │   server.js  │ <----> │  kretek.db  │
│ (HTML/CSS/  │  HTTP  │  (Express,   │  SQL   │  (SQLite)   │
│    JS)      │        │   Node.js)   │        │             │
└─────────────┘        └──────────────┘        └─────────────┘
```

- **Navegador**: o que a pessoa vê e clica. É HTML + CSS + JavaScript "puro" — sem React,
  Vue, Angular, nem nada disso. Só JS mesmo, direto no browser.
- **`server.js`**: o back-end. É um programa Node.js que fica rodando, esperando pedidos
  (requisições) do navegador, e respondendo. Usa o framework **Express** pra isso.
- **`kretek.db`**: o banco de dados. É só um arquivo (SQLite não precisa de um servidor de
  banco separado, tipo Postgres/MySQL — o banco inteiro é um arquivo na pasta do projeto).

Se você nunca trabalhou com um back-end antes, pensa assim: o navegador **nunca** fala direto
com o banco de dados. Ele sempre pede pro `server.js`, e só o `server.js` sabe conversar com
o `kretek.db`. Essa camada do meio existe pra validar, proteger e organizar o acesso aos dados.

## 3. Onde fica cada arquivo (e por quê)

```
public/               → arquivos que QUALQUER visitante pode acessar direto pela URL
  index.html             → catálogo público
  produto.html            → página de uma peça específica
  script.js               → JS do catálogo
  produto.js               → JS da página da peça
  admin.js                 → JS do backoffice
  login.js                  → JS da tela de login
  style.css                 → CSS de tudo (é um arquivo só, compartilhado)

views/                → arquivos que só chegam até o navegador se a pessoa tiver logada
  admin.html             → a página do backoffice em si
  login.html              → a página de login

server.js             → o back-end (Express + SQLite + autenticação)
scripts/gerar-hash.js  → uma ferramenta de linha de comando (não roda no site, você que roda)
```

**Por que `views/` é separado de `public/`?** Essa é provavelmente a primeira coisa estranha
que você vai notar. No Express, tudo que está dentro da pasta marcada como "pasta pública"
(no nosso caso, `public/`) pode ser acessado por **qualquer pessoa**, só digitando a URL —
mesmo que não tenha feito login. Se `admin.html` estivesse dentro de `public/`, bastaria
alguém digitar `seusite.com/admin.html` pra ver a tela do backoffice, sem precisar de senha
nenhuma (mesmo que os botões não funcionassem sem sessão, a página em si já vazaria).

Por isso, `admin.html` e `login.html` moram em `views/`, uma pasta que o Express **não**
serve como estático. A única forma de "chegar" nesses arquivos é pela rota `/admin` do
`server.js`, que primeiro checa se a pessoa está logada antes de entregar o HTML.

## 4. Tour pelo `server.js`, por partes

### 4.1 — Configuração inicial

```js
require("dotenv").config()
```

Isso carrega o arquivo `.env` (que você cria a partir do `.env.example`) e coloca os valores
dele em `process.env`. É assim que a gente guarda senha/segredos **fora do código**, pra não
ir parar no Git sem querer.

```js
const { SESSION_SECRET, ADMIN_USER, ADMIN_PASSWORD_HASH } = process.env

if (!SESSION_SECRET || !ADMIN_USER || !ADMIN_PASSWORD_HASH) {
  throw new Error(...)
}
```

Se essas variáveis não estiverem configuradas, o servidor **nem sobe** — ele quebra de
propósito, com uma mensagem de erro explicando o que fazer. Isso é melhor do que deixar
subir "quebrado" ou usar um valor padrão inseguro escondido no código.

### 4.2 — O banco de dados

```js
const db = new Database(path.join(__dirname, "kretek.db"))
```

Essa linha abre (ou cria, se não existir) o arquivo `kretek.db`. A partir daqui, `db` é o
objeto que a gente usa pra rodar comandos SQL.

```js
db.exec(`
  CREATE TABLE IF NOT EXISTS roupas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cor TEXT NOT NULL,
    tamanho TEXT NOT NULL
  )
`)
```

`CREATE TABLE IF NOT EXISTS` cria a tabela `roupas` só se ela ainda não existir — assim, toda
vez que o servidor liga, ele não tenta recriar (e quebrar) uma tabela que já tá lá.

Repara que essa tabela original só tem `nome`, `cor`, `tamanho`. As colunas `preco`, `foto` e
`descricao` foram adicionadas **depois**, então elas aparecem separado:

```js
const colunas = db.prepare("PRAGMA table_info(roupas)").all()
const temColuna = (nome) => colunas.some((coluna) => coluna.name === nome)

if (!temColuna("preco")) {
  db.exec("ALTER TABLE roupas ADD COLUMN preco REAL NOT NULL DEFAULT 0")
}
```

Isso é o que se chama de **migração**: quando o formato dos dados muda depois que o banco já
existe, você precisa de um comando que "ajusta" o banco antigo pro formato novo, sem apagar o
que já tinha. Aqui a gente faz isso na mão, checando se a coluna já existe antes de tentar
criar de novo (senão o SQLite reclamaria de coluna duplicada).

**Por que `cor` e `tamanho` são `TEXT` (texto) e não uma lista de verdade?**
SQLite não tem um tipo de dado "lista"/"array" nativo. A peça pode ter várias cores
(`["azul", "branca"]`), mas o banco só entende texto, número, etc. Então a gente transforma a
lista em texto antes de salvar (`JSON.stringify(["azul", "branca"])` vira a string
`'["azul","branca"]'`) e faz o caminho inverso quando lê (`JSON.parse(...)`, que volta a virar
uma lista de verdade em JavaScript). Isso acontece na função `paraRoupa`:

```js
function paraRoupa(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    cor: JSON.parse(linha.cor),       // texto do banco -> lista de novo
    tamanho: JSON.parse(linha.tamanho),
    preco: linha.preco,
    foto: linha.foto,
    descricao: linha.descricao,
  }
}
```

Toda vez que uma rota devolve uma peça pro navegador, ela passa por essa função primeiro.

### 4.3 — Autenticação (login)

O projeto usa **sessão com cookie**, não [JWT](https://jwt.io/) nem nada mais sofisticado.
Funciona assim:

1. Você manda usuário/senha pra `POST /login`.
2. O servidor confere a senha com `bcrypt.compareSync` (explico o bcrypt mais abaixo).
3. Se bateu, o servidor guarda `req.session.autenticado = true` e manda um cookie de volta
   pro navegador.
4. Em toda requisição seguinte, o navegador manda esse cookie de volta sozinho (é assim que
   cookie funciona), e o servidor sabe "ah, essa pessoa já logou".

```js
app.post("/login", (req, res) => {
  const { usuario, senha } = req.body || {}
  const valido = usuario === ADMIN_USER && bcrypt.compareSync(senha || "", ADMIN_PASSWORD_HASH)

  if (!valido) {
    return res.status(401).json({ erro: "Usuário ou senha inválidos" })
  }

  req.session.autenticado = true
  res.json({ ok: true })
})
```

**Por que a senha não fica em texto puro no `.env`?** Porque se alguém (ou algum bug) vazar
o arquivo `.env`, a senha real não fica exposta — só um hash (uma "digestão" da senha que não
dá pra reverter). `bcrypt.compareSync(senha, hash)` testa se a senha digitada, quando
"hasheada" do mesmo jeito, bate com o hash salvo — sem nunca precisar guardar a senha real em
lugar nenhum. Por isso existe o `scripts/gerar-hash.js`: ele só serve pra você gerar esse hash
uma vez, na sua máquina, e colar no `.env`.

**Duas funções de proteção, não uma só** — isso é sutil e importante:

```js
function exigirAutenticacaoPagina(req, res, next) {
  if (req.session && req.session.autenticado) return next()
  res.redirect("/login")
}

function exigirAutenticacaoApi(req, res, next) {
  if (req.session && req.session.autenticado) return next()
  res.status(401).json({ erro: "Não autenticado" })
}
```

Essas são **middlewares**: funções que rodam *antes* da rota de verdade, e decidem se deixam
a requisição continuar (`next()`) ou cortam ali (respondendo elas mesmas). A diferença entre
as duas: a de página redireciona o navegador pro `/login` (faz sentido quando é alguém
navegando pelo site); a de API sempre responde `401` (código HTTP de "não autorizado"), porque
se ela redirecionasse, o JavaScript do front-end (`fetch`) ia receber uma resposta "de boas"
e achar que deu tudo certo, quando na verdade a ação não aconteceu. Misturar as duas foi
literalmente um bug que a gente teve e corrigiu — vale entender esse motivo antes de "juntar"
essas funções de novo.

### 4.4 — As rotas de `/roupas`

```js
app.get("/roupas", (req, res) => { ... })          // pública — qualquer um pode ver
app.get("/roupas/:id", (req, res) => { ... })       // pública
app.post("/roupas", exigirAutenticacaoApi, ...)     // só logado
app.put("/roupas/:id", exigirAutenticacaoApi, ...)  // só logado
app.delete("/roupas/:id", exigirAutenticacaoApi, ...) // só logado
```

Isso é uma **API REST**: um jeito padronizado de organizar rotas usando o "verbo" HTTP pra
dizer a intenção — `GET` pra ler, `POST` pra criar, `PUT` pra atualizar, `DELETE` pra remover
— todos na mesma URL `/roupas` (o que muda é o verbo, não o caminho). Repare que os `GET` não
têm o `exigirAutenticacaoApi` no meio — são as únicas rotas que qualquer visitante do site
pode chamar sem estar logado, porque são as que o catálogo público usa.

## 5. Tour pelo front-end

O padrão se repete nos 4 arquivos JS do front (`script.js`, `produto.js`, `admin.js`,
`login.js`): eles usam `fetch` pra conversar com o back-end.

```js
async function carregarRoupas() {
  const resposta = await fetch(`${API}/roupas`)
  const roupas = await resposta.json()
  ...
}
```

Se `async`/`await` for novidade pra você: `fetch` demora um tempinho (é uma requisição de
rede), então ele não devolve a resposta na hora — devolve uma "promessa" (`Promise`) de que a
resposta vai chegar. `await` pausa a função até a promessa ser cumprida, sem travar o resto da
página. `async` na frente da função é obrigatório pra poder usar `await` dentro dela.

**Como o catálogo "sabe" qual peça mostrar na página de detalhe?** `produto.html` é o
**mesmo arquivo HTML pra qualquer peça** — o que muda é o `id` que vai na URL, tipo
`produto.html?id=3`. O `produto.js` lê esse `id` assim:

```js
const id = new URLSearchParams(window.location.search).get("id")
```

`window.location.search` pega a parte da URL depois do `?` (`?id=3`), e `URLSearchParams`
ajuda a ler esses pares chave=valor sem você ter que fatiar a string na mão.

## 6. Conceitos que talvez sejam novos pra você

- **API REST**: um jeito de organizar rotas de um back-end usando os verbos HTTP
  (GET/POST/PUT/DELETE) pra representar ações (ler/criar/editar/remover) sobre um "recurso"
  (aqui, `roupas`).
- **Middleware** (no Express): uma função que roda no meio do caminho de uma requisição, antes
  da rota final. Serve pra coisas que várias rotas precisam em comum — aqui, checar login.
- **Cookie / sessão**: um jeitinho do navegador "lembrar" quem você é entre uma requisição e
  outra. O servidor manda um cookie, o navegador guarda e reenvia automaticamente depois.
- **Hash (bcrypt)**: uma transformação de mão única aplicada numa senha. Dá pra checar se uma
  senha bate com o hash, mas não dá pra "desfazer" o hash e descobrir a senha original.
- **Variável de ambiente / `.env`**: configuração que fica fora do código-fonte (e fora do
  Git), pra separar segredo de código.
- **Migração de banco**: um comando que ajusta a estrutura de um banco que já existe (ex:
  adicionar uma coluna nova), sem perder os dados que já estavam lá.
- **CORS**: uma regra de segurança do navegador que, por padrão, bloqueia um site de chamar a
  API de outro domínio/porta. O pacote `cors` no `server.js` libera isso.

## 7. Passo a passo de uma ação real: "adicionar uma peça"

1. Na tela do backoffice (`views/admin.html`), a dona preenche o formulário e clica em
   "ADICIONAR PEÇA".
2. Isso dispara o `submit` do formulário, capturado aqui em `admin.js`:
   ```js
   document.getElementById("form-adicionar").addEventListener("submit", async (e) => {
     e.preventDefault() // impede o comportamento padrão do form (recarregar a página)
     ...
   })
   ```
3. `admin.js` monta um objeto com os dados dos campos e manda pro back-end:
   ```js
   fetch(`${API}/roupas`, { method: "POST", ..., body: JSON.stringify({ nome, cor, ... }) })
   ```
4. No `server.js`, a requisição passa primeiro pelo `exigirAutenticacaoApi` (confere se tem
   sessão válida) e só depois chega na rota `app.post("/roupas", ...)`.
5. A rota valida o `nome`, monta os valores (inclusive convertendo `cor`/`tamanho` pra texto
   com `JSON.stringify`) e roda um `INSERT` no SQLite.
6. O servidor responde com a peça recém-criada (em JSON).
7. De volta no `admin.js`, se a resposta veio OK, ele limpa o formulário, mostra uma mensagem
   de sucesso e chama `carregarRoupas()` de novo — que faz um novo `GET /roupas` e redesenha a
   lista, agora já incluindo a peça nova.

## 8. Perguntas que você provavelmente vai ter

**"Rodei `npm start` e deu erro dizendo que faltam variáveis de ambiente"**
Você ainda não criou o `.env`. Copie o `.env.example` pra `.env` e preencha os valores — o
`README.md` tem o passo a passo, incluindo como gerar o hash da senha.

**"Deu erro `EADDRINUSE` ao rodar `npm start`"**
Já tem um `node server.js` rodando em outra aba/processo, ocupando a porta 5000. Encontre o
processo (`ps aux | grep server.js` no Linux/Mac) e finalize ele antes de rodar de novo.

**"Mudei o `style.css` e não mudou nada na tela"**
Dá um "hard refresh" no navegador (geralmente `Ctrl+Shift+R`) — às vezes o navegador guarda o
CSS antigo em cache.

**"Como eu vejo o que tem dentro do `kretek.db`?"**
Ele é um arquivo SQLite comum. Dá pra abrir com uma ferramenta como o "DB Browser for SQLite"
(interface gráfica) ou pelo terminal com `sqlite3 kretek.db` e depois `SELECT * FROM roupas;`.

**"Por que às vezes vejo `roupa.cor` sendo tratado como lista e às vezes parece texto?"**
Isso normalmente é confusão entre o dado *no banco* (sempre texto/JSON string) e o dado *na
API/JavaScript* (sempre lista, depois de passar pela função `paraRoupa`). Se você está direto
numa query SQL, é texto. Se já passou pela API (`fetch`), é lista.

**"O botão 'Comprar' não faz nada, é bug?"**
Não — é proposital por enquanto. Está documentado no `README.md`: falta decidir o número de
WhatsApp e o texto da mensagem antes de ligar esse botão de verdade.

## 9. Se ainda tiver dúvida

Esse arquivo não é a última palavra — se alguma explicação ficou confusa, ou se você teve uma
dúvida que não tá aqui, é sinal de que o arquivo precisa de mais uma seção. Atualiza ele (ou
pede pra alguém atualizar) assim que resolver a dúvida, pro próximo dev júnior não passar pelo
mesmo aperto.
