# hackathon_ia_console

Console web pour tester des modèles d'inférence (Ollama ou serveurs compatibles
OpenAI), servie par un petit serveur local **sans dépendance** (Python stdlib).

L'interface conserve le style de la console d'origine ; les URLs des backends
sont désormais définies dans un fichier de configuration, et le serveur
**proxifie** les requêtes vers les backends (plus de souci CORS).

## Lancer

```bash
python3 server.py
```

Puis ouvrir <http://127.0.0.1:8080>.

Options :

```bash
python3 server.py --config config.json --host 0.0.0.0 --port 9000
```

`--host` / `--port` surchargent les valeurs du fichier de config.

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
- **`defaults`** : valeurs initiales de l'interface (mode, modèle, prompt
  système, température, tokens max). Les réglages choisis dans l'UI sont ensuite
  mémorisés côté navigateur (localStorage).

## Fonctionnement

- `GET /` → l'interface (`index.html`).
- `GET /api/config` → la config publique (backends + defaults).
- `GET|POST /proxy/<backend>/<chemin>` → relaie vers `backends[<backend>]`
  en streaming. L'UI parle uniquement à ce proxy, jamais directement au backend.

En mode Ollama, l'UI appelle `/api/generate` (le format
`{"model": "...", "prompt": "..."}`) et `/api/tags` pour lister les modèles.
L'historique de conversation est reconstruit dans le `prompt`, et le prompt
système est passé via le champ `system`.

## Fichiers

- `server.py` — serveur local + proxy (Python standard library uniquement).
- `index.html` — interface de la console.
- `config.json` — URLs des backends et valeurs par défaut.
