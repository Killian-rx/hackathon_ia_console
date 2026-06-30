# hackathon_ia_console

Console web (**React + Vite**) pour tester des modèles d'inférence (Ollama ou
serveurs compatibles OpenAI). Le front est servi/secondé par un petit serveur
local **sans dépendance** (Python stdlib) qui lit les URLs des backends dans un
fichier de configuration et **proxifie** les requêtes (plus de souci CORS).

Le style de l'interface est inchangé.

## Prérequis

- Node.js 18+ (pour le front Vite)
- Python 3.8+ (pour le serveur / proxy)

## Développement

Deux processus :

```bash
# 1) backend : config + proxy d'inférence (port 8080)
python3 server.py

# 2) front : serveur de dev Vite avec HMR (port 5173)
npm install
npm run dev
```

Ouvrir <http://localhost:5173>. Vite proxifie automatiquement `/api/config` et
`/proxy/*` vers `server.py`.

## Production

```bash
npm install
npm run build        # génère dist/
python3 server.py    # sert dist/ + config + proxy sur le port 8080
```

Ouvrir <http://127.0.0.1:8080>.

Options serveur :

```bash
python3 server.py --config config.json --host 0.0.0.0 --port 9000
```

## Configuration — `config.json`

```json
{
  "server":   { "host": "127.0.0.1", "port": 8080 },
  "backends": {
    "ollama": "http://localhost:11434",
    "openai": "http://localhost:8000"
  },
  "defaults": {
    "mode": "ollama", "model": "", "system": "", "temp": 0.7, "maxTok": 2048
  }
}
```

- **`backends`** : les URLs à modifier pour pointer vers vos serveurs
  d'inférence. Changez-les ici puis relancez `server.py`.
- **`defaults`** : valeurs initiales de l'interface. Les réglages choisis dans
  l'UI sont ensuite mémorisés côté navigateur (localStorage).

## Fonctionnement du serveur

- `GET /api/config` → config publique (backends + defaults).
- `GET|POST /proxy/<backend>/<chemin>` → relaie en streaming vers
  `backends[<backend>]`. L'UI parle uniquement à ce proxy.
- Tout le reste → fichiers statiques de `dist/` (avec repli SPA).

En mode Ollama, l'UI appelle `/api/generate` (format
`{"model": "...", "prompt": "..."}`) et `/api/tags` pour lister les modèles.
L'historique est reconstruit dans le `prompt`, le prompt système via le champ
`system`.

## Structure

```
server.py              serveur local : config + proxy + service de dist/
config.json            URLs des backends et valeurs par défaut
index.html             template Vite (point d'entrée)
vite.config.js         config Vite (proxy dev vers server.py)
src/
  main.jsx             bootstrap React
  App.jsx              état + logique de chat / streaming
  styles.css           styles (identiques à la console d'origine)
  lib/
    api.js             requêtes backends (config, modèles, génération)
    markdown.js        rendu Markdown minimal
  components/          Header, Feed, Composer, StatusBar, ConfigDrawer
```
