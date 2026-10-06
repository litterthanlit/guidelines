import type { SlotSpec } from "./layouts";
import { BOARD_COLUMNS, type Brand, type TileKind, type TileTone } from "./schema";

/**
 * Brand-board tiles. Each kind is a small composition with its own slots, the
 * way page layouts are. Boards place tiles on a 12-column grid.
 */

export interface TileSpec {
  kind: TileKind;
  name: string;
  description: string;
  /** Default footprint in grid columns × rows. */
  size: { w: number; h: number };
  tones: TileTone[];
  slots: SlotSpec[];
}

const artSlot: SlotSpec = {
  key: "art",
  kind: "art",
  label: "Artwork",
  hint: 'Procedural artwork "style:seed", e.g. "burst:3". See ART_STYLES. Ignored when an image is set.',
};
const imageSlot: SlotSpec = { key: "image", kind: "asset", label: "Image", hint: "An asset id; overrides the artwork." };
const markStyle: SlotSpec = {
  key: "markStyle",
  kind: "option",
  label: "Mark fill",
  hint: "How the logomark is filled: solid ink, parallel stripes, or a primary→accent gradient.",
  options: ["solid", "stripes", "gradient"],
};

export const TILES: Record<TileKind, TileSpec> = {
  logo: {
    kind: "logo",
    name: "Logo",
    description:
      "The lockup (or mark, or wordmark) with an optional mono caption under a hairline. Put it on a dark tile for the reversed version, or over artwork for a logo orb.",
    size: { w: 3, h: 3 },
    tones: ["light", "dark", "panel", "brand", "clear"],
    slots: [
      { key: "show", kind: "option", label: "Show", options: ["lockup", "mark", "wordmark"] },
      { key: "align", kind: "option", label: "Align", options: ["center", "left", "bottom-right"] },
      { key: "size", kind: "option", label: "Size", options: ["s", "m", "l"] },
      markStyle,
      { key: "caption", kind: "lines", label: "Caption", hint: "Set in tracked mono caps, e.g. “Project memory / for coding agents”." },
      artSlot,
      imageSlot,
    ],
  },
  hero: {
    kind: "hero",
    name: "Hero",
    description:
      "A big display headline with a mono eyebrow and subhead over artwork. Optional numbered index list, corner notes and the mark placed in the artwork's focal point.",
    size: { w: 6, h: 6 },
    tones: ["light", "dark", "panel", "brand"],
    slots: [
      { key: "eyebrow", kind: "text", label: "Eyebrow", hint: "Tracked mono label followed by a short rule." },
      { key: "headline", kind: "richtext", label: "Headline", hint: "2–5 words. Line breaks are kept.", required: true },
      { key: "subhead", kind: "richtext", label: "Subhead", hint: "Set in mono." },
      { key: "subStyle", kind: "option", label: "Subhead style", hint: "copy = mono sentence case; label = small tracked caps.", options: ["copy", "label"] },
      { key: "align", kind: "option", label: "Align", options: ["top-left", "center", "bottom-left"] },
      { key: "size", kind: "option", label: "Headline size", options: ["m", "l", "xl"] },
      artSlot,
      imageSlot,
      { key: "mark", kind: "option", label: "Mark", hint: "center = in the artwork's focal point, or above a centered headline.", options: ["none", "center"] },
      { key: "fade", kind: "option", label: "Fade artwork", hint: "Fade the artwork out behind the text.", options: ["none", "top"] },
      { key: "index", kind: "lines", label: "Index list", hint: "One item per line; numbered automatically, set top-right." },
      { key: "noteLeft", kind: "lines", label: "Corner note (left)", hint: "Mono caps with a registration cross." },
      { key: "noteRight", kind: "lines", label: "Corner note (right)" },
      { key: "cta", kind: "text", label: "Button" },
    ],
  },
  art: {
    kind: "art",
    name: "Artwork",
    description: "A full-bleed artwork or image with an optional mono label and caption. Use for imagery, patterns and illustration.",
    size: { w: 3, h: 4 },
    tones: ["light", "dark", "panel", "brand", "clear"],
    slots: [
      artSlot,
      imageSlot,
      { key: "label", kind: "text", label: "Label", hint: "Tracked mono, top-left." },
      { key: "caption", kind: "text", label: "Caption", hint: "Bottom-left." },
      { key: "mark", kind: "option", label: "Mark", options: ["none", "center", "corner"] },
    ],
  },
  palette: {
    kind: "palette",
    name: "Palette",
    description: "Brand swatches with hex codes, optionally with names and the traits each color stands for, and a lockup header.",
    size: { w: 3, h: 3 },
    tones: ["light", "dark", "panel", "clear"],
    slots: [
      { key: "label", kind: "text", label: "Label", hint: "Defaults to “Palette”." },
      { key: "style", kind: "option", label: "Style", options: ["chips", "columns"] },
      { key: "colors", kind: "text", label: "Colors", hint: "Comma separated color ids, in order. Defaults to all (max 6)." },
      { key: "header", kind: "option", label: "Header", options: ["label", "lockup"] },
      { key: "caption", kind: "lines", label: "Caption", hint: "Under the lockup header." },
    ],
  },
  type: {
    kind: "type",
    name: "Type specimen",
    description: "A large “AaBb” sample with the family name, weights and character set.",
    size: { w: 3, h: 4 },
    tones: ["light", "dark", "panel", "clear"],
    slots: [
      { key: "font", kind: "option", label: "Font role", options: ["display", "text", "mono"] },
      { key: "sample", kind: "text", label: "Sample", hint: "Defaults to “AaBb”." },
      { key: "detail", kind: "option", label: "Detail", options: ["full", "compact"] },
    ],
  },
  steps: {
    kind: "steps",
    name: "Process steps",
    description:
      "A 2–4 step story, each with artwork, a title and a one-line description. Variants: sequence (arrows between), columns (numbered, divided), cards (numbered cards with art on dark).",
    size: { w: 6, h: 4 },
    tones: ["light", "dark", "panel", "clear"],
    slots: [
      { key: "label", kind: "text", label: "Label", hint: "Tracked mono header with a rule." },
      { key: "items", kind: "lines", label: "Steps", hint: "One per line: “Title — description”.", required: true },
      { key: "arts", kind: "arts", label: "Step artwork", hint: 'Comma separated, one per step: "converge:2, burst:5, diverge:1".' },
      { key: "variant", kind: "option", label: "Variant", options: ["sequence", "columns", "cards"] },
    ],
  },
  poster: {
    kind: "poster",
    name: "Poster",
    description: "A campaign poster: headline, mono subhead and button over artwork, with the lockup top or bottom.",
    size: { w: 3, h: 7 },
    tones: ["light", "dark", "brand"],
    slots: [
      { key: "headline", kind: "richtext", label: "Headline", required: true },
      { key: "subhead", kind: "richtext", label: "Subhead" },
      { key: "cta", kind: "text", label: "Button" },
      { key: "size", kind: "option", label: "Headline size", options: ["m", "l"] },
      { key: "logo", kind: "option", label: "Lockup", options: ["top", "bottom", "none"] },
      { key: "caption", kind: "lines", label: "Footer caption", hint: "Mono caps, bottom-right." },
      { key: "fade", kind: "option", label: "Fade artwork", hint: "Fade the artwork into the surface under the text.", options: ["top", "none"] },
      artSlot,
      imageSlot,
    ],
  },
  web: {
    kind: "web",
    name: "Web page",
    description:
      "The identity applied to a website: a landing hero with nav and button, or an index page with a large mark and link grid. Optional browser chrome.",
    size: { w: 4, h: 6 },
    tones: ["light", "dark", "panel"],
    slots: [
      { key: "variant", kind: "option", label: "Variant", options: ["landing", "index"] },
      { key: "chrome", kind: "option", label: "Browser chrome", options: ["none", "browser"] },
      { key: "nav", kind: "lines", label: "Nav links", hint: "One per line." },
      { key: "headline", kind: "richtext", label: "Headline" },
      { key: "subhead", kind: "text", label: "Subhead" },
      { key: "cta", kind: "text", label: "Button" },
      { key: "links", kind: "lines", label: "Link grid", hint: "Index variant: one link per line." },
      markStyle,
      artSlot,
      imageSlot,
    ],
  },
  text: {
    kind: "text",
    name: "Text",
    description: "A mono label, a display headline and a paragraph — manifesto lines, voice, principles.",
    size: { w: 3, h: 3 },
    tones: ["light", "dark", "panel", "brand", "clear"],
    slots: [
      { key: "eyebrow", kind: "text", label: "Eyebrow" },
      { key: "headline", kind: "richtext", label: "Headline" },
      { key: "body", kind: "richtext", label: "Body" },
    ],
  },
};

