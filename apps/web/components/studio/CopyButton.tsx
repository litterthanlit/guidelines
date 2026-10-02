"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy", className = "btn btn-outline" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      aria-live="polite"
    >
      {done ? "Copied" : label}
    </button>
  );
}
