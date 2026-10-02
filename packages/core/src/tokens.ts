import { readableOn } from "./color";
import { slugify } from "./mutations";
import type { Brand, Font } from "./schema";

export const TOKEN_FORMATS = ["css", "tailwind", "w3c-json", "figma-variables-json"] as const;
export type TokenFormat = (typeof TOKEN_FORMATS)[number];

const stack = (f: Font) => `"${f.family}", ${f.fallback}`;
const rem = (px: number) => `${+(px / 16).toFixed(4)}rem`;

function fontsOf(b: Brand): [string, Font][] {
  const out: [string, Font][] = [
    ["display", b.typography.display],
    ["text", b.typography.text],
  ];
  if (b.typography.mono) out.push(["mono", b.typography.mono]);
  return out;
}

function roleVars(b: Brand): [string, string][] {
  const pick = (role: string) => b.colors.find((c) => c.role === role)?.hex;
  const bg = pick("background") ?? "#FFFFFF";
  const fg = pick("text") ?? readableOn(bg);
  const primary = pick("primary") ?? pick("accent") ?? fg;
  return [
    ["background", bg],
    ["foreground", fg],
    ["primary", primary],
    ["primary-foreground", readableOn(primary)],
    ["accent", pick("accent") ?? primary],
    ["muted", pick("neutral") ?? bg],
  ];
}

export function toCss(b: Brand): string {
  const lines: string[] = [`/* ${b.meta.name} — design tokens (rev ${b.rev}) */`, ":root {"];
  for (const c of b.colors) {
    const id = slugify(c.id);
    lines.push(`  --color-${id}: ${c.hex};`);
    for (const [step, hex] of Object.entries(c.scale)) lines.push(`  --color-${id}-${step}: ${hex};`);
  }
  lines.push("");
  for (const [k, v] of roleVars(b)) lines.push(`  --${k}: ${v};`);
  lines.push("");
  for (const [role, f] of fontsOf(b)) lines.push(`  --font-${role}: ${stack(f)};`);
  for (const s of b.typography.scale) {
    const id = slugify(s.name);
    lines.push(`  --text-${id}: ${rem(s.size)};`);
    lines.push(`  --text-${id}--line-height: ${s.lineHeight};`);
    if (s.tracking) lines.push(`  --text-${id}--letter-spacing: ${s.tracking}em;`);
    lines.push(`  --text-${id}--font-weight: ${s.weight};`);
  }
  lines.push("}");
  return lines.join("\n") + "\n";
}

/** Tailwind CSS v4 `@theme` block — drop into your main stylesheet. */
export function toTailwind(b: Brand): string {
  const lines: string[] = [`/* ${b.meta.name} — Tailwind v4 theme (rev ${b.rev}) */`, '@import "tailwindcss";', "", "@theme {"];
  for (const c of b.colors) {
    const id = slugify(c.id);
    lines.push(`  --color-${id}: ${c.hex};`);
    for (const [step, hex] of Object.entries(c.scale)) lines.push(`  --color-${id}-${step}: ${hex};`);
  }
  for (const [k, v] of roleVars(b)) lines.push(`  --color-${k}: ${v};`);
  for (const [role, f] of fontsOf(b)) lines.push(`  --font-${role}: ${stack(f)};`);
  for (const s of b.typography.scale) {
    const id = slugify(s.name);
    lines.push(`  --text-${id}: ${rem(s.size)};`);
    lines.push(`  --text-${id}--line-height: ${s.lineHeight};`);
    if (s.tracking) lines.push(`  --text-${id}--letter-spacing: ${s.tracking}em;`);
    lines.push(`  --text-${id}--font-weight: ${s.weight};`);
  }
  lines.push("}");
  return lines.join("\n") + "\n";
}

/** W3C Design Tokens Community Group format. */
export function toW3c(b: Brand): Record<string, unknown> {
  const color: Record<string, unknown> = {};
  for (const c of b.colors) {
    const scale = Object.fromEntries(Object.entries(c.scale).map(([s, hex]) => [s, { $value: hex }]));
    color[slugify(c.id)] = {
      $type: "color",
      $value: c.hex,
      $description: [c.role, c.usage].filter(Boolean).join(" — "),
      ...scale,
    };
  }
  const fontFamily: Record<string, unknown> = {};
  for (const [role, f] of fontsOf(b)) {
    fontFamily[role] = { $type: "fontFamily", $value: [f.family, ...f.fallback.split(",").map((s) => s.trim().replace(/['"]/g, ""))] };
  }
  const typography: Record<string, unknown> = {};
  for (const s of b.typography.scale) {
    typography[slugify(s.name)] = {
      $type: "typography",
      $value: {
        fontFamily: `{font.${s.font}}`,
        fontSize: rem(s.size),
        fontWeight: s.weight,
        lineHeight: s.lineHeight,
        letterSpacing: `${s.tracking}em`,
      },
    };
  }
  return { $description: `${b.meta.name} design tokens`, color, font: fontFamily, typography };
}

/** A simple Figma Variables import shape (one collection, light mode). */
export function toFigmaVariables(b: Brand): Record<string, unknown> {
  const toRgba = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: 1 };
  };
  const variables: Record<string, unknown>[] = [];
  for (const c of b.colors) {
    const id = slugify(c.id);
    variables.push({ name: `color/${id}/base`, resolvedType: "COLOR", valuesByMode: { light: toRgba(c.hex) }, description: c.usage });
    for (const [step, hex] of Object.entries(c.scale)) {
      variables.push({ name: `color/${id}/${step}`, resolvedType: "COLOR", valuesByMode: { light: toRgba(hex) } });
    }
  }
  for (const [role, f] of fontsOf(b)) {
    variables.push({ name: `font/${role}`, resolvedType: "STRING", valuesByMode: { light: f.family } });
  }
  for (const s of b.typography.scale) {
    variables.push({ name: `type/${slugify(s.name)}/size`, resolvedType: "FLOAT", valuesByMode: { light: s.size } });
  }
  return { collections: [{ name: b.meta.name, modes: ["light"], variables }] };
}

export function exportTokens(b: Brand, format: TokenFormat): { filename: string; mime: string; content: string } {
  const base = slugify(b.slug);
  switch (format) {
    case "css":
      return { filename: `${base}.tokens.css`, mime: "text/css", content: toCss(b) };
    case "tailwind":
      return { filename: `${base}.theme.css`, mime: "text/css", content: toTailwind(b) };
    case "w3c-json":
      return { filename: `${base}.tokens.json`, mime: "application/json", content: JSON.stringify(toW3c(b), null, 2) + "\n" };
    case "figma-variables-json":
      return { filename: `${base}.figma-variables.json`, mime: "application/json", content: JSON.stringify(toFigmaVariables(b), null, 2) + "\n" };
  }
}
