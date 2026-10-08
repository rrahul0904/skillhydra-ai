"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function RegistryInstallPrompt({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="install-prompt">
      <div className="install-prompt-head">
        <div>
          <strong>Review-first agent prompt</strong>
          <span>Generates an installation plan; it does not authorize execution.</span>
        </div>
        <button className="btn" type="button" onClick={copyPrompt} aria-live="polite">
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </div>
      <pre>{prompt}</pre>
    </div>
  );
}
