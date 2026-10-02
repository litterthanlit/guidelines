"use client";

import { useEffect, useRef, useState } from "react";
import { Slide } from "../brand/Slide";
import { useStore } from "./store";

/** Fullscreen presentation of the guideline pages. ←/→ to navigate, Esc to exit. */
export function Present({ start, onClose }: { start: number; onClose: () => void }) {
  const { brand } = useStore();
  const [i, setI] = useState(start);
  const ref = useRef<HTMLDivElement>(null);
  const count = brand.pages.length;

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") setI((n) => Math.min(count - 1, n + 1));
      if (e.key === "ArrowLeft" || e.key === "PageUp") setI((n) => Math.max(0, n - 1));
      if (e.key === "Home") setI(0);
      if (e.key === "End") setI(count - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prevFocus?.focus();
    };
  }, [count, onClose]);

  const page = brand.pages[Math.min(i, count - 1)];
  if (!page) return null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Presenting ${brand.meta.name} guidelines`}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0b0b0b] outline-none"
      onClick={(e) => {
        const x = e.clientX / window.innerWidth;
        setI((n) => (x > 0.5 ? Math.min(count - 1, n + 1) : Math.max(0, n - 1)));
      }}
    >
      <div key={page.id} className="animate-fade-up" style={{ width: "min(100vw, calc(100dvh * 16 / 9))" }}>
        <Slide brand={brand} page={page} index={i} />
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 flex items-center justify-between p-4 text-[12px] text-white/60">
        <span className="font-mono">
          {String(i + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
        </span>
        <button
          type="button"
          className="pointer-events-auto rounded-full bg-white/10 px-3 py-1 text-white/80 hover:bg-white/20"
          onClick={(e) => (e.stopPropagation(), onClose())}
        >
          Esc to exit
        </button>
      </div>
      <div className="fixed inset-x-0 top-0 h-0.5 bg-white/10" aria-hidden>
        <div className="h-full bg-white/70 transition-[width] duration-300" style={{ width: `${((i + 1) / count) * 100}%` }} />
      </div>
    </div>
  );
}
