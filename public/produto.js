// endereço base da API — muda aqui se mudar a porta
const API = "http://localhost:5000"

// formata número para "R$ 99,90"
function formatarPreco(preco) {
  return preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function mostrarErro() {
  document.getElementById("produto-erro").hidden = false
}

async function carregarProduto() {
  const id = new URLSearchParams(window.location.search).get("id")

  if (!id) {
    return mostrarErro()
  }

  const resposta = await fetch(`${API}/roupas/${id}`)

  if (!resposta.ok) {
    return mostrarErro()
  }

  const roupa = await resposta.json()

  document.getElementById("produto-nome").textContent = roupa.nome
  document.getElementById("produto-preco").textContent = formatarPreco(roupa.preco)
  document.getElementById("produto-descricao").textContent = roupa.descricao || ""
  document.getElementById("produto-cor").textContent = roupa.cor
  document.getElementById("produto-tamanho").textContent = roupa.tamanho

  const img = document.getElementById("produto-img")
  const semFoto = document.getElementById("produto-sem-foto")
  if (roupa.foto) {
    img.src = roupa.foto
    img.alt = roupa.nome
    img.hidden = false
    semFoto.hidden = true
  } else {
    img.hidden = true
    semFoto.hidden = false
  }

  document.title = `KRETEK — ${roupa.nome}`
  document.getElementById("produto").hidden = false
}

// botão de comprar: por enquanto sem ação — vai virar link pro WhatsApp da dona
document.getElementById("produto-comprar").addEventListener("click", () => {
  alert("Em breve: compra via WhatsApp.")
})

carregarProduto()
