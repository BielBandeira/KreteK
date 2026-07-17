// endereço base da API — muda aqui se mudar a porta
const API = "http://localhost:5000"

// formata número para "R$ 99,90"
function formatarPreco(preco) {
  return preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

// ================================
// CARREGAR E RENDERIZAR ROUPAS
// ================================

async function carregarRoupas() {
  const resposta = await fetch(`${API}/roupas`)
  const roupas = await resposta.json()

  const lista = document.getElementById("lista")
  lista.innerHTML = "" // limpa os cards antes de renderizar de novo

  for (const roupa of roupas) {
    lista.appendChild(criarCard(roupa))
  }
}

function criarCard(roupa) {
  const card = document.createElement("div")
  card.className = "card"

  const foto = roupa.foto
    ? `<img class="card-foto" src="${roupa.foto}" alt="${roupa.nome}" />`
    : `<div class="card-foto card-sem-foto">sem foto</div>`

  card.innerHTML = `
    ${foto}
    <h3>${roupa.nome}</h3>
    <p class="card-preco">${formatarPreco(roupa.preco)}</p>
    <p>Cor: ${roupa.cor}</p>
    <p>Tamanho: ${roupa.tamanho}</p>
    <p class="card-id">id: ${roupa.id}</p>
    <button class="btn-remover" onclick="deletarRoupa(${roupa.id})">Remover</button>
  `

  return card
}

// ================================
// ADICIONAR ROUPA (POST)
// ================================

document.getElementById("form-adicionar").addEventListener("submit", async (e) => {
  e.preventDefault()

  const nome = document.getElementById("input-nome").value
  const cor = document.getElementById("input-cor").value
    .split(",")
    .map(s => s.trim())

  const tamanhoInput = document.getElementById("input-tamanho").value
  const tamanho = tamanhoInput
    ? tamanhoInput.split(",").map(s => s.trim())
    : ["G", "M", "P"]

  const preco = Number(document.getElementById("input-preco").value)
  const foto = document.getElementById("input-foto").value
  const descricao = document.getElementById("input-descricao").value

  const resposta = await fetch(`${API}/roupas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome, cor, tamanho, preco, foto, descricao })
  })

  if (resposta.status === 401) {
    return redirecionarParaLogin()
  }

  if (resposta.ok) {
    document.getElementById("form-adicionar").reset()
    mostrarMensagem("Roupa adicionada!")
    carregarRoupas()
  }
})

// ================================
// REMOVER ROUPA (DELETE)
// ================================

async function deletarRoupa(id) {
  const resposta = await fetch(`${API}/roupas/${id}`, { method: "DELETE" })

  if (resposta.status === 401) {
    return redirecionarParaLogin()
  }

  mostrarMensagem("Roupa removida.")
  carregarRoupas()
}

// ================================
// SESSÃO / LOGOUT
// ================================

function redirecionarParaLogin() {
  window.location.href = "/login"
}

document.getElementById("btn-sair").addEventListener("click", async () => {
  await fetch(`${API}/logout`, { method: "POST" })
  redirecionarParaLogin()
})

// ================================
// FEEDBACK PARA O USUÁRIO
// ================================

function mostrarMensagem(texto) {
  const el = document.getElementById("mensagem")
  el.textContent = texto
  setTimeout(() => el.textContent = "", 3000)
}

// ================================
// INICIALIZAÇÃO
// ================================

carregarRoupas()
