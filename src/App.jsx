import React, { useCallback, useEffect, useRef, useState } from "react";
import Header from "./components/Header.jsx";
import Feed from "./components/Feed.jsx";
import Composer from "./components/Composer.jsx";
import StatusBar from "./components/StatusBar.jsx";
import ConfigDrawer from "./components/ConfigDrawer.jsx";
import {
  DEFAULTS,
  buildRequest,
  fetchModels as apiFetchModels,
  loadServerConfig,
  parseOllama,
  parseOpenAI,
} from "./lib/api.js";

const LS = "inference-console-cfg-v1";

function loadCfg() {
  try {
    return JSON.parse(localStorage.getItem(LS)) || {};
  } catch {
    return {};
  }
}
function stamp() {
  return new Date().toTimeString().slice(0, 8);
}

export default function App() {
  const [cfg, setCfg] = useState(() => ({ ...DEFAULTS, ...loadCfg() }));
  const [backends, setBackends] = useState({
    ollama: "http://localhost:11434",
    openai: "http://localhost:8000",
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [conn, setConn] = useState({ state: "", text: "offline" });
  const [models, setModels] = useState([]);
  const [modelCount, setModelCount] = useState("");
  const [probe, setProbe] = useState({ cls: "", text: "" });
  const [metrics, setMetrics] = useState({ show: false, ttft: "—", tps: "—" });

  const controllerRef = useRef(null);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  // Persiste la config a chaque changement.
  useEffect(() => {
    try {
      localStorage.setItem(LS, JSON.stringify(cfg));
    } catch {}
  }, [cfg]);

  const updateCfg = useCallback((patch) => setCfg((c) => ({ ...c, ...patch })), []);
  const backendUrl = backends[cfg.mode] || "";

  // ----- modeles --------------------------------------------------------

  const refreshModels = useCallback(async () => {
    const mode = cfgRef.current.mode;
    if (!backends[mode]) return;
    setProbe({ cls: "busy", text: "connexion…" });
    setConn({ state: "", text: "test…" });
    try {
      const names = await apiFetchModels(mode);
      setModels(names);
      setModelCount(names.length ? `${names.length} dispo` : "");
      setCfg((c) => {
        if (names.length && (!c.model || !names.includes(c.model))) {
          return { ...c, model: names[0] };
        }
        return c;
      });
      setProbe({
        cls: "ok",
        text: `connecté — ${names.length} modèle${names.length > 1 ? "s" : ""}`,
      });
      setConn({ state: "ok", text: "online" });
    } catch (err) {
      setModels([]);
      setModelCount("");
      setProbe({ cls: "err", text: `injoignable (${err.message}) — vérifie config.json / le backend` });
      setConn({ state: "err", text: "injoignable" });
    }
  }, [backends]);

  // Charge la config serveur au demarrage.
  useEffect(() => {
    (async () => {
      const data = await loadServerConfig();
      if (data?.backends) setBackends(data.backends);
      if (data?.defaults) {
        const stored = loadCfg();
        setCfg((c) => {
          const next = { ...c };
          for (const k of ["mode", "model", "system", "temp", "maxTok"]) {
            if (stored[k] === undefined && data.defaults[k] !== undefined) next[k] = data.defaults[k];
          }
          return next;
        });
      }
    })();
  }, []);

  // Quand les backends ou le mode changent, on rafraichit la liste.
  useEffect(() => {
    if (backendUrl) refreshModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendUrl, cfg.mode]);

  // ----- envoi / streaming ---------------------------------------------

  const reportMetrics = (start, firstAt, chars, stats) => {
    const ttftMs = firstAt ? firstAt - start : 0;
    const ttft = ttftMs ? (ttftMs < 1000 ? `${Math.round(ttftMs)}ms` : `${(ttftMs / 1000).toFixed(1)}s`) : "—";
    let tps = "—";
    if (stats && stats.seconds > 0) tps = (stats.tokens / stats.seconds).toFixed(1);
    else if (firstAt) {
      const genSec = (performance.now() - firstAt) / 1000;
      if (genSec > 0) tps = ((chars / 4) / genSec).toFixed(1);
    }
    setMetrics({ show: true, ttft, tps });
  };

  const streamReply = useCallback(async (history) => {
    const cur = cfgRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    setStreaming(true);
    setConn({ state: "live", text: "génération…" });

    // Message assistant vide a remplir.
    setMessages((prev) => [...prev, { role: "assistant", content: "", ts: stamp() }]);

    const payloadMessages = cur.system
      ? [{ role: "system", content: cur.system }, ...history]
      : history;

    const start = performance.now();
    let firstAt = 0;
    let charCount = 0;
    let ollamaStats = null;
    let acc = "";
    let aborted = false;

    const setLast = (content, caret) =>
      setMessages((prev) => {
        const copy = prev.slice();
        copy[copy.length - 1] = { ...copy[copy.length - 1], content, caret };
        return copy;
      });

    try {
      const { url, body } = buildRequest(cur, payloadMessages);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const t = await res.text();
          if (t) detail += " — " + t.slice(0, 200);
        } catch {}
        throw new Error(detail);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const parse = cur.mode === "ollama" ? parseOllama : parseOpenAI;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const raw of lines) {
          const line = raw.trim();
          if (!line) continue;
          const piece = parse(line);
          if (piece === null) continue;
          if (piece.stats) {
            ollamaStats = piece.stats;
            continue;
          }
          if (piece.content) {
            if (!firstAt) firstAt = performance.now();
            acc += piece.content;
            charCount += piece.content.length;
            setLast(acc, true);
          }
        }
      }
      if (buffer.trim()) {
        const piece = parse(buffer.trim());
        if (piece && piece.content) acc += piece.content;
      }
      setLast(acc, false);
      reportMetrics(start, firstAt, charCount, ollamaStats);
      setConn({ state: "ok", text: "online" });
    } catch (err) {
      if (err.name === "AbortError") {
        aborted = true;
        setMessages((prev) => {
          const copy = prev.slice();
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: acc, caret: false, stopped: true };
          return copy;
        });
        setConn({ state: "ok", text: "online" });
      } else {
        setMessages((prev) => {
          const copy = prev.slice();
          // Retire le message assistant vide puis ajoute l'erreur.
          if (!acc) copy.pop();
          copy.push({ role: "error", content: err.message });
          return copy;
        });
        setConn({ state: "err", text: "erreur" });
      }
    } finally {
      controllerRef.current = null;
      setStreaming(false);
      void aborted;
    }
  }, []);

  const onSend = useCallback(() => {
    if (streaming) {
      controllerRef.current?.abort();
      return;
    }
    const text = input.trim();
    if (!text || !cfgRef.current.model) return;
    const userMsg = { role: "user", content: text, ts: stamp() };
    setMessages((prev) => {
      const history = [...prev, userMsg];
      streamReply(history);
      return history;
    });
    setInput("");
  }, [input, streaming, streamReply]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setDrawerOpen(false);
  }, []);

  const canSend = !!(cfg.model && input.trim());

  return (
    <div className="app">
      <Header onOpenConfig={() => setDrawerOpen(true)} />
      <Feed messages={messages} model={cfg.model} />
      <Composer
        value={input}
        onChange={setInput}
        onSend={onSend}
        streaming={streaming}
        canSend={canSend}
      />
      <StatusBar
        conn={conn}
        mode={cfg.mode}
        model={cfg.model}
        metrics={metrics}
      />

      <div className={"scrim" + (drawerOpen ? " open" : "")} onClick={() => setDrawerOpen(false)} />
      <ConfigDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        cfg={cfg}
        updateCfg={updateCfg}
        backendUrl={backendUrl}
        models={models}
        modelCount={modelCount}
        probe={probe}
        onRefresh={refreshModels}
        onClear={clearChat}
      />
    </div>
  );
}