export const TILE_KINDS = Object.keys(TILES) as TileKind[];

/* ─────────────────────────────── templates ─────────────────────────────── */

export interface TileDraft {
  id?: string;
  kind: TileKind;
  x: number;
  y: number;
  w: number;
  h: number;
  tone?: TileTone;
  label?: string;
  slots?: Record<string, string>;
}

export interface BoardDraft {
  slots: Record<string, string>;
  tiles: TileDraft[];
}

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  build: (b: Brand) => BoardDraft;
}

const firstSentence = (s: string) => (s.match(/^[^.!?]*[.!?]/)?.[0] ?? s).trim();

/** Split a phrase into two balanced lines for stacked mono captions. */
export function twoLines(s: string): string {
  const words = s.replace(/[.]$/, "").split(/\s+/).filter(Boolean);
  if (words.length < 3) return words.join(" ");
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return `${words.slice(0, best).join(" ")}\n${words.slice(best).join(" ")}`;
}

function copy(b: Brand) {
  const name = b.meta.name;
  const tagline = b.meta.tagline || `${name} brand system`;
  const keywords = b.meta.keywords.length ? b.meta.keywords : b.meta.voice;
  return {
    name,
    tagline,
    caption: twoLines(tagline),
    eyebrow: keywords.slice(0, 2).join(" ") || "Brand system",
    headline: tagline.split(/\s+/).length <= 5 ? tagline : `${name},\nin focus.`,
    story: firstSentence(b.meta.story) || tagline,
  };
}

