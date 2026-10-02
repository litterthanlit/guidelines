import { primaryTextPair } from "./color";
import { LAYOUTS } from "./layouts";
import type { Brand } from "./schema";

const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Token-efficient view of a brand for the agent: everything needed to reason
 * about the system, without SVG bodies or full tonal scales.
 */
export function summarizeBrand(b: Brand) {
  const pair = primaryTextPair(b.colors);
  return {
    slug: b.slug,
    rev: b.rev,
    updatedBy: b.updatedBy,
    meta: b.meta,
    logo: {
      wordmark: b.logo.wordmark,
      hasMark: !!b.logo.markSvg,
      markBytes: b.logo.markSvg?.length ?? 0,
      clearSpace: b.logo.clearSpace,
      minSize: b.logo.minSize,
      notes: b.logo.notes,
    },
    colors: b.colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex, role: c.role, usage: c.usage })),
    bodyTextContrast: pair ? `${pair.ratio}:1 (${pair.level}), APCA Lc ${pair.apca}` : "n/a — define text and background roles",
    typography: {
      display: `${b.typography.display.family} ${b.typography.display.weights.join("/")}`,
      text: `${b.typography.text.family} ${b.typography.text.weights.join("/")}`,
      mono: b.typography.mono ? b.typography.mono.family : null,
      scale: b.typography.scale.map((s) => `${s.name}: ${s.font} ${s.size}px/${s.lineHeight} w${s.weight}`),
    },
    imagery: {
      style: b.imagery.style,
      assets: b.imagery.assets.map((a) => ({ id: a.id, file: a.file, alt: clip(a.alt, 80) })),
    },
    icons: b.icons.map((i) => i.id),
    pages: b.pages.map((p, i) => ({
      n: i + 1,
      id: p.id,
      layout: p.layout,
      name: LAYOUTS[p.layout].name,
      slots: Object.fromEntries(Object.entries(p.slots).map(([k, v]) => [k, clip(v)])),
    })),
    board: { items: b.board.items.length },
  };
}
