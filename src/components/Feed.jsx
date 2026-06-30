import React, { useEffect, useRef } from "react";
import { renderMarkdown } from "../lib/markdown.js";

function EmptyState({ model }) {
  return (
    <div className="empty">
      <div className="sig">{model ? "PRÊT — " + model.toUpperCase() : "PAS DE SIGNAL"}</div>
      <h1>Console de test du modèle</h1>
      <p>
        Les endpoints sont définis dans <code>config.json</code>. Sélectionne un modèle dans{" "}
        <code>CONFIG</code>, puis envoie un prompt. La réponse se stream en direct, la télémétrie
        s'affiche en bas.
      </p>
    </div>
  );
}

export default function Feed({ messages, model }) {
  const mainRef = useRef(null);

  useEffect(() => {
    const el = mainRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <main id="main" ref={mainRef}>
      <div className="feed" id="feed">
        {messages.length === 0 ? (
          <EmptyState model={model} />
        ) : (
          messages.map((m, i) => {
            if (m.role === "error") {
              return (
                <div className="msg" key={i}>
                  <div className="msg-err">
                    <b>Échec de la requête.</b> {m.content}
                    <br />
                    <span className="sub">
                      Vérifie que le backend tourne et que son URL est correcte dans{" "}
                      <code>config.json</code>.
                    </span>
                  </div>
                </div>
              );
            }
            const tag = m.role === "user" ? "you" : model || "model";
            let html = renderMarkdown(m.content);
            if (m.caret) html += '<span class="caret"></span>';
            if (m.stopped) html += ' <span class="stopped">— arrêté</span>';
            return (
              <div className={"msg " + m.role} key={i}>
                <div className="gutter">
                  <span className="tag">{tag}</span>
                  <span className="ts">{m.ts || ""}</span>
                </div>
                <div className="content" dangerouslySetInnerHTML={{ __html: html }} />
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
