import { contrastRatio, primaryTextPair, readableOn } from "./color";
import { parseArt } from "./art";
import { LAYOUTS } from "./layouts";
import { boardRows, TILES, tileOverlaps } from "./tiles";
import type { Brand } from "./schema";

export type Severity = "error" | "warning" | "suggestion";

export interface AuditIssue {
  severity: Severity;
  area: string;
  message: string;
  pageId?: string;
}

/** Heuristic review of a brand: accessibility, completeness, consistency. */
export function auditBrand(b: Brand): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const push = (severity: Severity, area: string, message: string, pageId?: string) => issues.push({ severity, area, message, pageId });

  // Foundations
  if (!b.meta.tagline) push("suggestion", "meta", "Add a tagline — it anchors the cover and statement pages.");
  if (!b.meta.story) push("suggestion", "meta", "Add a short brand story so page copy stays consistent in tone.");
  if (!b.meta.voice.length) push("suggestion", "meta", "Define 3–5 voice attributes (e.g. calm, precise, warm).");
  if (!b.logo.wordmark && !b.logo.markSvg) push("error", "logo", "No logo yet — set a wordmark and/or a logomark SVG.");
  else if (!b.logo.markSvg) push("warning", "logo", "No logomark SVG — logomark and cover pages fall back to the wordmark.");

  // Color
  if (!b.colors.length) push("error", "color", "No colors defined.");
  else {
    for (const role of ["background", "text", "primary"] as const) {
      if (!b.colors.some((c) => c.role === role)) push("warning", "color", `No color with role "${role}".`);
    }
    if (b.colors.length > 8) push("suggestion", "color", `${b.colors.length} colors is a lot — consider 4–6 core colors and let the tonal scales do the rest.`);
    const pair = primaryTextPair(b.colors);
    if (pair && pair.ratio < 4.5) {
      push("error", "accessibility", `Body text ${pair.textName} on ${pair.backgroundName} is ${pair.ratio}:1 — below WCAG AA 4.5:1.`);
    }
    for (const c of b.colors.filter((c) => c.role === "primary" || c.role === "accent")) {
      const ink = readableOn(c.hex);
      const ratio = contrastRatio(ink, c.hex);
      if (ratio < 4.5)
        push("warning", "accessibility", `Buttons filled with ${c.name} reach only ${ratio}:1 with ${ink} labels — use large/bold labels or a darker shade.`);
    }
  }

  // Type
  if (b.typography.display.family === b.typography.text.family && b.typography.display.weights.length < 2) {
    push("suggestion", "type", "Display and text share one family with a single weight — add weights to build hierarchy.");
  }
  if (!b.typography.scale.length) push("suggestion", "type", "No type scale yet — define Display, Heading, Body and Caption styles.");
  const minBody = b.typography.scale.filter((s) => /body|text|paragraph/i.test(s.name)).map((s) => s.size);
  if (minBody.some((s) => s < 14)) push("warning", "accessibility", "Body styles under 14px hurt legibility; 16px is a safer floor for web.");

  // Pages
  if (!b.pages.length) push("error", "pages", "No pages yet — run scaffold or add pages.");
  if (b.pages[0] && b.pages[0].layout !== "cover") push("suggestion", "pages", "Lead with a cover page.");
  const assetIds = new Set(b.imagery.assets.map((a) => a.id));
  for (const p of b.pages) {
    const spec = LAYOUTS[p.layout];
    for (const slot of spec.slots) {
      const v = p.slots[slot.key]?.trim() ?? "";
      if (slot.required && !v) push("warning", "pages", `“${spec.name}” page is missing ${slot.label.toLowerCase()}.`, p.id);
      if ((slot.kind === "asset" || slot.kind === "assets") && v) {
        for (const id of v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)) {
          if (!assetIds.has(id)) push("error", "pages", `“${spec.name}” page references missing asset "${id}".`, p.id);
        }
      }
      if (slot.kind === "option" && v && slot.options && !slot.options.includes(v)) {
        push("warning", "pages", `“${spec.name}” ${slot.key} should be one of ${slot.options.join(", ")}.`, p.id);
      }
    }
    if (p.layout === "iconography-grid" && !b.icons.length) push("warning", "pages", "Iconography page but no icons defined.", p.id);
    if (p.layout === "board") {
      const tiles = p.tiles ?? [];
      const rows = boardRows(p.slots);
      if (!tiles.length) push("warning", "board", "Board has no tiles — add some with add_tile or start from a template.", p.id);
      for (const t of tiles) {
        const spec = TILES[t.kind];
        if (t.y + t.h > rows) push("error", "board", `Tile "${t.id}" runs past row ${rows}; raise the board's rows or move it.`, p.id);
        for (const slot of spec.slots) {
          const v = t.slots[slot.key]?.trim() ?? "";
          if (slot.required && !v) push("warning", "board", `${spec.name} tile "${t.id}" is missing ${slot.label.toLowerCase()}.`, p.id);
          if (slot.kind === "asset" && v && !assetIds.has(v)) push("error", "board", `Tile "${t.id}" references missing asset "${v}".`, p.id);
          if ((slot.kind === "art" || slot.kind === "arts") && v) {
            for (const a of v
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean))
              if (!parseArt(a)) push("warning", "board", `Tile "${t.id}" has an unknown artwork "${a}" (use style:seed, e.g. burst:3).`, p.id);
          }
          if (slot.kind === "option" && v && slot.options && !slot.options.includes(v))
            push("warning", "board", `Tile "${t.id}" ${slot.key} should be one of ${slot.options.join(", ")}.`, p.id);
        }
        if (!spec.tones.includes(t.tone)) push("suggestion", "board", `${spec.name} tiles aren't designed for the ${t.tone} tone.`, p.id);
      }
      for (const [a, c] of tileOverlaps(tiles)) push("warning", "board", `Tiles "${a}" and "${c}" overlap.`, p.id);
    }
    const body = p.slots.body ?? "";
    if (body.split(/\s+/).length > 90)
      push("suggestion", "copy", `“${spec.name}” body copy is long (${body.split(/\s+/).length} words) — guideline pages read best under ~70.`, p.id);
  }
  for (const a of b.imagery.assets) if (!a.alt) push("warning", "accessibility", `Asset "${a.id}" has no alt text.`);

  return issues;
}
