require("dotenv").config()

const express = require("express")
const cors = require("cors")
const path = require("path")
const session = require("express-session")
const bcrypt = require("bcryptjs")
const Database = require("better-sqlite3")

const { SESSION_SECRET, ADMIN_USER, ADMIN_PASSWORD_HASH } = process.env

if (!SESSION_SECRET || !ADMIN_USER || !ADMIN_PASSWORD_HASH) {
  throw new Error(
    "Variáveis de ambiente faltando (SESSION_SECRET, ADMIN_USER, ADMIN_PASSWORD_HASH). Copie .env.example para .env e preencha os valores — use 'npm run gerar-hash -- <senha>' para gerar o hash."
  )
}

const app = express()
app.use(cors())
app.use(express.json())
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 }, // 8h
  })
)

const db = new Database(path.join(__dirname, "kretek.db"))
db.pragma("journal_mode = WAL")

db.exec(`
  CREATE TABLE IF NOT EXISTS roupas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cor TEXT NOT NULL,
    tamanho TEXT NOT NULL
  )
`)

// migração: adiciona colunas em bancos criados antes delas existirem
const colunas = db.prepare("PRAGMA table_info(roupas)").all()
const temColuna = (nome) => colunas.some((coluna) => coluna.name === nome)

if (!temColuna("preco")) {
  db.exec("ALTER TABLE roupas ADD COLUMN preco REAL NOT NULL DEFAULT 0")
}
if (!temColuna("foto")) {
  db.exec("ALTER TABLE roupas ADD COLUMN foto TEXT NOT NULL DEFAULT ''")
}
if (!temColuna("descricao")) {
  db.exec("ALTER TABLE roupas ADD COLUMN descricao TEXT NOT NULL DEFAULT ''")
}

// popula com dados de exemplo só na primeira execução (tabela vazia)
const { total } = db.prepare("SELECT COUNT(*) AS total FROM roupas").get()
if (total === 0) {
  const seed = db.prepare(
    "INSERT INTO roupas (nome, cor, tamanho, preco, foto, descricao) VALUES (?, ?, ?, ?, ?, ?)"
  )
  seed.run(
    "camisa chungwa",
    JSON.stringify(["vermelha", "preta"]),
    JSON.stringify(["G", "M", "P"]),
    89.9,
    "",
    "Peça exclusiva do coletivo KRETEK, produção limitada."
  )
  seed.run(
    "camisa marlboro",
    JSON.stringify(["preta", "branca"]),
    JSON.stringify(["G", "M", "P"]),
    99.9,
    "",
    "Peça exclusiva do coletivo KRETEK, produção limitada."
  )
}

// converte a linha do banco (cor/tamanho como JSON string) para o formato da API
function paraRoupa(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    cor: JSON.parse(linha.cor),
    tamanho: JSON.parse(linha.tamanho),
    preco: linha.preco,
    foto: linha.foto,
    descricao: linha.descricao,
  }
}

function buscarRoupa(id) {
  const linha = db.prepare("SELECT * FROM roupas WHERE id = ?").get(id)
  return linha ? paraRoupa(linha) : undefined
}

// protege a página do backoffice: sem sessão, redireciona pro login
function exigirAutenticacaoPagina(req, res, next) {
  if (req.session && req.session.autenticado) {
    return next()
  }
  res.redirect("/login")
}

// protege as rotas de API do backoffice: sem sessão, sempre 401 JSON
// (nunca redireciona — um fetch sem Accept: application/json também "aceita" html,
// então checar req.accepts aqui faria o front-end achar que deu certo)
function exigirAutenticacaoApi(req, res, next) {
  if (req.session && req.session.autenticado) {
    return next()
  }
  res.status(401).json({ erro: "Não autenticado" })
}

// serve os arquivos estáticos públicos (index.html, style.css, script.js, admin.js, login.js).
// só a pasta public/ é servida como estático — views/ (admin.html, login.html) fica de fora
// de propósito, para não ser possível acessar o backoffice direto pela URL sem passar
// pelas rotas protegidas abaixo.
const PASTA_PUBLICA = path.join(__dirname, "public")
app.use(express.static(PASTA_PUBLICA))

