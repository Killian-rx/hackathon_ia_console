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

## Accès web (passerelle klouders)

L'accès public et le HTTPS sont gérés par l'infra : la passerelle
`https://hack-ia01.klouders.fr/` redirige vers cette VM. Rien à configurer côté
TLS/reverse-proxy. Il suffit que `server.py` tourne sur la VM :

```bash
HOST=0.0.0.0 PORT=8080 python3 server.py --upstream http://localhost:11434
# (ou via l'unité systemd fournie)
```

Vérifie que le `PORT` correspond à celui vers lequel la passerelle klouders
redirige. Dans **CONFIG** de la page, mets l'URL de base sur l'URL publique
`https://hack-ia01.klouders.fr` : les appels passent par la passerelle puis par
le proxy interne (`/api/*`, `/v1/*`), donc aucun souci de CORS.
