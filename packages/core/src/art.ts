import type { Brand, Color } from "./schema";

/**
 * Procedural brand artwork. Deterministic, on-palette SVG generated from a
 * style and a seed, so the same spec always draws the same picture and every
 * piece recolors itself when the palette changes.
 *
 * Specs are compact strings that fit in page/tile slots: "burst", "flow:7".
 * Output is a standalone SVG document meant for <img src="data:…"> (never
 * inlined), so it can't interfere with the page that shows it.
 */

export const ART_STYLES = {
  burst: { name: "Burst", description: "Grainy radial explosion of rays around a dark core with an accent halo. Hero moments." },
  converge: { name: "Converge", description: "Rays streaming in from the left and pinching to a bright point at right. 'Capture', input, focus." },
  diverge: { name: "Diverge", description: "Rays fanning out to the right from a bright point at left. 'Resume', output, release." },
  swirl: { name: "Swirl", description: "Sweeping, grain-sprayed ribbons around a vortex. Atmospheric side panels and posters." },
  flow: {
    name: "Flow",
    description: "Fine parallel lines that funnel through a narrow channel and fan out again, with a glow at the pinch. Systems, pipelines.",
  },
  strata: { name: "Strata", description: "Isometric wireframe planes stacked in a column, one glowing layer. Layers, memory, storage." },
  stripes: { name: "Stripes", description: "A polygon emblem drawn as concentric gradient stripes. Structure, grouping." },
  prism: { name: "Prism", description: "A faceted polygon filled with a radial light-to-accent gradient. Objects, nodes, entities." },
  star: { name: "Star", description: "A spiky starburst rising from a glowing core. Moments of insight, security, signal." },
  orb: { name: "Orb", description: "The glowing rim of a planet-sized circle, horizon light. Logo backdrops and covers." },
  grid: { name: "Grid", description: "A hairline grid with a few glowing cells. Patterns, data, product texture." },
  haze: { name: "Haze", description: "Soft blurred color orbs with fine grain. Quiet, calm backgrounds." },
  bands: { name: "Bands", description: "Horizontal motion-blurred bands of color. Landscapes, horizons, speed." },
} as const;

export type ArtStyle = keyof typeof ART_STYLES;

/** Where a style's focal point sits (fractions of width/height), for placing a mark on it. */
export const ART_FOCUS: Partial<Record<ArtStyle, [number, number]>> = { flow: [0.5, 0.56] };
export const ART_STYLE_IDS = Object.keys(ART_STYLES) as ArtStyle[];

export interface ArtSpec {
  style: ArtStyle;
  seed: number;
}

/** Colors the generators draw with. `bg`/`ink` swap for dark artwork. */
export interface ArtColors {
  bg: string;
  ink: string;
  primary: string;
  secondary: string;
  accent: string;
  /** A pale tint of the primary, for highlights and light lines. */
  light: string;
}

