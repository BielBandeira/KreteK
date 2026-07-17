# KRETEK

Site do KRETEK, coletivo artístico de Sofia Eufrasino, para catalogar e (futuramente) vender roupas do coletivo.

> Este README está no início e vai sendo populado conforme o projeto evolui. Se você tomar uma decisão de negócio ou técnica relevante, registre aqui.

## Contexto de negócio

- KRETEK é um projeto experimental que trabalha a fronteira entre consumo e identidade visual (ver texto do hero no site: "projeto experimental entre consumo e identidade visual").
- Lançamentos de peças são tratados como "drops" (ex: "NOVO DROP" na home).
- Cada peça cadastrada tem: nome, cores, tamanhos disponíveis, preço, foto e descrição.
- O site tem duas áreas: uma **página pública** (catálogo, só leitura, qualquer visitante acessa) e um **backoffice** (`/admin`, cadastro/edição/remoção de peças) restrito à dona do site, atrás de login.
- No catálogo público, clicar numa peça leva pra uma **página própria da peça** (`produto.html?id=...`), com foto grande, descrição, preço, botão "Comprar" e um botão "← Voltar" no cabeçalho pra navegar de volta pro catálogo.
- **O botão "Comprar" ainda não tem ação definitiva** — por enquanto só mostra um aviso ("em breve"). A ideia combinada é ele abrir uma conversa de WhatsApp com a dona do site (`https://wa.me/<numero>?text=...`), mas o número/mensagem ainda não foram definidos — ver "Próximos passos".
- Ainda **não há fluxo de checkout/pagamento dentro do site** — a venda deve continuar acontecendo por fora (WhatsApp), pelo menos nesta fase.

## Stack

- Front-end: HTML + CSS + JavaScript puro (sem framework, sem build step).
- Back-end: Node.js + Express, expondo uma API REST.
- Armazenamento: **SQLite** (via `better-sqlite3`), em um arquivo local `kretek.db` na raiz do projeto. Os dados persistem entre restarts do servidor. O arquivo do banco não é versionado (está no `.gitignore`) — na primeira execução em um ambiente novo, o `server.js` cria a tabela e popula com duas peças de exemplo.
- Autenticação do backoffice: sessão via `express-session` (cookie), senha com hash `bcrypt` (`bcryptjs`). Um único usuário administrador, configurado por variáveis de ambiente (não há tabela de usuários nem múltiplas contas).

## Como rodar

```bash
npm install
cp .env.example .env
npm run gerar-hash -- "sua-senha-aqui"   # copia o hash gerado para ADMIN_PASSWORD_HASH no .env
npm start
```

Antes do primeiro start, é obrigatório preencher o `.env` (o servidor recusa subir sem `SESSION_SECRET`, `ADMIN_USER` e `ADMIN_PASSWORD_HASH` configurados). `SESSION_SECRET` pode ser qualquer string aleatória longa; `ADMIN_USER` é o usuário de login do backoffice; `ADMIN_PASSWORD_HASH` é gerado pelo comando `npm run gerar-hash`.

O servidor sobe em `http://localhost:5000`, servindo:
- `/` — catálogo público (`public/index.html`).
- `/login` — tela de login do backoffice.
- `/admin` — backoffice (cadastro/edição/remoção de peças), só acessível autenticado.

### Como parar o servidor

Se você rodou `npm start` direto no terminal (primeiro plano), basta apertar **`Ctrl+C`** na
mesma janela.

Se ele ficou rodando em segundo plano (ex: você usou `&` no final do comando, ou abriu em
outra aba e esqueceu), encontre o processo e finalize manualmente:

```bash
ps aux | grep "node server.js"   # acha o PID (número na segunda coluna)
kill <PID>
```

Isso é comum de precisar quando aparece o erro `EADDRINUSE: address already in use :::5000`
ao tentar subir de novo — significa que já tem um servidor antigo ocupando a porta 5000.

Não há lint, testes ou build configurados neste projeto ainda.

## Estrutura do projeto

