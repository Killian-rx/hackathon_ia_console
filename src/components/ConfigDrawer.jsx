import React from "react";
import { BACKEND_NOTES } from "../lib/api.js";

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
);

export default function ConfigDrawer({
  open,
  onClose,
  cfg,
  updateCfg,
  backendUrl,
  models,
  modelCount,
  probe,
  onRefresh,
  onClear,
}) {
  return (
    <aside className={"drawer" + (open ? " open" : "")} aria-label="Configuration">
      <div className="drawer-head">
        <span>CONFIG // INFERENCE</span>
        <button className="x" aria-label="Fermer" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="drawer-body">
        <div className="field">
          <label>Serveur d'inférence</label>
          <div className="seg-toggle">
            <button
              className={cfg.mode === "ollama" ? "active" : ""}
              onClick={() => updateCfg({ mode: "ollama" })}
            >
              OLLAMA
            </button>
            <button
              className={cfg.mode === "openai" ? "active" : ""}
              onClick={() => updateCfg({ mode: "openai" })}
            >
              OPENAI-COMPAT
            </button>
          </div>
          <div className="note" dangerouslySetInnerHTML={{ __html: BACKEND_NOTES[cfg.mode] }} />
        </div>

        <div className="field">
          <label>
            URL de base <span className="val">config.json</span>
          </label>
          <input type="url" value={backendUrl} readOnly spellCheck={false} autoCapitalize="off" />
          <div className="note">
            Les URLs sont définies côté serveur dans <code>config.json</code>. Modifiez ce fichier
            puis relancez <code>server.py</code> pour les changer.
          </div>
        </div>

        <div className="field">
          <label>
            Modèle <span className="val">{modelCount}</span>
          </label>
          <div className="row">
            <select
              className="grow"
              value={cfg.model || ""}
              onChange={(e) => e.target.value && updateCfg({ model: e.target.value })}
            >
              {models.length === 0 ? (
                <option value="">{cfg.model ? cfg.model : "—"}</option>
              ) : (
                models.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))
              )}
            </select>
            <button className="mini" title="Rafraîchir" onClick={onRefresh}>
              <RefreshIcon />
            </button>
          </div>
          <input
            type="text"
            placeholder="…ou nom du modèle à la main"
            spellCheck={false}
            autoCapitalize="off"
            style={{ marginTop: 8 }}
            value={cfg.model || ""}
            onChange={(e) => updateCfg({ model: e.target.value })}
          />
          <div className={"probe " + probe.cls}>{probe.text}</div>
        </div>

        <div className="divider" />

        <div className="field">
          <label>Prompt système</label>
          <textarea
            placeholder="Optionnel — cadre le comportement du modèle"
            value={cfg.system}
            onChange={(e) => updateCfg({ system: e.target.value })}
          />
        </div>

        <div className="field">
          <label>
            Température <span className="val">{Number(cfg.temp).toFixed(1)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={cfg.temp}
            onChange={(e) => updateCfg({ temp: parseFloat(e.target.value) })}
          />
        </div>

        <div className="field">
          <label>
            Tokens max <span className="val">{cfg.maxTok}</span>
          </label>
          <input
            type="range"
            min="128"
            max="8192"
            step="128"
            value={cfg.maxTok}
            onChange={(e) => updateCfg({ maxTok: parseInt(e.target.value) })}
          />
        </div>

        <div className="divider" />
        <button className="btn-wide" onClick={onClear}>
          Effacer la conversation
        </button>
        <div className="note" style={{ marginTop: 15 }}>
          Servi par <code>server.py</code> en local. Les requêtes passent par un proxy (
          <code>/proxy/…</code>) qui relaie vers les backends — plus de souci CORS.
        </div>
      </div>
    </aside>
  );
}
