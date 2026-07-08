// endereço base da API — muda aqui se mudar a porta
const API = "http://localhost:5000"

// ================================
// CARREGAR E RENDERIZAR ROUPAS
// ================================

// busca todas as roupas na API e monta os cards na tela
async function carregarRoupas() {
  const resposta = await fetch(`${API}/roupas`)
  const roupas = await resposta.json()

  const lista = document.getElementById("lista")
  lista.innerHTML = "" // limpa os cards antes de renderizar de novo

  for (const roupa of roupas) {
    lista.appendChild(criarCard(roupa))
  }
}

// cria e retorna o elemento HTML de um card a partir de um objeto roupa
function criarCard(roupa) {
  const card = document.createElement("div")
  card.className = "card"

  card.innerHTML = `
    <h3>${roupa.nome}</h3>
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
  // evita o comportamento padrão do form (recarregar a página)
  e.preventDefault()

  // lê os valores dos campos
  const nome = document.getElementById("input-nome").value
  const cor = document.getElementById("input-cor").value
    .split(",")
    .map(s => s.trim()) // transforma "azul, branca" em ["azul", "branca"]

  const tamanhoInput = document.getElementById("input-tamanho").value
  const tamanho = tamanhoInput
    ? tamanhoInput.split(",").map(s => s.trim())
    : ["G", "M", "P"] // usa tamanho padrão se o campo estiver vazio

  // envia os dados para a API
  const resposta = await fetch(`${API}/roupas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome, cor, tamanho })
  })

  if (resposta.ok) {
    document.getElementById("form-adicionar").reset()
    mostrarMensagem("Roupa adicionada!")
    carregarRoupas() // atualiza a lista
  }
})

// ================================
// REMOVER ROUPA (DELETE)
// ================================

async function deletarRoupa(id) {
  await fetch(`${API}/roupas/${id}`, { method: "DELETE" })
  mostrarMensagem("Roupa removida.")
  carregarRoupas() // atualiza a lista
}

// ================================
// FEEDBACK PARA O USUÁRIO
// ================================

// exibe uma mensagem por 3 segundos e depois some
function mostrarMensagem(texto) {
  const el = document.getElementById("mensagem")
  el.textContent = texto
  setTimeout(() => el.textContent = "", 3000)
}

// ================================
// INICIALIZAÇÃO
// ================================

// carrega as roupas assim que a página abre
carregarRoupas()
