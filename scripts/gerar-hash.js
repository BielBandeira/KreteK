const bcrypt = require("bcryptjs")

const senha = process.argv[2]

if (!senha) {
  console.error("Uso: npm run gerar-hash -- \"sua-senha\"")
  process.exit(1)
}

console.log(bcrypt.hashSync(senha, 10))