/** Parse "burst", "burst:7" or "burst 7". Returns undefined for anything else. */
export function parseArt(value: string | undefined): ArtSpec | undefined {
  if (!value) return undefined;
  const m = /^\s*([a-z]+)(?:[\s:#-]+(\d{1,6}))?\s*$/i.exec(value);
  if (!m) return undefined;
  const style = m[1]!.toLowerCase();
  if (!(style in ART_STYLES)) return undefined;
  return { style: style as ArtStyle, seed: m[2] ? Number(m[2]) : 1 };
}

export const formatArt = (spec: ArtSpec) => `${spec.style}:${spec.seed}`;

const role = (b: Brand, ...roles: Color["role"][]) => {
  for (const r of roles) {
    const c = b.colors.find((c) => c.role === r);
    if (c) return c;
  }
  return undefined;
};

/** Derive artwork colors from a brand's palette roles for a light or dark surface. */
export function artColors(b: Brand, tone: "light" | "dark" = "light"): ArtColors {
  const paper = role(b, "background")?.hex ?? "#F4F3F0";
  const ink = role(b, "text")?.hex ?? "#151515";
  const primaryC = role(b, "primary", "accent", "secondary");
  const primary = primaryC?.hex ?? "#3A6FD8";
  const secondaryC = role(b, "secondary", "neutral");
  const accent = role(b, "accent")?.hex ?? secondaryC?.hex ?? primary;
  const secondary = secondaryC && secondaryC.hex !== accent ? secondaryC.hex : (primaryC?.scale["300"] ?? primary);
  const light = primaryC?.scale["200"] ?? "#DCE6F7";
  return tone === "dark" ? { bg: ink, ink: paper, primary, secondary, accent, light } : { bg: paper, ink, primary, secondary, accent, light };
}

/* ─────────────────────────────── utilities ─────────────────────────────── */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Small, fast, seedable PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0 || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo: number, hi: number) => lo + next() * (hi - lo),
    int: (lo: number, hi: number) => Math.floor(lo + next() * (hi - lo + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    /** Roughly normal, mean 0, sd 1. */
    gauss: () => (next() + next() + next() + next() - 2) * 1.73,
  };
}
type Rand = ReturnType<typeof rng>;

const n = (v: number) => (Math.abs(v) < 1e-6 ? "0" : v.toFixed(1).replace(/\.0$/, ""));
const o = (v: number) => Math.max(0, Math.min(1, v)).toFixed(2);
const pts = (list: [number, number][]) => list.map(([x, y]) => `${n(x)},${n(y)}`).join(" ");

interface Ctx {
  w: number;
  h: number;
  /** min(w, h): the scale unit most measurements derive from. */
  s: number;
  c: ArtColors;
  r: Rand;
  dark: boolean;
  defs: string[];
}

function luminance(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  const ch = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => {
    const c = x / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

function blurFilter(ctx: Ctx, id: string, sd: number | string) {
  ctx.defs.push(
    `<filter id="${id}" filterUnits="userSpaceOnUse" x="${n(-ctx.w * 0.2)}" y="${n(-ctx.h * 0.2)}" width="${n(ctx.w * 1.4)}" height="${n(ctx.h * 1.4)}"><feGaussianBlur stdDeviation="${sd}"/></filter>`,
  );
  return `url(#${id})`;
}

/**
 * Spray grain: displaces pixels by high-frequency noise, so soft blurred color
 * breaks up into a stippled, risograph-like texture at its edges.
 */
function grainFilter(ctx: Ctx, amount: number) {
  const scale = ctx.s * 0.024 * amount;
  ctx.defs.push(
    `<filter id="spray" filterUnits="userSpaceOnUse" x="0" y="0" width="${ctx.w}" height="${ctx.h}" color-interpolation-filters="sRGB">` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="2" seed="${ctx.r.int(1, 999)}" result="noise"/>` +
      `<feDisplacementMap in="SourceGraphic" in2="noise" scale="${n(scale)}" xChannelSelector="R" yChannelSelector="G"/>` +
      `</filter>`,
  );
  // Fine speckle laid over everything, in the ink color.
  ctx.defs.push(
    `<filter id="speckle" filterUnits="userSpaceOnUse" x="0" y="0" width="${ctx.w}" height="${ctx.h}">` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="${ctx.r.int(1, 999)}"/>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -9 0 0 0 3.7"/>` +
      `<feComposite in2="SourceGraphic" operator="in"/>` +
      `</filter>`,
  );
}

function radial(ctx: Ctx, id: string, cx: number, cy: number, r: number, stops: [number, string, number][]) {
  ctx.defs.push(
    `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}">${stops
      .map(([at, color, op]) => `<stop offset="${o(at)}" stop-color="${color}" stop-opacity="${o(op)}"/>`)
      .join("")}</radialGradient>`,
  );
  return `url(#${id})`;
}

function linear(ctx: Ctx, id: string, x1: number, y1: number, x2: number, y2: number, stops: [number, string, number][]) {
  ctx.defs.push(
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}">${stops
      .map(([at, color, op]) => `<stop offset="${o(at)}" stop-color="${color}" stop-opacity="${o(op)}"/>`)
      .join("")}</linearGradient>`,
  );
  return `url(#${id})`;
}

/** A thin wedge from a focal point: narrow at the origin, wider outward. */
function wedge(fx: number, fy: number, angle: number, len: number, halfWidth: number, start = 0) {
  const a1 = angle - halfWidth;
  const a2 = angle + halfWidth;
  const s = start;
  return pts([
    [fx + Math.cos(angle) * s, fy + Math.sin(angle) * s],
    [fx + Math.cos(a1) * len, fy + Math.sin(a1) * len],
    [fx + Math.cos(angle) * len * 1.04, fy + Math.sin(angle) * len * 1.04],
    [fx + Math.cos(a2) * len, fy + Math.sin(a2) * len],
  ]);
}

/* ─────────────────────────────── generators ─────────────────────────────── */

interface RayField {
  fx: number;
  fy: number;
  /** Direction rays point toward (radians); ignored when spread ≥ π. */
  dir: number;
  /** Half-angle of the fan (radians). π = full circle. */
  spread: number;
  /** Vertical squash for full bursts. */
  squash: number;
  /** Full bursts reach further along this axis (radians), by `stretch`. */
  axis?: number;
  stretch?: number;
}

function rays(ctx: Ctx, f: RayField): string {
  const { w, h, s, c, r } = ctx;
  const diag = Math.hypot(w, h);
  const full = f.spread >= Math.PI - 0.01;
  const angleAt = () => {
    if (full) return r.range(0, Math.PI * 2);
    // Bias toward the fan's center line.
    return f.dir + Math.max(-1, Math.min(1, r.gauss() / 2)) * f.spread;
  };
  const reach = full ? diag * 0.62 : diag * 0.95;
  const fade = (id: string, color: string, peak: number) =>
    radial(ctx, id, f.fx, f.fy, reach, [
      [0, color, peak],
      [0.18, color, peak * 0.95],
      [0.55, color, peak * 0.55],
      [1, color, 0],
    ]);

  const gPrimary = fade("rp", c.primary, 1);
  const gSecondary = fade("rs", c.secondary === c.accent ? c.light : c.secondary, 0.9);
  const gLight = fade("rl", c.light, 0.9);
  const gBg = radial(ctx, "rb", f.fx, f.fy, reach, [
    [0, c.bg, 0],
    [0.12, c.bg, 0.4],
    [0.5, c.bg, 0.9],
    [1, c.bg, 1],
  ]);
  const squash = (y: number) => f.fy + (y - f.fy) * f.squash;
  const along = (a: number) => (f.stretch ? 1 - f.stretch * 0.5 + f.stretch * Math.cos(a - (f.axis ?? 0)) ** 2 : 1);
  const layer = (count: number, fill: string, lenLo: number, lenHi: number, wLo: number, wHi: number, opLo = 0.6, opHi = 1) => {
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      const a = angleAt();
      const len = reach * r.range(lenLo, lenHi) * along(a);
      const hw = r.range(wLo, wHi);
      const poly = wedge(f.fx, f.fy, a, len, hw)
        .split(" ")
        .map((p) => {
          const [x, y] = p.split(",").map(Number) as [number, number];
          return `${n(x)},${n(squash(y))}`;
        })
        .join(" ");
      out.push(`<polygon points="${poly}" fill="${fill}" opacity="${o(r.range(opLo, opHi))}"/>`);
    }
    return out.join("");
  };

  const density = full ? 1 : 0.75;
  const soft = blurFilter(ctx, "soft", n(s * 0.005));
  const softer = blurFilter(ctx, "softer", n(s * 0.03));
  const core = blurFilter(ctx, "core", n(s * 0.006));
  const haloBlur = blurFilter(ctx, "halo", n(s * 0.03));

  const glow = radial(ctx, "glow", 0, 0, s * 0.2, [
    [0, c.accent, 1],
    [0.5, c.accent, 0.7],
    [1, c.accent, 0],
  ]);
  const nucleusColor = ctx.dark ? c.light : c.ink;
  const darkCore = radial(ctx, "dcore", f.fx, f.fy, s * (full ? 0.16 : 0.1), [
    [0, nucleusColor, 1],
    [0.45, nucleusColor, 0.85],
    [1, nucleusColor, 0],
  ]);
  const ax = f.fx - (full ? s * 0.025 : Math.cos(f.dir) * -s * 0.015);
  const ay = f.fy - s * 0.03;
  const count = (k: number) => Math.round(k * density);

  /** Short rays radiating from the core: the dark nucleus and the accent spark. */
  const spikes = (k: number, fill: string, lenLo: number, lenHi: number, wLo: number, wHi: number, opLo: number, opHi: number, cx = f.fx, cy = f.fy) => {
    const out: string[] = [];
    for (let i = 0; i < k; i++) {
      const a = angleAt();
      const len = s * r.range(lenLo, lenHi) * along(a) * (r.next() < 0.12 ? 1.8 : 1);
      const poly = wedge(cx, cy, a, len, r.range(wLo, wHi))
        .split(" ")
        .map((p) => {
          const [x, y] = p.split(",").map(Number) as [number, number];
          return `${n(x)},${n(squash(y))}`;
        })
        .join(" ");
      out.push(`<polygon points="${poly}" fill="${fill}" opacity="${o(r.range(opLo, opHi))}"/>`);
    }
    return out.join("");
  };

  return [
    // Wide, soft color field behind the streaks.
    `<g filter="${softer}">${layer(count(30), gLight, 0.5, 1, 0.05, 0.14, 0.45, 0.85)}</g>`,
    // Hundreds of hairline streaks accumulate into tone, like a long exposure.
    `<g filter="${soft}">`,
    layer(count(260), gPrimary, 0.25, 1, 0.002, 0.014, 0.35, 0.85),
    layer(count(80), gSecondary, 0.25, 0.85, 0.002, 0.012, 0.3, 0.75),
    layer(count(110), gBg, 0.35, 1, 0.001, 0.006, 0.55, 1),
    `</g>`,
    // Accent halo behind the core, nudged up and back.
    `<g filter="${haloBlur}"><ellipse cx="0" cy="0" rx="${n(s * (full ? 0.15 : 0.08))}" ry="${n(s * (full ? 0.08 : 0.05))}" fill="${glow}" transform="translate(${n(ax)} ${n(ay)})"/></g>`,
    `<g filter="${core}">${spikes(count(50), c.accent, 0.03, full ? 0.12 : 0.08, 0.01, 0.05, 0.35, 0.8, ax, ay)}</g>`,
    // The dark core: a dense cluster of short ink spikes around a soft nucleus.
    `<g filter="${core}">`,
    spikes(count(full ? 170 : 110), nucleusColor, 0.015, full ? 0.17 : 0.22, 0.006, 0.035, 0.35, 0.85),
    `<ellipse cx="${n(f.fx)}" cy="${n(f.fy)}" rx="${n(s * (full ? 0.075 : 0.04))}" ry="${n(s * (full ? 0.045 : 0.03))}" fill="${darkCore}"/>`,
    `</g>`,
  ].join("");
}

function burst(ctx: Ctx): string {
  const { w, h, r } = ctx;
  return rays(ctx, {
    fx: w * r.range(0.52, 0.62),
    fy: h * r.range(0.46, 0.56),
    dir: 0,
    spread: Math.PI,
    squash: r.range(0.8, 1),
    axis: r.range(-0.9, -0.4),
    stretch: r.range(0.5, 0.8),
  });
}

function converge(ctx: Ctx): string {
  const { w, h, r } = ctx;
  return rays(ctx, { fx: w * r.range(0.86, 0.93), fy: h * r.range(0.46, 0.54), dir: Math.PI, spread: r.range(0.22, 0.34), squash: 1 });
}

function diverge(ctx: Ctx): string {
  const { w, h, r } = ctx;
  return rays(ctx, { fx: w * r.range(0.04, 0.1), fy: h * r.range(0.5, 0.58), dir: -0.08, spread: r.range(0.24, 0.36), squash: 1 });
}

function swirl(ctx: Ctx): string {
  const { w, h, s, c, r } = ctx;
  // A vortex sitting in a steady diagonal drift; ribbons are its streamlines.
  const vx = w * r.range(0.3, 0.45);
  const vy = h * r.range(0.55, 0.72);
  const drift = r.range(-0.75, -0.45);
  const spin = r.pick([1, -1]) * r.range(0.9, 1.4);
  const soft = blurFilter(ctx, "soft", n(s * 0.011));
  const wide = blurFilter(ctx, "wide", n(s * 0.045));
  const stream = (color: string, width: number, op: number) => {
    let x = r.range(-0.2, 0.9) * w;
    let y = r.range(0.1, 1.2) * h;
    const list: [number, number][] = [];
    const step = s * 0.035;
    for (let i = 0; i < 48; i++) {
      list.push([x, y]);
      const dx = x - vx;
      const dy = y - vy;
      const d2 = dx * dx + dy * dy + (s * 0.22) ** 2;
      const k = (spin * (s * 0.55) ** 2) / d2;
      let ux = Math.cos(drift) + (-dy * k) / s;
      let uy = Math.sin(drift) + (dx * k) / s;
      const len = Math.hypot(ux, uy) || 1;
      ux /= len;
      uy /= len;
      x += ux * step;
      y += uy * step;
      if (x < -w * 0.3 || x > w * 1.3 || y < -h * 0.3 || y > h * 1.3) break;
    }
    if (list.length < 3) return "";
    return `<polyline points="${pts(list)}" fill="none" stroke="${color}" stroke-width="${n(width)}" stroke-linecap="round" stroke-linejoin="round" opacity="${o(op)}"/>`;
  };
  const many = (count: number, color: string, wLo: number, wHi: number, opLo: number, opHi: number) =>
    Array.from({ length: count }, () => stream(color, s * r.range(wLo, wHi), r.range(opLo, opHi))).join("");
  const second = c.secondary === c.accent ? c.light : c.secondary;
  return [
    `<g filter="${wide}">${many(10, c.light, 0.1, 0.22, 0.45, 0.85)}${many(4, c.primary, 0.1, 0.18, 0.3, 0.55)}</g>`,
    `<g filter="${soft}">`,
    many(30, c.primary, 0.012, 0.06, 0.7, 1),
    many(10, second, 0.02, 0.05, 0.5, 0.9),
    many(34, c.bg, 0.006, 0.026, 0.6, 1),
    many(3, c.accent, 0.01, 0.022, 0.45, 0.75),
    `</g>`,
  ].join("");
}

function flow(ctx: Ctx): string {
  const { w, h, s, c, r } = ctx;
  const lines = r.int(24, 32);
  const [fx, fy] = ART_FOCUS.flow!;
  const cy = h * fy;
  const pinchL = w * (fx - r.range(0.08, 0.13));
  const pinchR = w * fx * 2 - pinchL;
  const band = h * r.range(0.07, 0.11);
  const spreadL = h * r.range(0.8, 1.1);
  const spreadR = h * r.range(0.5, 0.8);
  const lineColor = ctx.dark ? c.light : c.primary;
  const stroke = linear(ctx, "lg", 0, 0, w, 0, [
    [0, lineColor, 0.55],
    [0.3, lineColor, 0.95],
    [0.47, c.accent, 1],
    [0.53, c.accent, 1],
    [0.7, lineColor, 0.95],
    [1, lineColor, 0.35],
  ]);
  const paths: string[] = [];
  for (let i = 0; i < lines; i++) {
    const t = lines === 1 ? 0.5 : i / (lines - 1) - 0.5;
    const yl = cy + t * spreadL;
    const yp = cy + t * band;
    const yr = cy + t * spreadR + t * t * h * 0.1;
    const k = (pinchL - 0) * 0.55;
    const kr = (w - pinchR) * 0.55;
    paths.push(
      `<path d="M${n(-w * 0.02)} ${n(yl)} C${n(k)} ${n(yl)} ${n(pinchL - k)} ${n(yp)} ${n(pinchL)} ${n(yp)} L${n(pinchR)} ${n(yp)} C${n(pinchR + kr)} ${n(yp)} ${n(w - kr)} ${n(yr)} ${n(w * 1.02)} ${n(yr)}"/>`,
    );
  }
  const haze = blurFilter(ctx, "haze", n(s * 0.09));
  const glowF = blurFilter(ctx, "glowf", n(s * 0.03));
  const mid = (pinchL + pinchR) / 2;
  return [
    // Grainy color haze behind the lines.
    `<g filter="${haze}">`,
    `<ellipse cx="${n(w * r.range(0.75, 0.95))}" cy="${n(h * r.range(0.1, 0.4))}" rx="${n(w * 0.35)}" ry="${n(h * 0.45)}" fill="${c.primary}" opacity="${ctx.dark ? 0.75 : 0.45}"/>`,
    `<ellipse cx="${n(w * 0.95)}" cy="${n(cy)}" rx="${n(w * 0.2)}" ry="${n(h * 0.25)}" fill="${c.secondary === c.accent ? c.light : c.secondary}" opacity="0.5"/>`,
    `<ellipse cx="${n(w * 0.05)}" cy="${n(h * 0.95)}" rx="${n(w * 0.25)}" ry="${n(h * 0.25)}" fill="${c.primary}" opacity="${ctx.dark ? 0.35 : 0.2}"/>`,
    `</g>`,
    `<g filter="${glowF}"><ellipse cx="${n(mid)}" cy="${n(cy)}" rx="${n((pinchR - pinchL) * 0.75)}" ry="${n(band * 1.6)}" fill="${c.primary}" opacity="0.6"/><ellipse cx="${n(mid)}" cy="${n(cy)}" rx="${n((pinchR - pinchL) * 0.32)}" ry="${n(band * 0.9)}" fill="${c.accent}" opacity="0.85"/></g>`,
    `<g fill="none" stroke="${stroke}" stroke-width="1.1" data-crisp="1">${paths.join("").replace(/<path\b/g, '<path vector-effect="non-scaling-stroke"')}</g>`,
  ].join("");
}

function strata(ctx: Ctx): string {
  const { w, h, s, c, r } = ctx;
  const planes = r.int(5, 7);
  const cx = w * 0.5;
  let a = Math.min(w * 0.34, s * 0.6);
  let b = a * 0.42;
  let gap = Math.min((h * 0.66) / planes, b * 0.75);
  // Shrink the whole stack until it fits the frame with a margin.
  const fit = Math.min(1, (h * 0.84) / ((planes - 1) * gap + 2 * b));
  a *= fit;
  b *= fit;
  gap *= fit;
  const top = h / 2 - ((planes - 1) * gap) / 2;
  const hot = r.int(1, planes - 2);
  const line = ctx.dark ? c.light : c.ink;
  const glow = blurFilter(ctx, "glow", n(s * 0.03));
  const fill = linear(ctx, "hot", cx - a, 0, cx + a, 0, [
    [0, c.primary, 0.15],
    [0.42, c.primary, 0.85],
    [0.52, c.accent, 1],
    [0.62, c.primary, 0.85],
    [1, c.primary, 0.15],
  ]);
  const out: string[] = [];
  const plane = (i: number) => {
    const y = top + i * gap;
    const quad: [number, number][] = [
      [cx - a, y],
      [cx, y - b],
      [cx + a, y],
      [cx, y + b],
    ];
    const isHot = i === hot;
    const parts: string[] = [];
    if (isHot) parts.push(`<g filter="${glow}"><polygon points="${pts(quad)}" fill="${fill}" opacity="0.9"/></g>`);
    parts.push(
      `<polygon points="${pts(quad)}" fill="${isHot ? fill : c.bg}" fill-opacity="${isHot ? 0.9 : 0.45}" stroke="${line}" stroke-opacity="${isHot ? 0.95 : 0.8}"/>`,
    );
    // Hatching parallel to one edge.
    const hatch: string[] = [];
    const k = isHot ? 9 : 6;
    for (let j = 1; j < k; j++) {
      const t = j / k;
      hatch.push(`<line x1="${n(cx - a + a * t)}" y1="${n(y - b * t)}" x2="${n(cx + a * t)}" y2="${n(y + b - b * t)}"/>`);
    }
    parts.push(`<g stroke="${line}" stroke-opacity="${isHot ? 0.55 : 0.35}">${hatch.join("")}</g>`);
    return parts.join("");
  };
  for (let i = planes - 1; i >= 0; i--) if (i !== hot) out.push(plane(i));
  out.push(plane(hot));
  // A dashed vertical axis threading the stack.
  out.push(
    `<line x1="${n(cx - a * 0.7)}" y1="${n(top - b * 1.6)}" x2="${n(cx - a * 0.7)}" y2="${n(top + (planes - 1) * gap + b * 1.6)}" stroke="${line}" stroke-opacity="0.5" stroke-dasharray="${n(s * 0.01)} ${n(s * 0.012)}"/>`,
  );
  return `<g stroke-width="1.15" vector-effect="non-scaling-stroke" data-crisp="1">${out.join("").replace(/<(polygon|line)\b/g, '<$1 vector-effect="non-scaling-stroke"')}</g>`;
}

function polygon(cx: number, cy: number, radius: number, sides: number, rot: number): [number, number][] {
  return Array.from({ length: sides }, (_, i) => {
    const t = rot + (i / sides) * Math.PI * 2;
    return [cx + Math.cos(t) * radius, cy + Math.sin(t) * radius] as [number, number];
  });
}

function stripes(ctx: Ctx): string {
  const { w, h, s, c, r } = ctx;
  const sides = r.pick([6, 6, 6, 8, 4, 3]);
  const cx = w / 2;
  const cy = h / 2;
  const outer = s * 0.4;
  const rings = r.int(6, 8);
  const band = (outer * 0.55) / rings;
  const rot = sides === 4 ? Math.PI / 4 : -Math.PI / 2 + (sides % 2 ? 0 : Math.PI / sides);
  const grad = linear(ctx, "sg", 0, cy - outer, 0, cy + outer, [
    [0, ctx.dark ? (c.bg === c.light ? c.primary : "#FFFFFF") : c.light, 1],
    [0.45, c.primary, 1],
    [0.7, c.secondary === c.accent ? c.light : c.secondary, 1],
    [1, c.accent, 1],
  ]);
  const glow = blurFilter(ctx, "glow", n(s * 0.025));
  const rings_ = Array.from({ length: rings }, (_, i) => {
    const rad = outer - i * band * 1.0;
    return `<polygon points="${pts(polygon(cx, cy, rad, sides, rot))}"/>`;
  }).join("");
  return [
    `<g filter="${glow}" opacity="0.45" fill="none" stroke="${grad}" stroke-width="${n(band * 0.8)}" stroke-linejoin="round">${rings_}</g>`,
    `<g fill="none" stroke="${grad}" stroke-width="${n(band * 0.52)}" stroke-linejoin="round" data-crisp="1">${rings_}</g>`,
  ].join("");
}

function prism(ctx: Ctx): string {
  const { w, h, s, c, r } = ctx;
  const sides = r.pick([8, 9, 10, 12]);
  const cx = w / 2;
  const cy = h / 2;
  const rad = s * 0.38;
  const rot = r.range(0, Math.PI);
  const fill = radial(ctx, "pf", cx, cy, rad, [
    [0, ctx.dark ? "#FFFFFF" : c.bg, 1],
    [0.32, c.light, 1],
    [0.62, c.primary, 1],
    [0.88, c.accent, 1],
    [1, ctx.dark ? c.bg : c.accent, ctx.dark ? 1 : 0.85],
  ]);
  const ring = blurFilter(ctx, "ring", n(s * 0.03));
  const poly = pts(polygon(cx, cy, rad, sides, rot));
  return [
    `<g filter="${ring}"><polygon points="${pts(polygon(cx, cy, rad * 1.06, sides, rot))}" fill="${c.accent}" opacity="${ctx.dark ? 0.5 : 0.35}"/></g>`,
    `<g data-crisp="1"><polygon points="${poly}" fill="${fill}"/>`,
    `<polygon points="${pts(polygon(cx, cy, rad * 0.985, sides, rot))}" fill="none" stroke="#FFFFFF" stroke-opacity="${ctx.dark ? 0.12 : 0.35}" stroke-width="${n(s * 0.005)}"/></g>`,
  ].join("");
}

function star(ctx: Ctx): string {
  const { w, h, s, c, r } = ctx;
  const cx = w / 2;
  const cy = h * r.range(0.55, 0.62);
  const spikes = r.int(22, 30);
  const reach = s * 0.42;
  const grad = radial(ctx, "sg", cx, cy, reach, [
    [0, "#FFFFFF", 1],
    [0.25, c.light, 1],
    [0.7, c.primary, 0.9],
    [1, c.primary, 0.2],
  ]);
  const core = radial(ctx, "core", cx, cy, s * 0.14, [
    [0, "#FFFFFF", 1],
    [0.3, c.accent, 0.9],
    [1, c.accent, 0],
  ]);
  const glow = blurFilter(ctx, "glow", n(s * 0.01));
  const out: string[] = [];
  const arc = r.next() < 0.5 ? Math.PI : Math.PI * 0.62;
  for (let i = 0; i < spikes; i++) {
    const t = arc >= Math.PI ? i / spikes : i / (spikes - 1);
    const a = -Math.PI / 2 + (t * 2 - 1) * arc;
    const len = reach * (i % 2 ? r.range(0.55, 0.75) : r.range(0.85, 1));
    out.push(`<polygon points="${wedge(cx, cy, a, len, r.range(0.025, 0.05))}"/>`);
  }
  return [
    `<g filter="${glow}" fill="${grad}">${out.join("")}</g>`,
    `<g fill="${grad}" opacity="0.9" data-crisp="1">${out.join("")}</g>`,
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(s * 0.14)}" fill="${core}"/>`,
  ].join("");
}

function orb(ctx: Ctx): string {
  const { w, h, s, c, r } = ctx;
  const R = Math.max(w, h) * r.range(0.95, 1.15);
  const cx = -R * r.range(0.42, 0.55);
  const cy = h * r.range(0.65, 0.95);
  const sky = linear(ctx, "sky", 0, 0, w, 0, [
    [0, ctx.dark ? "#FFFFFF" : c.bg, 1],
    [0.45, c.light, 1],
    [1, c.primary, 1],
  ]);
  const wide = blurFilter(ctx, "wide", n(s * 0.08));
  const tight = blurFilter(ctx, "tight", n(s * 0.02));
  const disk = ctx.dark ? c.bg : c.ink;
  return [
    `<rect width="${w}" height="${h}" fill="${sky}"/>`,
    `<g filter="${wide}"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 1.02)}" fill="none" stroke="#FFFFFF" stroke-width="${n(s * 0.25)}" opacity="0.95"/></g>`,
    `<g filter="${tight}"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R)}" fill="${c.accent}"/></g>`,
    `<g filter="${tight}"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.975)}" fill="${disk}"/></g>`,
  ].join("");
}

function grid(ctx: Ctx): string {
  const { w, h, s, c, r } = ctx;
  const cols = 14;
  const rows = Math.max(4, Math.round((cols * h) / w));
  const cw = w / cols;
  const rh = h / rows;
  const line = ctx.dark ? c.ink : c.ink;
  const lines: string[] = [];
  for (let i = 1; i < cols; i++) lines.push(`<line x1="${n(i * cw)}" y1="0" x2="${n(i * cw)}" y2="${h}"/>`);
  for (let j = 1; j < rows; j++) lines.push(`<line x1="0" y1="${n(j * rh)}" x2="${w}" y2="${n(j * rh)}"/>`);
  const glow = blurFilter(ctx, "glow", n(s * 0.03));
  const cells: string[] = [];
  const count = r.int(5, 7);
  for (let k = 0; k < count; k++) {
    const cwN = r.pick([1, 1, 1, 2]);
    const chN = cwN === 1 ? r.pick([1, 2]) : 1;
    const x = r.int(0, cols - cwN) * cw;
    const y = r.int(0, rows - chN) * rh;
    cells.push(
      `<rect x="${n(x + cw * 0.06)}" y="${n(y + rh * 0.06)}" width="${n(cwN * cw - cw * 0.12)}" height="${n(chN * rh - rh * 0.12)}" rx="${n(s * 0.006)}"/>`,
    );
  }
  const fill = ctx.dark ? (c.secondary === c.accent ? c.light : c.secondary) : c.primary;
  return [
    `<g stroke="${line}" stroke-opacity="${ctx.dark ? 0.3 : 0.2}" stroke-width="1" data-crisp="1">${lines.join("").replace(/<line\b/g, '<line vector-effect="non-scaling-stroke"')}</g>`,
    `<g data-crisp="1"><g filter="${glow}" fill="${fill}" opacity="0.95">${cells.join("")}</g><g fill="${fill}" opacity="0.9">${cells.join("")}</g></g>`,
  ].join("");
}

function haze(ctx: Ctx): string {
  const { w, h, s, c, r } = ctx;
  const pool = [c.light, c.primary, c.secondary, c.light, c.accent];
  const soft = blurFilter(ctx, "soft", n(s * 0.16));
  const orbs = Array.from({ length: r.int(4, 5) }, (_, i) => {
    const color = pool[i % pool.length]!;
    const big = Math.max(w, h);
    return `<circle cx="${n(r.range(0, w))}" cy="${n(r.range(0, h))}" r="${n(r.range(0.2, i === 0 ? 0.5 : 0.36) * big)}" fill="${color}" opacity="${o(i === 4 ? 0.4 : r.range(0.6, 0.9))}"/>`;
  });
  return `<g filter="${soft}">${orbs.join("")}</g>`;
}

function bands(ctx: Ctx): string {
  const { w, h, c, r } = ctx;
  // The accent appears in a single band at most: a signal, not a stripe pattern.
  const pool = [c.primary, c.light, c.secondary, c.bg, c.light];
  const rows = r.int(7, 11);
  const spark = r.int(Math.floor(rows / 2), rows - 2);
  const soft = blurFilter(ctx, "soft", `${n(w * 0.06)} ${n(h * 0.012)}`);
  const out = Array.from({ length: rows }, (_, i) => {
    const y = (h / rows) * i - h * 0.05;
    const accent = i === spark;
    const color = accent ? c.accent : r.pick(pool);
    const op = accent ? r.range(0.5, 0.75) : r.range(0.45, 0.95);
    return `<rect x="${n(-w * 0.1)}" y="${n(y)}" width="${n(w * 1.2)}" height="${n((h / rows) * (accent ? r.range(0.5, 0.9) : r.range(0.8, 1.7)))}" fill="${color}" opacity="${o(op)}"/>`;
  });
  return `<g filter="${soft}">${out.join("")}</g>`;
}

const GENERATORS: Record<ArtStyle, (ctx: Ctx) => string> = {
  burst,
  converge,
  diverge,
  swirl,
  flow,
  strata,
  stripes,
  prism,
  star,
  orb,
  grid,
  haze,
  bands,
};

/** Styles that are line art: grain is applied only to their soft parts. */
const CRISP: ReadonlySet<ArtStyle> = new Set(["flow", "strata", "stripes", "star", "grid"]);

export interface RenderArtOptions {
  width?: number;
  height?: number;
  /** 0 = none, 1 = default spray grain, up to 2. */
  grain?: number;
  /** Paint the background (default true). Off for artwork laid over imagery. */
  background?: boolean;
}

/** Render an artwork spec to a standalone SVG document. */
export function renderArt(spec: ArtSpec, colors: ArtColors, opts: RenderArtOptions = {}): string {
  const w = Math.round(opts.width ?? 1600);
  const h = Math.round(opts.height ?? 1000);
  const ctx: Ctx = {
    w,
    h,
    s: Math.min(w, h),
    c: colors,
    r: rng(hash(`${spec.style}:${spec.seed}`)),
    dark: luminance(colors.bg) < 0.2,
    defs: [],
  };
  const grain = Math.max(0, Math.min(2, opts.grain ?? 1));
  const body = GENERATORS[spec.style](ctx);
  if (grain > 0) grainFilter(ctx, grain);

  let content = body;
  if (grain > 0) {
    if (CRISP.has(spec.style)) {
      // Keep line art sharp; spray only the soft, blurred layers.
      const at = body.search(/<g[^>]*data-crisp="1"/);
      const cut = at < 0 ? body.length : at;
      content = `<g filter="url(#spray)">${body.slice(0, cut)}</g>${body.slice(cut)}`;
    } else {
      content = `<g filter="url(#spray)">${body}</g>`;
    }
  }
  const speckle =
    grain > 0 ? `<rect width="${w}" height="${h}" fill="${ctx.dark ? "#FFFFFF" : colors.ink}" opacity="${o(0.08 * grain)}" filter="url(#speckle)"/>` : "";
  const bg = opts.background === false ? "" : `<rect width="${w}" height="${h}" fill="${colors.bg}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"><defs>${ctx.defs.join("")}</defs>${bg}${content}${speckle}</svg>`;
}

/** Heuristic: pick an art style from free-text (used by the offline image generator). */
export function artStyleFromPrompt(prompt: string): ArtStyle {
  const p = prompt.toLowerCase();
  const rules: [RegExp, ArtStyle][] = [
    [/burst|explo|radial|supernova|bloom/, "burst"],
    [/converg|captur|funnel in|focus/, "converge"],
    [/diverg|resum|emerg|release|fan out/, "diverge"],
    [/swirl|vortex|spiral|wave|ribbon/, "swirl"],
    [/flow|line art|lines|channel|pipeline|conduit/, "flow"],
    [/strata|layer|stack|plane|isometric/, "strata"],
    [/stripe|hexagon|emblem|badge/, "stripes"],
    [/prism|polygon|facet|gem|crystal/, "prism"],
    [/star|spark|spike|sun/, "star"],
    [/orb|planet|horizon arc|eclipse|rim/, "orb"],
    [/grid|pattern|cell|pixel|matrix/, "grid"],
    [/streak|motion|band|horizon|speed/, "bands"],
  ];
  for (const [re, style] of rules) if (re.test(p)) return style;
  return "haze";
}
