"use client";

import { exportTokens, readableOn, SCALE_STEPS, TOKEN_FORMATS, type TokenFormat } from "@guidelines/core";
import { useMemo, useState } from "react";
import { BrandTheme } from "../brand/theme";
import { CopyButton } from "./CopyButton";
import { useStore } from "./store";

const LABELS: Record<TokenFormat, string> = {
  css: "CSS variables",
  tailwind: "Tailwind v4",
  "w3c-json": "W3C tokens",
  "figma-variables-json": "Figma variables",
};

export function TokensView() {
  const { brand } = useStore();
  const [format, setFormat] = useState<TokenFormat>("css");
  const out = useMemo(() => exportTokens(brand, format), [brand, format]);

  return (
    <BrandTheme brand={brand} className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto grid max-w-[1360px] gap-8 px-4 py-8 pb-28 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Preview */}
        <section aria-labelledby="scales-h" className="flex flex-col gap-8">
          <div>
            <p className="label">[003] Tokens</p>
            <h2 id="scales-h" className="mt-3 text-[28px] font-medium tracking-[-0.02em]">
              Color scales
            </h2>
            <p className="mt-1 max-w-[52ch] text-ink-2">Eleven-step OKLCH scales generated from each brand color — perceptually even, gamut-safe.</p>
          </div>
          <div className="panel overflow-hidden">
            {brand.colors.map((c) => (
              <div key={c.id} className="border-b border-line p-4 last:border-b-0">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="font-medium">{c.name}</span>
                  <span className="font-mono text-[11px] text-ink-3">
                    --color-{c.id} · {c.role}
                  </span>
                </div>
                <div className="grid grid-cols-11 overflow-hidden rounded-md">
                  {SCALE_STEPS.map((s) => {
                    const hex = c.scale[s] ?? c.hex;
                    return (
                      <div
                        key={s}
                        className="flex h-14 flex-col justify-end p-1 font-mono text-[9px]"
                        style={{ background: hex, color: readableOn(hex) }}
                        title={`${c.id}-${s} ${hex}`}
                      >
                        {s}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {!brand.colors.length && <p className="p-6 text-ink-3">No colors yet.</p>}
          </div>

          <div>
            <h2 className="text-[28px] font-medium tracking-[-0.02em]">Type scale</h2>
          </div>
          <div className="panel divide-y divide-line overflow-hidden">
            {brand.typography.scale.map((s) => {
              const f = (s.font === "mono" ? brand.typography.mono : brand.typography[s.font]) ?? brand.typography.text;
              return (
                <div key={s.name} className="flex items-baseline gap-4 p-4">
                  <span className="w-28 shrink-0 font-mono text-[11px] text-ink-3">
                    {s.name}
                    <br />
                    {s.size}/{s.lineHeight} · {s.weight}
                  </span>
                  <span
                    className="min-w-0 truncate"
                    style={{
                      fontFamily: `"${f.family}", ${f.fallback}`,
                      fontSize: Math.min(s.size, 56),
                      lineHeight: s.lineHeight,
                      letterSpacing: `${s.tracking}em`,
                      fontWeight: s.weight,
                    }}
                  >
                    {brand.meta.tagline || brand.meta.name}
                  </span>
                </div>
              );
            })}
            {!brand.typography.scale.length && <p className="p-6 text-ink-3">No type scale yet — ask the agent to define one with set_typography.</p>}
          </div>
        </section>

        {/* Export */}
        <section aria-labelledby="export-h" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-8 lg:self-start">
          <h2 id="export-h" className="sr-only">
            Export
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Format" className="inline-flex flex-wrap gap-0.5 rounded-full bg-sunken p-0.5">
              {TOKEN_FORMATS.map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={format === f}
                  onClick={() => setFormat(f)}
                  className={`rounded-full px-3 py-1 text-[12.5px] transition ${format === f ? "bg-surface font-medium shadow-float" : "text-ink-2 hover:text-ink"}`}
                >
                  {LABELS[f]}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-1.5">
              <CopyButton text={out.content} />
              <a className="btn btn-primary" href={`/api/brands/${brand.slug}/tokens?format=${format}&download=1`} download={out.filename}>
                Download
              </a>
            </div>
          </div>
          <div className="overflow-hidden rounded-[var(--radius-panel)] bg-[#141414] text-[#e9e9e6] shadow-lift">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <span className="font-mono text-[11.5px] text-white/60">{out.filename}</span>
              <span className="font-mono text-[11px] text-white/40">{out.content.split("\n").length} lines</span>
            </div>
            <pre
              className="max-h-[70vh] overflow-auto p-4 font-mono text-[12px] leading-relaxed scrollbar-thin"
              tabIndex={0}
              aria-label={`${LABELS[format]} output`}
            >
              <code>{out.content}</code>
            </pre>
          </div>
        </section>
      </div>
    </BrandTheme>
  );
}