```
public/               → tudo que é servido publicamente como estático, sem autenticação
  index.html             → catálogo público (só leitura), cards linkam pra produto.html
  produto.html            → página de detalhe de uma peça (foto grande, descrição, botão comprar, botão voltar)
  style.css              → estilo visual (identidade: preto/branco/bege, fonte display Bebas Neue)
  script.js               → front-end do catálogo: busca as peças e renderiza os cards/links
  produto.js               → front-end da página de detalhe: lê ?id= da URL e busca a peça na API
  admin.js                → front-end do backoffice: formulário de cadastro, edição, remoção
  login.js                → front-end da tela de login
views/                → NÃO é servido como estático (só acessível via rota protegida no server.js)
  admin.html              → página do backoffice
  login.html              → página de login
scripts/
  gerar-hash.js           → gera o hash bcrypt da senha do admin, para colocar no .env
server.js             → back-end Express: rotas públicas, autenticação, API REST de roupas, acesso ao SQLite
kretek.db             → arquivo do banco SQLite (gerado automaticamente, não versionado)
.env / .env.example   → credenciais do admin e secret da sessão (.env não é versionado)
package.json          → dependências (express, cors, better-sqlite3, express-session, bcryptjs, dotenv)
```

**Importante:** `views/` fica fora da pasta `public/` de propósito — se `admin.html` estivesse dentro de `public/`, o Express serviria esse arquivo estaticamente e qualquer um poderia abrir o backoffice direto pela URL, pulando a checagem de login. A única forma de chegar em `admin.html` é pela rota `GET /admin`, que verifica a sessão antes de servir o arquivo.

## API

Base URL: `http://localhost:5000`

| Método | Rota           | Descrição                            | Autenticação |
|--------|----------------|----------------------------------------|--------------|
| GET    | `/roupas`      | Lista todas as peças                   | pública |
| GET    | `/roupas/:id`  | Busca uma peça por id                   | pública |
| POST   | `/roupas`      | Cria uma peça nova                      | backoffice |
| PUT    | `/roupas/:id`  | Edita uma peça existente                | backoffice |
| DELETE | `/roupas/:id`  | Remove uma peça                         | backoffice |
| POST   | `/login`       | Autentica e cria a sessão               | pública |
| POST   | `/logout`      | Encerra a sessão                        | pública |

Rotas marcadas como "backoffice" exigem sessão autenticada (cookie criado pelo `/login`) e retornam `401` sem ela.

Formato de uma peça:

```json
{
  "id": 1,
  "nome": "camisa chungwa",
  "cor": ["vermelha", "preta"],
  "tamanho": ["G", "M", "P"],
  "preco": 89.9,
  "foto": "https://exemplo.com/foto.jpg",
  "descricao": "Peça exclusiva do coletivo KRETEK, produção limitada."
}
```

Se `tamanho` não for enviado no POST, o padrão é `["G", "M", "P"]`.

## Decisões técnicas registradas

- **URL da API hardcoded em `script.js`/`admin.js`** (`const API = "http://localhost:5000"`): ao trocar host/porta do servidor, precisa atualizar esse valor manualmente. Sem variável de ambiente ainda.
- **Persistência via SQLite (`better-sqlite3`)**: escolhido por não exigir um serviço de banco separado (roda embutido no processo Node, arquivo local na VM). Trade-off aceito: não é ideal para alta concorrência de escrita nem tem replicação/backup automático — reavaliar (ex: Postgres) se isso virar gargalo.
- **Preço armazenado como número (`REAL`)**, não em centavos inteiros: simplicidade para o estágio atual. Se problemas de arredondamento de ponto flutuante aparecerem, reavaliar para inteiro em centavos.
- **Autenticação simples, um único usuário**: sessão via cookie (`express-session`) + senha com hash `bcrypt`, credenciais em variáveis de ambiente — não há tabela de usuários porque só a dona do site precisa acessar o backoffice hoje. Se mais pessoas precisarem de acesso, essa decisão precisa ser revisitada.
- **`views/` fora de `public/`**: decisão de segurança para impedir que `admin.html` seja servido como arquivo estático (o que pularia a checagem de sessão). Ver detalhe na seção "Estrutura do projeto".
- **Middlewares de autenticação separados para página e API** (`exigirAutenticacaoPagina` redireciona pro `/login`, `exigirAutenticacaoApi` sempre responde `401` JSON): necessário porque checar `Accept: html` numa rota de API é enganoso — um `fetch` sem esse header também "aceita" HTML, e um redirect faria o front-end achar que a ação deu certo.
- **Foto como URL de imagem externa, não upload de arquivo**: simplicidade para o estágio atual — a dona cola o link de uma imagem já hospedada em algum lugar. Se a peça não tiver foto, o catálogo/página de detalhe mostram um placeholder "sem foto" em vez de imagem quebrada. Upload de arquivo direto é trabalho futuro (ver "Próximos passos").
- **Detalhe da peça em página própria (`produto.html?id=`), não em modal**: primeira versão usou modal, mas foi trocada por página própria a pedido — mais fácil de navegar (voltar, compartilhar link direto da peça) e evita um bug real que apareceu no modal (ver item abaixo). Identificar a peça por query string (`?id=`), não por rota de servidor (`/produto/:id`), porque assim `produto.html` continua sendo um arquivo estático comum servido por `express.static`, sem precisar de rota nova no `server.js`.
- **Regra global `[hidden] { display: none !important }` no `style.css`**: sem ela, qualquer elemento escondido via atributo HTML `hidden` que também tenha uma regra de `display` no CSS (ex: `display: grid/flex` para layout) fica visível mesmo "escondido" — a regra de display do autor vence o `[hidden]` do navegador na cascata. Foi exatamente o bug do modal antigo (aparecia sempre aberto e não fechava). Essa regra evita que o mesmo problema volte a acontecer em qualquer elemento futuro que use `hidden`.

