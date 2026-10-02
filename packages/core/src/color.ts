import { converter, formatHex, parse, toGamut, wcagContrast } from "culori";
import { SCALE_STEPS, type Color, type ColorRole, type ScaleStep } from "./schema";

const toOklch = converter("oklch");
const toRgb = converter("rgb");
const clampToSrgb = toGamut("rgb", "oklch");

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

export function hexToOklch(hex: string): Oklch {
  const c = toOklch(parse(hex));
  if (!c) throw new Error(`Invalid color: ${hex}`);
  return { l: c.l, c: c.c ?? 0, h: c.h ?? 0 };
}

export function oklchToHex({ l, c, h }: Oklch): string {
  const mapped = clampToSrgb({ mode: "oklch", l, c, h });
  return (formatHex(mapped) ?? "#000000").toUpperCase();
}

/** Target lightness per scale step: perceptually even, Tailwind-like. */
const STEP_L: Record<ScaleStep, number> = {
  "50": 0.975,
  "100": 0.94,
  "200": 0.885,
  "300": 0.81,
  "400": 0.71,
  "500": 0.62,
  "600": 0.53,
  "700": 0.45,
  "800": 0.37,
  "900": 0.29,
  "950": 0.21,
};

/**
 * Build an 11-step tonal scale from a seed. Hue is held constant; chroma is
 * eased toward the extremes so tints and shades stay in gamut and don't look
 * neon or muddy.
 */
export function buildScale(seedHex: string): Record<ScaleStep, string> {
  const seed = hexToOklch(seedHex);
  const out = {} as Record<ScaleStep, string>;
  for (const step of SCALE_STEPS) {
    const l = STEP_L[step];
    const distance = Math.abs(l - 0.6) / 0.4; // 0 at mid, ~1 at extremes
    const c = seed.c * (1 - 0.65 * Math.min(1, distance) ** 1.5);
    out[step] = oklchToHex({ l, c, h: seed.h });
  }
  return out;
}

/** WCAG 2.x contrast ratio (1–21). */
export function contrastRatio(a: string, b: string): number {
  return Math.round(wcagContrast(a, b) * 100) / 100;
}

/**
 * APCA (WCAG 3 draft) lightness contrast, Lc. Positive for dark text on light
 * backgrounds, negative for light on dark. |Lc| ≥ 75 body, ≥ 60 large, ≥ 45 headlines.
 */
export function apcaContrast(textHex: string, bgHex: string): number {
  const lum = (hex: string) => {
    const c = toRgb(parse(hex));
    if (!c) throw new Error(`Invalid color: ${hex}`);
    const lin = (v: number) => Math.pow(Math.max(0, v), 2.4);
    return 0.2126729 * lin(c.r) + 0.7151522 * lin(c.g) + 0.072175 * lin(c.b);
  };
  const clampBlack = (y: number) => (y > 0.022 ? y : y + Math.pow(0.022 - y, 1.414));
  const yt = clampBlack(lum(textHex));
  const yb = clampBlack(lum(bgHex));
  if (Math.abs(yb - yt) < 0.0005) return 0;
  let sapc: number;
  if (yb > yt) {
    sapc = (Math.pow(yb, 0.56) - Math.pow(yt, 0.57)) * 1.14;
    sapc = sapc < 0.1 ? 0 : sapc - 0.027;
  } else {
    sapc = (Math.pow(yb, 0.65) - Math.pow(yt, 0.62)) * 1.14;
    sapc = sapc > -0.1 ? 0 : sapc + 0.027;
  }
  return Math.round(sapc * 1000) / 10;
}

export type WcagLevel = "AAA" | "AA" | "AA Large" | "Fail";

export function wcagLevel(ratio: number): WcagLevel {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA Large";
  return "Fail";
}

/** Best readable ink (near-black or white) for text on a given background. */
export function readableOn(bgHex: string, dark = "#111111", light = "#FFFFFF"): string {
  return contrastRatio(dark, bgHex) >= contrastRatio(light, bgHex) ? dark : light;
}

export interface ContrastPair {
  text: string;
  background: string;
  textName: string;
  backgroundName: string;
  ratio: number;
  apca: number;
  level: WcagLevel;
}

/** Contrast report for every text/background candidate pair in a palette. */
export function contrastReport(colors: Pick<Color, "name" | "hex" | "role">[]): ContrastPair[] {
  const backgrounds = colors.filter((c) => c.role === "background" || c.role === "neutral" || c.role === "primary");
  const inks = colors.filter((c) => c.role === "text" || c.role === "primary" || c.role === "accent" || c.role === "secondary");
  const pairs: ContrastPair[] = [];
  for (const bg of backgrounds) {
    for (const ink of inks) {
      if (ink.hex === bg.hex) continue;
      const ratio = contrastRatio(ink.hex, bg.hex);
      pairs.push({
        text: ink.hex,
        background: bg.hex,
        textName: ink.name,
        backgroundName: bg.name,
        ratio,
        apca: apcaContrast(ink.hex, bg.hex),
        level: wcagLevel(ratio),
      });
    }
  }
  return pairs.sort((a, b) => b.ratio - a.ratio);
}

