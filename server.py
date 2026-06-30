#!/usr/bin/env python3
"""Serveur web pour la console d'inférence.

Sert chat-console.html et, optionnellement, fait office de reverse-proxy
vers le serveur d'inférence (Ollama / backend OpenAI-compatible) afin
d'éviter les problèmes de CORS quand la page est ouverte depuis le web.

Aucune dépendance externe : uniquement la bibliothèque standard Python 3.
Pensé pour tourner sur une VM, exposé sur le réseau.

Usage :
    python3 server.py                       # écoute sur 0.0.0.0:8080
    python3 server.py --port 80             # autre port
    python3 server.py --upstream http://localhost:11434   # active le proxy

Variables d'environnement (prioritaires sur les valeurs par défaut,
mais surchargées par les arguments en ligne de commande) :
    HOST       interface d'écoute (def. 0.0.0.0)
    PORT       port d'écoute       (def. 8080)
    UPSTREAM   URL du backend d'inférence à proxifier (def. désactivé)
"""

import argparse
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = os.path.dirname(os.path.abspath(__file__))
INDEX = "chat-console.html"

# Chemins relayés vers le backend d'inférence quand le proxy est actif.
PROXY_PREFIXES = ("/api/", "/v1/")


class Handler(SimpleHTTPRequestHandler):
    upstream = None  # défini au démarrage ; ex. "http://localhost:11434"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    # --- routage ---------------------------------------------------------
    def _is_proxied(self):
        return self.upstream and self.path.startswith(PROXY_PREFIXES)

    def do_GET(self):
        if self._is_proxied():
            return self._proxy("GET")
        if self.path in ("/", ""):
            self.path = "/" + INDEX
        return super().do_GET()

    def do_POST(self):
        if self._is_proxied():
            return self._proxy("POST")
        self.send_error(404, "Not Found")

    def do_OPTIONS(self):
        # Pré-vol CORS : on autorise tout (utile si le proxy n'est pas utilisé
        # et qu'on appelle un backend tiers, ou pour les clients stricts).
        self.send_response(204)
        self._cors()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Content-Length", "0")
        self.end_headers()

    # --- reverse-proxy streaming ----------------------------------------
    def _proxy(self, method):
        target = self.upstream.rstrip("/") + self.path
        length = int(self.headers.get("Content-Length", 0) or 0)
        body = self.rfile.read(length) if length else None

        req = Request(target, data=body, method=method)
        # On recopie les en-têtes utiles ; on laisse urllib gérer Host.
        for h in ("Content-Type", "Authorization", "Accept"):
            if h in self.headers:
                req.add_header(h, self.headers[h])

        try:
            with urlopen(req, timeout=600) as resp:
                self.send_response(resp.status)
                self._cors()
                ctype = resp.headers.get("Content-Type")
                if ctype:
                    self.send_header("Content-Type", ctype)
                # Pas de Content-Length : on relaie en flux (streaming SSE/NDJSON).
                self.end_headers()
                while True:
                    chunk = resp.read(8192)
                    if not chunk:
                        break
                    try:
                        self.wfile.write(chunk)
                        self.wfile.flush()
                    except (BrokenPipeError, ConnectionResetError):
                        return  # client parti (stop du stream)
        except HTTPError as e:
            self.send_response(e.code)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            try:
                self.wfile.write(e.read())
            except OSError:
                pass
        except URLError as e:
            self.send_response(502)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            msg = f'{{"error":"upstream injoignable: {e.reason}"}}'
            self.wfile.write(msg.encode())

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")

    # Logs un peu plus lisibles.
    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    p = argparse.ArgumentParser(description="Serveur web de la console d'inférence")
    p.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"))
    p.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8080")))
    p.add_argument(
        "--upstream",
        default=os.environ.get("UPSTREAM"),
        help="URL du backend d'inférence à proxifier (ex. http://localhost:11434). "
        "Si défini, /api/* et /v1/* sont relayés et le CORS disparaît.",
    )
    args = p.parse_args()

    Handler.upstream = args.upstream.rstrip("/") if args.upstream else None

    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    httpd.daemon_threads = True

    print(f"Console servie sur http://{args.host}:{args.port}/  (Ctrl+C pour arrêter)")
    if Handler.upstream:
        print(f"Proxy actif : /api/* et /v1/* -> {Handler.upstream}")
        print("  Dans CONFIG, mets l'URL de base à l'origine de cette page "
              "(ex. http://<ip-vm>:%d)" % args.port)
    else:
        print("Proxy désactivé. Le navigateur appellera le backend en direct "
              "(pense au CORS / OLLAMA_ORIGINS=*).")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt.")
        httpd.shutdown()


if __name__ == "__main__":
    main()
