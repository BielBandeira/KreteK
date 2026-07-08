from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


@app.route("/")
def index():
    return send_from_directory(".", "index.html")

# serve arquivos estáticos (style.css, script.js, etc.)
@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(".", filename)

roupas = [{"id": 1, "nome": "camisa chungwa", "cor": ["vermelha", "preta"], "tamanho": ["G", "M", "P"]},
          {"id": 2, "nome": "camisa marlboro", "cor": ["preta", "branca"], "tamanho": ["G", "M", "P"]}
          ]

proximo_id = 3

def buscar_roupa(id):
    for roupa in roupas:
        if roupa["id"] == id:
            return roupa
    return {"erro": "Roupa não encontada"}


# GET /roupas - lista todas as roupas
@app.route("/roupas", methods=["GET"])
def listar_roupas():
    return jsonify(roupas)

# GET /roupas - lista a roupa pelo ID
@app.route("/roupas/<int:id>", methods=["GET"])
def obter_roupa(id):
    roupa = buscar_roupa(id)
    if roupa is None:
        return "Roupa nao encontrada"
    return jsonify(roupa)

# POST /roupas — cria uma nova roupa
@app.route("/roupas", methods=["POST"])
def postar_roupa():
    global proximo_id
    dados = request.get_json()

    if not dados or "nome" not in dados:
        return "Post invalido"
    
    nova_roupa = {
        "id": proximo_id,
        "nome": dados["nome"],
        "cor": dados["cor"],
        "tamanho": dados.get("tamanho", ["G", "M", "P"])
    }

    roupas.append(nova_roupa)
    proximo_id += 1

    return jsonify(nova_roupa), 201

# PUT - editar roupas existentes
@app.route("/roupas/<int:id>", methods=["PUT"])
def editar_roupa(id):
    roupa = buscar_roupa(id)
    if roupa is None:
        return "Essa roupa nao existe"
    
    dados = request.get_json()
    if "nome" in dados:
        roupa["nome"] = dados["nome"]
    if "cor" in dados:
        roupa["cor"] = dados["cor"]
    if "tamanho" in dados:
        roupa["tamanho"] = dados["tamanho"]

    return jsonify(roupa)

# DELETE /roupa/<id> - remove uma roupa
@app.route("/roupas/<int:id>", methods=["DELETE"])
def deletar_roupa(id):
    roupa = buscar_roupa(id)
    if roupa is None:
        return jsonify({"erro": "Roupa nao existe"}), 404
    roupas.remove(roupa)
    return jsonify({"mensagem": "Roupa removida."})


app.run(debug=True)