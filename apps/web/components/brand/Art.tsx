"use client";

import { artColors, parseArt, renderArt, svgDataUri, type ArtColors, type Brand } from "@guidelines/core";
import { memo, useMemo, type CSSProperties } from "react";

/** Long edge, in SVG user units, artwork is drawn at. The browser rasterizes at display size. */
const LONG_EDGE = 1400;

export function artUri(brand: Brand, spec: string | undefined, tone: "light" | "dark", aspect = 1.5, grain = 1): string | undefined {
  const parsed = parseArt(spec);
  if (!parsed) return undefined;
  const a = Math.min(4, Math.max(0.25, aspect));
  const width = a >= 1 ? LONG_EDGE : LONG_EDGE * a;
  const height = a >= 1 ? LONG_EDGE / a : LONG_EDGE;
  return svgDataUri(renderArt(parsed, artColors(brand, tone), { width, height, grain }));
}

/**
 * Procedural brand artwork as a decorative <img>. Regenerates only when the
 * spec, palette, tone or shape changes, so it follows palette edits live.
 */
export const Art = memo(function Art({
  brand,
  spec,
  tone,
  aspect,
  grain,
  className = "s-img",
  style,
}: {
  brand: Brand;
  spec: string | undefined;
  tone: "light" | "dark";
  /** Width ÷ height of the box it fills. */
  aspect?: number;
  grain?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const key = colorKey(artColors(brand, tone));
  // Quantize aspect so tiny layout changes don't redraw.
  const q = aspect ? Math.round(aspect * 8) / 8 : 1.5;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const src = useMemo(() => artUri(brand, spec, tone, q, grain), [spec, tone, q, grain, key]);
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} style={style} src={src} alt="" aria-hidden decoding="async" draggable={false} />;
});

const colorKey = (c: ArtColors) => `${c.bg}${c.ink}${c.primary}${c.secondary}${c.accent}${c.light}`;
