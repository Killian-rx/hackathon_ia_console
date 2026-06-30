#!/usr/bin/env python3
"""Serveur local pour Inference Console.

- Sert l'interface (index.html).
- Expose la configuration (URLs des backends) lue depuis config.json.
- Proxifie les requetes vers les serveurs d'inference (evite les soucis CORS).

Aucune dependance externe : uniquement la librairie standard Python.

Usage:
    python3 server.py [--config config.json] [--host HOST] [--port PORT]

Pour changer les URLs des backends, editez simplement config.json.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CONFIG = os.path.join(HERE, "config.json")
INDEX_FILE = os.path.join(HERE, "index.html")

# Hop-by-hop headers a ne pas recopier lors du proxy.
HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade", "host", "content-length",
}


def load_config(path):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


class Handler(BaseHTTPRequestHandler):
    # Injecte par make_handler.
    config = {}
    config_path = DEFAULT_CONFIG

    server_version = "InferenceConsole/1.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    # ----- helpers ------------------------------------------------------

    def _send_json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path, content_type):
        try:
            with open(path, "rb") as fh:
                body = fh.read()
        except OSError:
            self.send_error(404, "Fichier introuvable")
            return
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _public_config(self):
        """Config exposee au navigateur (sans details serveur)."""
        return {
            "backends": self.config.get("backends", {}),
            "defaults": self.config.get("defaults", {}),
        }

    def _resolve_backend(self, path):
        """`/proxy/<backend>/<reste>` -> (base_url, reste) ou (None, None)."""
        rest = path[len("/proxy/"):]
        if "/" in rest:
            backend, tail = rest.split("/", 1)
        else:
            backend, tail = rest, ""
        base = self.config.get("backends", {}).get(backend)
        if not base:
            return None, None
        return base.rstrip("/"), tail

    def _proxy(self, method):
        base, tail = self._resolve_backend(self.path)
        if base is None:
            self._send_json({"error": "backend inconnu"}, status=404)
            return

        target = base + "/" + tail
        length = int(self.headers.get("Content-Length", 0) or 0)
        data = self.rfile.read(length) if length else None

        req = urllib.request.Request(target, data=data, method=method)
        for key, val in self.headers.items():
            if key.lower() not in HOP_BY_HOP:
                req.add_header(key, val)

        try:
            upstream = urllib.request.urlopen(req, timeout=600)
        except urllib.error.HTTPError as err:
            self.send_response(err.code)
            for key, val in err.headers.items():
                if key.lower() not in HOP_BY_HOP:
                    self.send_header(key, val)
            self.end_headers()
            try:
                self.wfile.write(err.read())
            except OSError:
                pass
            return
        except (urllib.error.URLError, OSError) as err:
            self._send_json(
                {"error": "backend injoignable: %s" % err}, status=502
            )
            return

        # Reponse en streaming : on relaie les chunks au fur et a mesure.
        self.send_response(upstream.status)
        for key, val in upstream.headers.items():
            if key.lower() not in HOP_BY_HOP:
                self.send_header(key, val)
        self.send_header("Transfer-Encoding", "chunked")
        self.end_headers()
        try:
            while True:
                chunk = upstream.read(4096)
                if not chunk:
                    break
                self.wfile.write(b"%X\r\n%s\r\n" % (len(chunk), chunk))
                self.wfile.flush()
            self.wfile.write(b"0\r\n\r\n")
        except OSError:
            pass
        finally:
            upstream.close()

    # ----- routes -------------------------------------------------------

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/" or path == "/index.html":
            self._send_file(INDEX_FILE, "text/html; charset=utf-8")
        elif path == "/api/config":
            self._send_json(self._public_config())
        elif path.startswith("/proxy/"):
            self._proxy("GET")
        else:
            self.send_error(404, "Introuvable")

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/proxy/"):
            self._proxy("POST")
        else:
            self.send_error(404, "Introuvable")


def make_handler(config, config_path):
    return type("BoundHandler", (Handler,), {
        "config": config,
        "config_path": config_path,
    })


def main():
    parser = argparse.ArgumentParser(description="Serveur local Inference Console")
    parser.add_argument("--config", default=DEFAULT_CONFIG, help="chemin du fichier de config")
    parser.add_argument("--host", default=None, help="surcharge l'hote du config")
    parser.add_argument("--port", type=int, default=None, help="surcharge le port du config")
    args = parser.parse_args()

    try:
        config = load_config(args.config)
    except (OSError, json.JSONDecodeError) as err:
        sys.exit("Impossible de lire %s : %s" % (args.config, err))

    srv = config.get("server", {})
    host = args.host or srv.get("host", "127.0.0.1")
    port = args.port or srv.get("port", 8080)

    handler = make_handler(config, args.config)
    httpd = ThreadingHTTPServer((host, port), handler)

    print("Inference Console -> http://%s:%d" % (host, port))
    print("Backends configures :")
    for name, url in config.get("backends", {}).items():
        print("  - %-8s %s" % (name, url))
    print("Config : %s  (editez-le pour changer les URLs)" % args.config)
    print("Ctrl+C pour arreter.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nArret.")
        httpd.shutdown()


if __name__ == "__main__":
    main()