/** The main body-text pair: `text` role on `background` role, if both exist. */
export function primaryTextPair(colors: Pick<Color, "name" | "hex" | "role">[]): ContrastPair | undefined {
  const text = colors.find((c) => c.role === "text");
  const bg = colors.find((c) => c.role === "background");
  if (!text || !bg) return undefined;
  const ratio = contrastRatio(text.hex, bg.hex);
  return {
    text: text.hex,
    background: bg.hex,
    textName: text.name,
    backgroundName: bg.name,
    ratio,
    apca: apcaContrast(text.hex, bg.hex),
    level: wcagLevel(ratio),
  };
}

export interface PaletteProposal {
  name: string;
  rationale: string;
  colors: { name: string; hex: string; role: ColorRole }[];
}

const rot = (h: number, d: number) => (((h + d) % 360) + 360) % 360;

/**
 * Algorithmic palette options from a seed color. The agent can present these,
 * remix them, or ignore them in favour of its own picks.
 */
export function proposePalettes(seedHex: string): PaletteProposal[] {
  const s = hexToOklch(seedHex);
  const hex = (l: number, c: number, h: number) => oklchToHex({ l, c, h });
  const warmNeutralHue = rot(s.h, 0);
  const seedName = "Signature";

  return [
    {
      name: "Monochrome + signal",
      rationale: "Tonal neutrals carry the system; the seed is reserved for a single accent so it reads as intentional (Linear / Vercel restraint).",
      colors: [
        { name: "Paper", hex: hex(0.975, 0.004, warmNeutralHue), role: "background" },
        { name: "Ink", hex: hex(0.2, 0.01, warmNeutralHue), role: "text" },
        { name: "Stone", hex: hex(0.85, 0.008, warmNeutralHue), role: "neutral" },
        { name: seedName, hex: seedHex.toUpperCase(), role: "accent" },
      ],
    },
    {
      name: "Analogous editorial",
      rationale: "Neighbouring hues create a calm, painterly field — suited to imagery-led brands and long-form layouts.",
      colors: [
        { name: "Linen", hex: hex(0.96, 0.012, rot(s.h, -20)), role: "background" },
        { name: "Charcoal", hex: hex(0.24, 0.012, s.h), role: "text" },
        { name: seedName, hex: seedHex.toUpperCase(), role: "primary" },
        { name: "Drift", hex: hex(Math.min(0.8, s.l + 0.15), s.c * 0.6, rot(s.h, 30)), role: "secondary" },
        { name: "Sage", hex: hex(0.88, 0.03, rot(s.h, -40)), role: "neutral" },
      ],
    },
    {
      name: "Complementary pop",
      rationale: "A deep primary with its complement as a vibrant pop — high energy for product marketing and campaign moments.",
      colors: [
        { name: "Canvas", hex: hex(0.985, 0.003, s.h), role: "background" },
        { name: "Midnight", hex: hex(0.18, Math.min(0.05, s.c), s.h), role: "text" },
        { name: seedName, hex: hex(0.45, Math.max(0.12, s.c), s.h), role: "primary" },
        { name: "Flare", hex: hex(0.72, 0.17, rot(s.h, 180)), role: "accent" },
        { name: "Mist", hex: hex(0.92, 0.02, s.h), role: "neutral" },
      ],
    },
    {
      name: "Dusk gradient",
      rationale: "Split-complementary hues tuned for soft, blurred gradients and glass surfaces — atmospheric hero moments.",
      colors: [
        { name: "Night", hex: hex(0.16, 0.02, rot(s.h, 200)), role: "background" },
        { name: "Glow", hex: hex(0.97, 0.01, s.h), role: "text" },
        { name: seedName, hex: seedHex.toUpperCase(), role: "primary" },
        { name: "Ember", hex: hex(0.7, 0.16, rot(s.h, 150)), role: "accent" },
        { name: "Haze", hex: hex(0.62, 0.09, rot(s.h, 210)), role: "secondary" },
      ],
    },
  ];
}

/** Layered CSS gradient used for atmospheric surfaces (Sequence-style blur). */
export function atmosphericGradient(hexes: string[], seed = 1): string {
  const pool = hexes.length ? hexes : ["#C9D6EA", "#7D93C9", "#F3EFE6"];
  let x = seed * 9301 + 49297;
  const rand = () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
  const layers = pool.slice(0, 4).map((hex, i) => {
    const px = Math.round(10 + rand() * 80);
    const py = Math.round(10 + rand() * 80);
    const size = Math.round(45 + rand() * 35);
    return `radial-gradient(${size}% ${size + 10}% at ${px}% ${py}%, ${hex} 0%, ${hex}00 ${70 + i * 5}%)`;
  });
  return `${layers.join(", ")}, ${pool[pool.length - 1]}`;
}
