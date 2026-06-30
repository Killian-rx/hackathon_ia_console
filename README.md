# hackathon_ia_console

Console web de test pour modèles d'inférence (Ollama / backend OpenAI-compatible).
La page `chat-console.html` se connecte à un serveur d'inférence, stream les
réponses en direct et affiche la télémétrie (TTFT, tok/s).

`server.py` la sert sur le réseau — pensé pour tourner sur une VM, accessible
depuis le web. **Aucune dépendance** : uniquement Python 3 standard.

## Démarrage rapide

```bash
python3 server.py
# -> http://0.0.0.0:8080/
```

Ouvre `http://<ip-de-la-vm>:8080/`, va dans **CONFIG**, renseigne l'URL du
serveur d'inférence et choisis un modèle.

## Options

| Argument / Env         | Défaut        | Rôle                                         |
|------------------------|---------------|----------------------------------------------|
| `--host` / `HOST`      | `0.0.0.0`     | Interface d'écoute                           |
| `--port` / `PORT`      | `8080`        | Port d'écoute                                |
| `--upstream`/`UPSTREAM`| _(désactivé)_ | Backend d'inférence à proxifier (anti-CORS)  |

## CORS : appel direct vs. proxy

La page appelle un backend d'inférence depuis le navigateur. Deux options :

1. **Appel direct** (proxy désactivé) : le navigateur tape l'URL du backend.
   Il faut alors autoriser l'origine côté backend, ex. lancer Ollama avec
   `OLLAMA_ORIGINS=*`. Dans CONFIG, l'URL de base est celle du backend
   (ex. `http://localhost:11434`).

2. **Via le proxy** (recommandé sur VM) : on relaie `/api/*` et `/v1/*`
   vers le backend, donc plus aucun souci de CORS (même origine).

   ```bash
   python3 server.py --upstream http://localhost:11434
   ```

   Dans CONFIG, mets l'URL de base **à l'origine de la page elle-même**
   (ex. `http://<ip-de-la-vm>:8080`). Le streaming (NDJSON/SSE) est relayé.

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

## Exposition via Nginx (même VM)

Pour un accès web propre, on place Nginx en frontal sur la même VM. `server.py`
écoute alors en local (`127.0.0.1:8080`) et Nginx termine le HTTP(S) public.

```bash
# server.py en local uniquement, avec proxy vers Ollama
HOST=127.0.0.1 PORT=8080 python3 server.py --upstream http://localhost:11434
# (ou via l'unité systemd fournie, déjà configurée pour 127.0.0.1)

sudo cp deploy/nginx-console.conf /etc/nginx/sites-available/console
sudo ln -s /etc/nginx/sites-available/console /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# HTTPS (domaine pointé sur l'IP publique de la passerelle) :
sudo certbot --nginx -d console.ton-domaine.fr
```

⚠️ La conf Nginx active `proxy_buffering off` : **indispensable** pour que le
streaming token-par-token de la console s'affiche en direct (sinon la réponse
n'apparaît qu'à la fin).

Dans **CONFIG** de la page, mets l'URL de base = l'URL publique de la console
(ex. `https://console.ton-domaine.fr`) : les appels passent par Nginx puis par
le proxy interne, donc aucun souci de CORS.
