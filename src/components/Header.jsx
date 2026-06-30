import React from "react";

export default function Header({ onOpenConfig }) {
  return (
    <header>
      <div className="brand">
        INFERENCE<span className="sep">::</span>CONSOLE<em>build/dev</em>
      </div>
      <button className="chip" id="openSettings" onClick={onOpenConfig}>
        CONFIG
      </button>
    </header>
  );
}
