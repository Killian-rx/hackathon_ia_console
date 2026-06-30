import React from "react";

export default function StatusBar({ conn, mode, model, metrics }) {
  return (
    <footer className="statusline">
      <span className="sl-item">
        <span className={"dot" + (conn.state ? " " + conn.state : "")} id="connDot" />
        <b id="connLabel">{conn.text}</b>
      </span>
      <span className="sl-item dim collapse">
        <span id="backendLabel">{mode === "ollama" ? "ollama" : "openai-compat"}</span>
      </span>
      <span className="sl-item">
        model <b id="modelLabel">{model || "—"}</b>
      </span>
      <span className="sl-spacer" />
      {metrics.show && (
        <span className="sl-item dim collapse" id="metricsSeg">
          ttft <b id="ttft">{metrics.ttft}</b> · <b id="tps">{metrics.tps}</b> tok/s
        </span>
      )}
    </footer>
  );
}
