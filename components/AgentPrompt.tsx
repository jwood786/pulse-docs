"use client";

// The vibe-code section: a self-contained prompt developers paste into
// their LLM/agent. Prompts must carry the ENTIRE contract - agents don't
// browse docs - so each one includes endpoints, shapes, security rules,
// and acceptance criteria.

import { useState } from "react";

export function AgentPrompt({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(prompt.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <>
      <h2>Integrate with your coding agent</h2>
      <p>
        Building with Claude, Cursor, Copilot, or another AI agent? Paste this
        prompt — it contains the complete contract, the security rules, and an
        acceptance checklist, so your agent can implement the integration
        without reading these docs.
      </p>
      <div style={{ position: "relative" }}>
        <button
          onClick={copy}
          style={{
            position: "absolute", top: 10, right: 10,
            background: copied ? "var(--green)" : "var(--gold)",
            color: "#1a1405", border: "none", borderRadius: 7,
            padding: "6px 14px", fontWeight: 700, fontSize: 13,
            cursor: "pointer",
          }}
        >
          {copied ? "copied!" : "copy prompt"}
        </button>
        <pre style={{ maxHeight: 480, overflowY: "auto" }}>
          <code>{prompt.trim()}</code>
        </pre>
      </div>
    </>
  );
}