const DEFAULT_STEPS = "Capture — Ideas, decisions and progress.\nRemember — Preserved across every session.\nResume — Pick up exactly where you left off.";

export const BOARD_TEMPLATES: Record<string, BoardTemplate> = {
  overview: {
    id: "overview",
    name: "Overview",
    description:
      "Light editorial board with hairline rules: logo, swirl artwork and palette on the left; a big hero over a burst with a three-step sequence below; a reversed logo and a poster on the right.",
    build: (b): BoardDraft => {
      const c = copy(b);
      return {
        slots: { title: "Overview", aspect: "3:2", rows: "12", frame: "rules" },
        tiles: [
          { id: "logo", kind: "logo", x: 0, y: 0, w: 3, h: 3, tone: "light", slots: { show: "lockup", align: "left", size: "l", caption: c.caption } },
          { id: "swirl", kind: "art", x: 0, y: 3, w: 3, h: 6, tone: "light", slots: { art: "swirl:3" } },
          { id: "palette", kind: "palette", x: 0, y: 9, w: 3, h: 3, tone: "light", slots: { style: "chips" } },
          {
            id: "hero",
            kind: "hero",
            x: 3,
            y: 0,
            w: 6,
            h: 8,
            tone: "light",
            slots: { eyebrow: c.eyebrow, headline: c.headline, subhead: c.story, art: "burst:2", align: "top-left", size: "xl" },
          },
          {
            id: "steps",
            kind: "steps",
            x: 3,
            y: 8,
            w: 6,
            h: 4,
            tone: "light",
            slots: { label: `${c.name} in motion`, items: DEFAULT_STEPS, arts: "converge:2, burst:7, diverge:3", variant: "sequence" },
          },
          { id: "logo-dark", kind: "logo", x: 9, y: 0, w: 3, h: 5, tone: "dark", slots: { show: "lockup", align: "center", size: "l" } },
          {
            id: "poster",
            kind: "poster",
            x: 9,
            y: 5,
            w: 3,
            h: 7,
            tone: "light",
            slots: { headline: c.headline, subhead: c.tagline, cta: "Get started", logo: "top", fade: "top", art: "swirl:8" },
          },
        ],
      };
    },
  },
  system: {
    id: "system",
    name: "System",
    description:
      "Dark identity system: logo and type specimen, a line-art hero with an index list, a light palette card with color traits, numbered process columns, a landing page and a dark poster.",
    build: (b): BoardDraft => {
      const c = copy(b);
      const keywords = (b.meta.keywords.length ? b.meta.keywords : ["Ideas", "Experiments", "Trade-offs", "Decisions"]).slice(0, 5);
      return {
        slots: { title: "System", aspect: "3:2", rows: "12", frame: "tiles" },
        tiles: [
          { id: "logo", kind: "logo", x: 0, y: 0, w: 3, h: 2, tone: "dark", slots: { show: "lockup", align: "left", size: "l", caption: c.caption } },
          { id: "type", kind: "type", x: 0, y: 2, w: 3, h: 4, tone: "dark", slots: { font: "display", sample: "AaBb", detail: "full" } },
          {
            id: "hero",
            kind: "hero",
            x: 3,
            y: 0,
            w: 6,
            h: 6,
            tone: "dark",
            slots: {
              headline: c.headline,
              subhead: c.story,
              subStyle: "label",
              art: "flow:4",
              mark: "center",
              fade: "top",
              align: "top-left",
              size: "l",
              index: keywords.join("\n"),
              noteLeft: twoLines(b.meta.voice.slice(0, 3).join(" ") || "Clear by design"),
              noteRight: c.caption,
            },
          },
          { id: "palette", kind: "palette", x: 9, y: 0, w: 3, h: 6, tone: "light", slots: { style: "columns", header: "lockup", caption: c.caption } },
          {
            id: "steps",
            kind: "steps",
            x: 0,
            y: 6,
            w: 5,
            h: 6,
            tone: "dark",
            slots: { label: `The ${c.name} system`, items: DEFAULT_STEPS, arts: "strata:2, strata:5, flow:6", variant: "columns" },
          },
          {
            id: "web",
            kind: "web",
            x: 5,
            y: 6,
            w: 4,
            h: 6,
            tone: "light",
            slots: { variant: "landing", nav: "Product\nDocs\nAbout", headline: c.headline, subhead: c.tagline, cta: "Get started", art: "flow:9" },
          },
          {
            id: "poster",
            kind: "poster",
            x: 9,
            y: 6,
            w: 3,
            h: 6,
            tone: "dark",
            slots: { headline: c.headline, size: "l", logo: "bottom", caption: c.caption, art: "flow:12", fade: "none" },
          },
        ],
      };
    },
  },
  index: {
    id: "index",
    name: "Index",
    description:
      "Gallery sheet of labeled tiles: logo on dark, a logo orb, three numbered illustration cards, a type-led hero, a web index page with a striped mark, and a glowing grid pattern.",
    build: (b): BoardDraft => {
      const c = copy(b);
      return {
        slots: { title: "Index", aspect: "5:4", rows: "3", frame: "gallery" },
        tiles: [
          {
            id: "logo",
            kind: "logo",
            x: 0,
            y: 0,
            w: 6,
            h: 1,
            tone: "dark",
            label: "Logo",
            slots: { show: "lockup", align: "center", size: "l", markStyle: "stripes" },
          },
          {
            id: "orb",
            kind: "logo",
            x: 6,
            y: 0,
            w: 6,
            h: 1,
            tone: "light",
            label: "Logo orb",
            slots: { show: "lockup", align: "bottom-right", size: "s", art: "orb:2" },
          },
          {
            id: "illustrations",
            kind: "steps",
            x: 0,
            y: 1,
            w: 6,
            h: 1,
            tone: "panel",
            label: "Illustrations",
            slots: {
              items: (b.meta.keywords.length >= 3 ? b.meta.keywords.slice(0, 3) : ["Capture", "Preserve", "Continue"]).join("\n"),
              arts: "stripes:2, prism:2, star:3",
              variant: "cards",
            },
          },
          {
            id: "type",
            kind: "hero",
            x: 6,
            y: 1,
            w: 6,
            h: 1,
            tone: "dark",
            label: "Type",
            slots: { headline: c.headline, subhead: c.tagline, align: "center", size: "m", mark: "center" },
          },
          {
            id: "web",
            kind: "web",
            x: 0,
            y: 2,
            w: 6,
            h: 1,
            tone: "light",
            label: "Web",
            slots: {
              variant: "index",
              chrome: "browser",
              nav: "About\nProduct\nContact",
              links: "Brand overview\nLogo & mark\nColor system\nTypography\nImagery\nApplications",
              markStyle: "stripes",
            },
          },
          { id: "pattern", kind: "art", x: 6, y: 2, w: 6, h: 1, tone: "dark", label: "Pattern", slots: { art: "grid:3" } },
        ],
      };
    },
  },
};

