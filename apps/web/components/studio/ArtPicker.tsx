"use client";

import { ART_STYLE_IDS, ART_STYLES, formatArt, parseArt, type ArtStyle } from "@guidelines/core";
import { useMemo } from "react";
import { artUri } from "../brand/Art";
import { TextInput } from "./fields";
import { useStore } from "./store";

/** Thumbnails are small; skip most of the grain so 13 of them stay cheap. */
function useThumbs(tone: "light" | "dark", seed: number) {
  const { brand } = useStore();
  const key = brand.colors.map((c) => `${c.role}${c.hex}`).join();
  return useMemo(
    () => Object.fromEntries(ART_STYLE_IDS.map((style) => [style, artUri(brand, formatArt({ style, seed }), tone, 1.4, 0.5)!])) as Record<ArtStyle, string>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, tone, seed],
  );
}

/**
 * Pick a procedural artwork: a style grid rendered in the brand's own palette,
 * plus a seed you can step or shuffle for variations of the same style.
 */
export function ArtPicker({
  label,
  hint,
  value,
  tone,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  tone: "light" | "dark";
  onChange: (v: string | null) => void;
}) {
  const spec = parseArt(value);
  const seed = spec?.seed ?? 1;
  const thumbs = useThumbs(tone, seed);
  const set = (style: ArtStyle, s = seed) => onChange(formatArt({ style, seed: s }));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-ink-2">{label}</span>
        {spec && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="grid size-6 place-items-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink"
              aria-label="Previous variation"
              onClick={() => set(spec.style, Math.max(1, seed - 1))}
            >
              ‹
            </button>
            <span className="min-w-8 text-center font-mono text-[11px] text-ink-3" aria-live="polite">
              #{seed}
            </span>
            <button
              type="button"
              className="grid size-6 place-items-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink"
              aria-label="Next variation"
              onClick={() => set(spec.style, seed + 1)}
            >
              ›
            </button>
            <button
              type="button"
              className="ml-1 rounded-full px-2 py-0.5 text-[12px] text-ink-2 hover:bg-sunken hover:text-ink"
              onClick={() => set(spec.style, 1 + Math.floor(Math.random() * 999))}
            >
              Shuffle
            </button>
            <button type="button" className="rounded-full px-2 py-0.5 text-[12px] text-ink-3 hover:bg-sunken hover:text-ink" onClick={() => onChange(null)}>
              Clear
            </button>
          </div>
        )}
      </div>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-1.5">
        {ART_STYLE_IDS.map((style) => {
          const on = spec?.style === style;
          return (
            <button
              key={style}
              type="button"
              role="radio"
              aria-checked={on}
              title={ART_STYLES[style].description}
              onClick={() => set(style)}
              className={`group relative aspect-[1.4] overflow-hidden rounded-md bg-sunken transition ${on ? "ring-2 ring-ink ring-offset-1" : "opacity-85 hover:opacity-100"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbs[style]} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-1.5 pt-3 pb-1 text-left text-[10px] font-medium text-white">
                {ART_STYLES[style].name}
              </span>
            </button>
          );
        })}
      </div>
      {hint && <p className="text-[11.5px] text-ink-3">{hint}</p>}
    </div>
  );
}

/** Comma-separated artwork list (one per step), with a preview strip. */
export function ArtsField({
  label,
  hint,
  value,
  tone,
  onCommit,
}: {
  label: string;
  hint?: string;
  value: string;
  tone: "light" | "dark";
  onCommit: (v: string) => void;
}) {
  const { brand } = useStore();
  const specs = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <div className="flex flex-col gap-2">
      <TextInput label={label} value={value} onCommit={onCommit} hint={hint} placeholder="converge:2, burst:7, diverge:3" />
      {specs.length > 0 && (
        <div className="flex gap-1.5" aria-hidden>
          {specs.slice(0, 4).map((spec, i) => {
            const src = artUri(brand, spec, tone, 1.4, 0.5);
            return src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${spec}-${i}`} src={src} alt="" className="aspect-[1.4] w-1/4 rounded-md object-cover" />
            ) : (
              <span key={`${spec}-${i}`} className="grid aspect-[1.4] w-1/4 place-items-center rounded-md bg-sunken text-[10px] text-red-600">
                ?
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
