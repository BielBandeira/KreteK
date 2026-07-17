// endereço base da API — muda aqui se mudar a porta
const API = "http://localhost:5000"

// formata número para "R$ 99,90"
function formatarPreco(preco) {
  return preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

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

// cria e retorna o link (card) que leva pra página de detalhe da peça
function criarCard(roupa) {
  const card = document.createElement("a")
  card.className = "card"
  card.href = `produto.html?id=${roupa.id}`

  const foto = roupa.foto
    ? `<img class="card-foto" src="${roupa.foto}" alt="${roupa.nome}" />`
    : `<div class="card-foto card-sem-foto">sem foto</div>`

  card.innerHTML = `
    ${foto}
    <h3>${roupa.nome}</h3>
    <p class="card-preco">${formatarPreco(roupa.preco)}</p>
    <p>Cor: ${roupa.cor}</p>
    <p>Tamanho: ${roupa.tamanho}</p>
  `

  return card
}

// carrega as roupas assim que a página abre
carregarRoupas()
