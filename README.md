# hackathon_ia_console

Console web de test pour modèles d'inférence (Ollama / backend OpenAI-compatible).
La page `chat-console.html` se connecte à un serveur d'inférence, stream les
réponses en direct et affiche la télémétrie (TTFT, tok/s).

`server.py` la sert sur le réseau — pensé pour tourner sur une VM, accessible
depuis le web. **Aucune dépendance** : uniquement Python 3 standard.

## Démarrage rapide

```bash
python3 server.py --upstream http://localhost:11434
# -> http://0.0.0.0:8080/   (proxy /api/* et /v1/* vers Ollama)
```

Ouvre la page, va dans **CONFIG**, clique sur rafraîchir 🔄 et choisis un
modèle. C'est tout : pas d'URL à renseigner.

### Pourquoi « pas d'URL à renseigner »

La page appelle **le serveur depuis lequel elle est servie** (requêtes
relatives `/api/*`, `/v1/*`), et `server.py` relaie vers le backend
d'inférence. Donc **une seule config marche par les deux portes d'entrée** :

| Tu ouvres la page via…            | Ça marche tel quel |
|-----------------------------------|--------------------|
| `http://10.2.117.10:8080/` (privé)| ✅                 |
| `https://hack-ia01.klouders.fr/` (public) | ✅         |

Pas de CORS, pas de mixed-content, rien à changer selon la porte utilisée.
Le champ « URL de base » reste **vide** (= même serveur). On ne le remplit
que pour viser un backend distant exceptionnel.

## Options

| Argument / Env         | Défaut        | Rôle                                         |
|------------------------|---------------|----------------------------------------------|
| `--host` / `HOST`      | `0.0.0.0`     | Interface d'écoute                           |
| `--port` / `PORT`      | `8080`        | Port d'écoute                                |
| `--upstream`/`UPSTREAM`| _(désactivé)_ | Backend d'inférence à proxifier (anti-CORS)  |

## Déploiement sur VM

### systemd (recommandé)

```bash
sudo mkdir -p /opt/hackathon_ia_console
sudo cp chat-console.html server.py /opt/hackathon_ia_console/
sudo cp deploy/inference-console.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now inference-console
```

Édite `/etc/systemd/system/inference-console.service` pour ajuster `PORT` ou
activer `UPSTREAM`. Pense à ouvrir le port dans le pare-feu de la VM
(ex. `sudo ufw allow 8080/tcp` ou le security group du cloud).

### Docker

```bash
docker build -t inference-console .
docker run -d -p 8080:8080 inference-console
# avec proxy vers un Ollama de l'hôte :
docker run -d -p 8080:8080 -e UPSTREAM=http://host.docker.internal:11434 inference-console
```

## Accès web (passerelle klouders)

L'accès public et le HTTPS sont gérés par l'infra : la passerelle
`https://hack-ia01.klouders.fr/` redirige vers cette VM. Rien à configurer côté
TLS/reverse-proxy. Il suffit que `server.py` tourne sur la VM :

```bash
HOST=0.0.0.0 PORT=8080 python3 server.py --upstream http://localhost:11434
# (ou via l'unité systemd fournie)
```

Vérifie que le `PORT` correspond à celui vers lequel la passerelle klouders
redirige. Comme la page appelle son propre serveur (requêtes relatives), il n'y
a **rien à renseigner** dans CONFIG : ça marche par l'IP privée comme par l'URL
publique.
