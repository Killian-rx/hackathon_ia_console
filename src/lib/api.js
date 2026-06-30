// Acces aux backends d'inference via le proxy local de server.py.
// Toutes les requetes passent par /proxy/<mode>/... (jamais directement au
// backend) -> pas de souci CORS. Les URLs sont definies dans config.json.

export const DEFAULTS = { mode: "ollama", model: "", system: "", temp: 0.7, maxTok: 2048 };

export function proxyBase(mode) {
  return `/proxy/${mode}`;
}

// Recupere la config publique exposee par server.py (backends + defaults).
export async function loadServerConfig() {
  try {
    const r = await fetch("/api/config");
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// Liste les modeles disponibles selon le mode.
export async function fetchModels(mode) {
  const url = mode === "ollama" ? `${proxyBase(mode)}/api/tags` : `${proxyBase(mode)}/v1/models`;
  const r = await fetch(url, { method: "GET" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return mode === "ollama"
    ? (data.models || []).map((m) => m.name)
    : (data.data || []).map((m) => m.id);
}

// Construit l'URL + le corps de la requete de generation.
export function buildRequest(cfg, msgs) {
  if (cfg.mode === "ollama") {
    // Endpoint /api/generate : prompt unique. On separe le prompt systeme et
    // on reconstruit la conversation depuis l'historique.
    const sys = msgs.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const convo = msgs.filter((m) => m.role !== "system");
    const prompt =
      convo.length <= 1
        ? convo[0]
          ? convo[0].content
          : ""
        : convo
            .map((m) => (m.role === "user" ? "User: " : "Assistant: ") + m.content)
            .join("\n\n") + "\n\nAssistant:";
    const body = {
      model: cfg.model,
      prompt,
      stream: true,
      options: { temperature: cfg.temp, num_predict: cfg.maxTok },
    };
    if (sys) body.system = sys;
    return { url: `${proxyBase(cfg.mode)}/api/generate`, body };
  }
  return {
    url: `${proxyBase(cfg.mode)}/v1/chat/completions`,
    body: {
      model: cfg.model,
      messages: msgs,
      stream: true,
      temperature: cfg.temp,
      max_tokens: cfg.maxTok,
    },
  };
}

// Parse une ligne du flux Ollama. Retourne { content, stats? } ou null.
export function parseOllama(line) {
  try {
    const o = JSON.parse(line);
    if (o.error) throw new Error(o.error);
    // /api/generate renvoie `response`, /api/chat renvoie `message.content`.
    const content = o.response !== undefined ? o.response : o.message ? o.message.content : "";
    const out = { content };
    if (o.done && o.eval_count && o.eval_duration) {
      out.stats = { tokens: o.eval_count, seconds: o.eval_duration / 1e9 };
    }
    return out;
  } catch (e) {
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

// Parse une ligne SSE du flux OpenAI. Retourne { content } ou null.
export function parseOpenAI(line) {
  if (!line.startsWith("data:")) return null;
  const data = line.slice(5).trim();
  if (data === "[DONE]") return null;
  try {
    const o = JSON.parse(data);
    const delta = o.choices && o.choices[0] && o.choices[0].delta;
    return { content: delta && delta.content ? delta.content : "" };
  } catch {
    return null;
  }
}

export const BACKEND_NOTES = {
  ollama:
    "Endpoints natifs <code>/api/generate</code> &amp; <code>/api/tags</code>. Défaut http://localhost:11434",
  openai:
    "Endpoints <code>/v1/chat/completions</code> &amp; <code>/v1/models</code>. Couvre Triton (frontend OpenAI), vLLM, llama.cpp et la plupart des serveurs maison.",
};