app.get("/", (req, res) => {
  res.sendFile(path.join(PASTA_PUBLICA, "index.html"))
})

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"))
})

app.post("/login", (req, res) => {
  const { usuario, senha } = req.body || {}

  const valido = usuario === ADMIN_USER && bcrypt.compareSync(senha || "", ADMIN_PASSWORD_HASH)

  if (!valido) {
    return res.status(401).json({ erro: "Usuário ou senha inválidos" })
  }

  req.session.autenticado = true
  res.json({ ok: true })
})

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }))
})

app.get("/admin", exigirAutenticacaoPagina, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin.html"))
})

// GET /roupas - lista todas as roupas (catálogo público)
app.get("/roupas", (req, res) => {
  const linhas = db.prepare("SELECT * FROM roupas").all()
  res.json(linhas.map(paraRoupa))
})

// GET /roupas/:id - busca a roupa pelo ID (catálogo público)
app.get("/roupas/:id", (req, res) => {
  const roupa = buscarRoupa(Number(req.params.id))
  if (!roupa) {
    return res.status(404).json({ erro: "Roupa nao encontrada" })
  }
  res.json(roupa)
})

// POST /roupas — cria uma nova roupa (só backoffice)
app.post("/roupas", exigirAutenticacaoApi, (req, res) => {
  const dados = req.body

  if (!dados || !dados.nome) {
    return res.status(400).json({ erro: "Post invalido" })
  }

  const tamanho = dados.tamanho || ["G", "M", "P"]
  const preco = Number(dados.preco) || 0
  const foto = dados.foto || ""
  const descricao = dados.descricao || ""
  const resultado = db
    .prepare("INSERT INTO roupas (nome, cor, tamanho, preco, foto, descricao) VALUES (?, ?, ?, ?, ?, ?)")
    .run(dados.nome, JSON.stringify(dados.cor), JSON.stringify(tamanho), preco, foto, descricao)

  res.status(201).json(buscarRoupa(resultado.lastInsertRowid))
})

// PUT /roupas/:id - edita uma roupa existente (só backoffice)
app.put("/roupas/:id", exigirAutenticacaoApi, (req, res) => {
  const roupa = buscarRoupa(Number(req.params.id))
  if (!roupa) {
    return res.status(404).json({ erro: "Essa roupa nao existe" })
  }

  const dados = req.body
  const nome = dados.nome !== undefined ? dados.nome : roupa.nome
  const cor = dados.cor !== undefined ? dados.cor : roupa.cor
  const tamanho = dados.tamanho !== undefined ? dados.tamanho : roupa.tamanho
  const preco = dados.preco !== undefined ? Number(dados.preco) : roupa.preco
  const foto = dados.foto !== undefined ? dados.foto : roupa.foto
  const descricao = dados.descricao !== undefined ? dados.descricao : roupa.descricao

  db.prepare("UPDATE roupas SET nome = ?, cor = ?, tamanho = ?, preco = ?, foto = ?, descricao = ? WHERE id = ?").run(
    nome,
    JSON.stringify(cor),
    JSON.stringify(tamanho),
    preco,
    foto,
    descricao,
    roupa.id
  )

  res.json(buscarRoupa(roupa.id))
})

// DELETE /roupas/:id - remove uma roupa (só backoffice)
app.delete("/roupas/:id", exigirAutenticacaoApi, (req, res) => {
  const roupa = buscarRoupa(Number(req.params.id))
  if (!roupa) {
    return res.status(404).json({ erro: "Roupa nao existe" })
  }
  db.prepare("DELETE FROM roupas WHERE id = ?").run(roupa.id)
  res.json({ mensagem: "Roupa removida." })
})

app.listen(5000, () => {
  console.log("Servidor rodando em http://localhost:5000")
})
