const API = "http://localhost:5000"

document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault()

  const usuario = document.getElementById("input-usuario").value
  const senha = document.getElementById("input-senha").value

  const resposta = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, senha })
  })

  if (resposta.ok) {
    window.location.href = "/admin"
    return
  }

  const el = document.getElementById("mensagem")
  el.textContent = "Usuário ou senha inválidos."
})