## Infraestrutura / Hospedagem

**Decisão:** hospedar em uma VM do **Oracle Cloud "Always Free"** (tier gratuito permanente, não é trial). Motivo: custo zero, sem cold start (diferente de PaaS como Render), e o time já tem perfil de SRE confortável mantendo o servidor.

Ações operacionais definidas para reduzir o risco de a conta ser reclamada por inatividade:

- **Cron de heartbeat**: job agendado (ex: GitHub Actions) fazendo uma chamada de leitura na API da Oracle (ex: `oci compute instance list`) periodicamente, para registrar atividade na conta.
- **Lembrete mensal**: entrar manualmente no console da Oracle Cloud uma vez por mês (a reclamação de conta parece estar ligada a login no console, não só ao servidor estar no ar).
- **Alerta de orçamento**: configurar budget alert na Oracle Cloud para disparar e-mail caso o custo previsto/realizado ultrapasse **US$ 1**.

**Domínio:** por enquanto usando subdomínio grátis do **DuckDNS** (ex: `kretek.duckdns.org`) apontando pro IP da VM, com HTTPS via Let's Encrypt. Domínio próprio (`.com`/`.com.br`) fica para decisão futura, quando o site sair de protótipo — DuckDNS é adequado para fase de teste mas não recomendado para a loja em produção (passa impressão amadora).

## Próximos passos / pendências conhecidas

- Definir se e como haverá checkout/pagamento dentro do site (hoje a venda depende de canal externo).
- **Ligar o botão "Comprar" ao WhatsApp da dona**: definir o número e o texto padrão da mensagem, então trocar o `alert()` provisório em `script.js` por um link `https://wa.me/<numero>?text=<mensagem>`.
- Avaliar upload de foto (arquivo) em vez de só aceitar URL externa.
- Avaliar migração de SQLite para Postgres se surgir necessidade de mais concorrência/backups gerenciados.
- Executar o deploy na VM Oracle (systemd/pm2, firewall, Nginx + Certbot) e configurar o DuckDNS.
- Configurar o cron de heartbeat e o budget alert de US$ 1 na conta Oracle.
- Avaliar compra de domínio próprio quando o site sair de protótipo.

## Visão de futuro (longo prazo, não é próximo passo)

Direção que o projeto pretende seguir mais adiante, depois que o produto estiver mais desenvolvido — não é trabalho a ser feito agora:

- **Containerizar as aplicações** (app + banco) em vez de rodar tudo direto na VM.
- **Rodar em Kubernetes**, se viável — na configuração atual (VM Oracle Always Free pequena e gratuita) provavelmente não compensa, já que até um K8s de nó único tem overhead de control plane alto para uma aplicação desse porte. Se algum dia isso mudar, o caminho seria algo leve como k3s/MicroK8s, não um K8s completo.
- **Alternativa mais realista, se K8s não se justificar:** um `docker-compose.yml` simples rodando a aplicação e o banco de dados como containers separados na mesma VM.
