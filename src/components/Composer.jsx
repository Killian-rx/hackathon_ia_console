import React, { useEffect, useRef } from "react";

export default function Composer({ value, onChange, onSend, streaming, canSend }) {
  const taRef = useRef(null);

  // Auto-redimensionnement du textarea.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [value]);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const disabled = streaming ? false : !canSend;

  return (
    <div className="composer-wrap">
      <div className="composer">
        <span className="prompt-mark">&rsaquo;</span>
        <textarea
          ref={taRef}
          id="input"
          rows={1}
          placeholder="Message — Entrée pour envoyer, Maj+Entrée pour un saut de ligne"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          className={"send" + (streaming ? " stop" : "")}
          id="send"
          disabled={disabled}
          onClick={onSend}
        >
          {streaming ? "STOP" : "SEND"}
        </button>
      </div>
    </div>
  );
}