export const BOARD_TEMPLATE_IDS = Object.keys(BOARD_TEMPLATES);

/* ─────────────────────────────── geometry ─────────────────────────────── */

export const boardRows = (slots: Record<string, string>) => {
  const n = Number(slots.rows);
  return Number.isInteger(n) && n >= 1 && n <= 24 ? n : 12;
};

export const boardAspect = (slots: Record<string, string>): [number, number] => {
  const m = /^(\d+):(\d+)$/.exec(slots.aspect ?? "");
  return m ? [Number(m[1]), Number(m[2])] : [3, 2];
};

/** [width, height] ratio of any page: boards choose theirs, every other page is 16:9. */
export const pageAspect = (page: { layout: string; slots: Record<string, string> }): [number, number] =>
  page.layout === "board" ? boardAspect(page.slots) : [16, 9];

/** Width ÷ height of a tile on a board, for drawing artwork at the right shape. */
export function tileAspect(board: Record<string, string>, t: { w: number; h: number }): number {
  const [aw, ah] = boardAspect(board);
  return ((t.w / BOARD_COLUMNS) * aw) / ((t.h / boardRows(board)) * ah);
}

type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** First free spot for a w×h tile, scanning rows top to bottom. */
export function findSpot(tiles: Rect[], w: number, h: number, rows: number): { x: number; y: number } | undefined {
  for (let y = 0; y + h <= rows; y++) {
    for (let x = 0; x + w <= BOARD_COLUMNS; x++) {
      if (!tiles.some((t) => overlaps(t, { x, y, w, h }))) return { x, y };
    }
  }
  return undefined;
}

/** Pairs of tile ids that overlap. */
export function tileOverlaps(tiles: (Rect & { id: string })[]): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) if (overlaps(tiles[i]!, tiles[j]!)) out.push([tiles[i]!.id, tiles[j]!.id]);
  return out;
}
