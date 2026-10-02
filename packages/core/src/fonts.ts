/**
 * A curated Google Fonts catalog the agent can choose from. Kept small and
 * opinionated: every family here is high quality, has the weights we need,
 * and loads from fonts.googleapis.com.
 */

export type FontCategory = "serif" | "sans" | "mono" | "display";

export interface CatalogFont {
  family: string;
  category: FontCategory;
  weights: number[];
  italic: boolean;
  fallback: string;
  mood: string[];
}

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

export const FONT_CATALOG: CatalogFont[] = [
  { family: "Fraunces", category: "serif", weights: [300, 400, 500, 600], italic: true, fallback: SERIF, mood: ["warm", "editorial", "soft", "literary"] },
  { family: "Instrument Serif", category: "serif", weights: [400], italic: true, fallback: SERIF, mood: ["elegant", "editorial", "fashion", "condensed"] },
  { family: "PT Serif", category: "serif", weights: [400, 700], italic: true, fallback: SERIF, mood: ["classic", "trustworthy", "institutional"] },
  { family: "Newsreader", category: "serif", weights: [300, 400, 500, 600], italic: true, fallback: SERIF, mood: ["editorial", "news", "calm", "readable"] },
  { family: "Cormorant Garamond", category: "serif", weights: [300, 400, 500, 600], italic: true, fallback: SERIF, mood: ["luxury", "delicate", "heritage"] },
  { family: "Source Serif 4", category: "serif", weights: [300, 400, 600], italic: true, fallback: SERIF, mood: ["neutral", "readable", "technical"] },
  { family: "Libre Caslon Text", category: "serif", weights: [400, 700], italic: false, fallback: SERIF, mood: ["heritage", "bookish", "crafted"] },
  { family: "DM Serif Display", category: "serif", weights: [400], italic: true, fallback: SERIF, mood: ["bold", "high-contrast", "headline"] },
  {
    family: "Playfair Display",
    category: "serif",
    weights: [400, 500, 600, 700],
    italic: true,
    fallback: SERIF,
    mood: ["dramatic", "fashion", "high-contrast"],
  },
  { family: "Gloock", category: "serif", weights: [400], italic: false, fallback: SERIF, mood: ["confident", "editorial", "sharp"] },
  { family: "Inter", category: "sans", weights: [300, 400, 500, 600, 700], italic: true, fallback: SANS, mood: ["neutral", "product", "ui", "clean"] },
  { family: "Inter Tight", category: "sans", weights: [400, 500, 600, 700], italic: true, fallback: SANS, mood: ["tight", "headline", "modern"] },
  { family: "Geist", category: "sans", weights: [300, 400, 500, 600], italic: false, fallback: SANS, mood: ["technical", "developer", "precise"] },
  { family: "DM Sans", category: "sans", weights: [400, 500, 700], italic: true, fallback: SANS, mood: ["friendly", "geometric", "soft"] },
  { family: "Manrope", category: "sans", weights: [300, 400, 500, 600, 700], italic: false, fallback: SANS, mood: ["modern", "fintech", "open"] },
  { family: "Plus Jakarta Sans", category: "sans", weights: [400, 500, 600, 700], italic: true, fallback: SANS, mood: ["contemporary", "startup", "warm"] },
  { family: "Hanken Grotesk", category: "sans", weights: [300, 400, 500, 600], italic: true, fallback: SANS, mood: ["grotesk", "editorial", "neutral"] },
  { family: "Schibsted Grotesk", category: "sans", weights: [400, 500, 600, 700], italic: true, fallback: SANS, mood: ["news", "grotesk", "sturdy"] },
  { family: "Space Grotesk", category: "sans", weights: [300, 400, 500, 700], italic: false, fallback: SANS, mood: ["quirky", "tech", "geometric"] },
  { family: "Archivo", category: "sans", weights: [400, 500, 600, 700, 800, 900], italic: true, fallback: SANS, mood: ["industrial", "bold", "poster"] },
  { family: "Archivo Black", category: "display", weights: [400], italic: false, fallback: SANS, mood: ["heavy", "poster", "loud", "brutalist"] },
  { family: "Syne", category: "display", weights: [400, 500, 600, 700, 800], italic: false, fallback: SANS, mood: ["art", "expressive", "gallery"] },
  { family: "Unbounded", category: "display", weights: [400, 600, 800], italic: false, fallback: SANS, mood: ["wide", "futuristic", "playful"] },
  { family: "JetBrains Mono", category: "mono", weights: [400, 500, 700], italic: true, fallback: MONO, mood: ["code", "technical", "developer"] },
  { family: "IBM Plex Mono", category: "mono", weights: [400, 500, 600], italic: true, fallback: MONO, mood: ["corporate", "technical", "archival"] },
  { family: "Space Mono", category: "mono", weights: [400, 700], italic: true, fallback: MONO, mood: ["retro", "label", "brutalist"] },
];

export interface TypePairing {
  name: string;
  display: string;
  text: string;
  mono?: string;
  rationale: string;
  mood: string[];
}

export const TYPE_PAIRINGS: TypePairing[] = [
  {
    name: "Painterly editorial",
    display: "PT Serif",
    text: "DM Sans",
    rationale: "A sturdy, humane serif for headlines with a soft geometric sans for UI and captions — calm and trustworthy.",
    mood: ["calm", "trustworthy", "editorial", "warm"],
  },
  {
    name: "Modern literary",
    display: "Fraunces",
    text: "Inter",
    mono: "JetBrains Mono",
    rationale: "Fraunces' soft optical axis adds warmth to large sizes; Inter keeps product surfaces crisp.",
    mood: ["warm", "product", "friendly"],
  },
  {
    name: "Fintech precision",
    display: "Newsreader",
    text: "Manrope",
    mono: "IBM Plex Mono",
    rationale: "Light serif headlines over an open sans — the Stripe / Sequence pattern of editorial authority on clean data.",
    mood: ["fintech", "trustworthy", "precise"],
  },
  {
    name: "Fashion contrast",
    display: "Instrument Serif",
    text: "Inter Tight",
    rationale: "A condensed, elegant serif against a tight grotesk creates magazine-cover tension.",
    mood: ["fashion", "elegant", "luxury"],
  },
  {
    name: "Developer calm",
    display: "Geist",
    text: "Geist",
    mono: "JetBrains Mono",
    rationale: "A single superfamily keeps things quiet and systematic; hierarchy comes from size and weight only.",
    mood: ["technical", "developer", "minimal"],
  },
  {
    name: "Poster brutalism",
    display: "Archivo Black",
    text: "Space Mono",
    rationale: "A heavy grotesk with monospaced labelling — archival, botanical-catalogue energy (Phytoca-style).",
    mood: ["bold", "brutalist", "art", "loud"],
  },
  {
    name: "Heritage craft",
    display: "Cormorant Garamond",
    text: "Hanken Grotesk",
    rationale: "Old-style refinement balanced by a neutral grotesk for wayfinding and body copy.",
    mood: ["heritage", "luxury", "crafted"],
  },
  {
    name: "Gallery expressive",
    display: "Syne",
    text: "DM Sans",
    rationale: "Syne's quirky widths give a gallery voice; DM Sans keeps reading comfortable.",
    mood: ["art", "expressive", "playful"],
  },
];

export function findCatalogFont(family: string): CatalogFont | undefined {
  return FONT_CATALOG.find((f) => f.family.toLowerCase() === family.toLowerCase());
}

export function suggestPairings(keywords: string[]): TypePairing[] {
  const kw = keywords.map((k) => k.toLowerCase());
  if (!kw.length) return TYPE_PAIRINGS;
  return [...TYPE_PAIRINGS]
    .map((p) => ({ p, score: p.mood.filter((m) => kw.some((k) => m.includes(k) || k.includes(m))).length }))
    .sort((a, b) => b.score - a.score)
    .map(({ p }) => p);
}

/** Google Fonts CSS2 URL for a set of families. */
export function googleFontsHref(fonts: { family: string; weights: number[]; italic?: boolean }[]): string | null {
  const params = fonts
    .filter((f) => f.family)
    .map((f) => {
      const weights = [...new Set(f.weights)].sort((a, b) => a - b);
      const fam = f.family.trim().replace(/ /g, "+");
      if (f.italic) {
        const tuples = [...weights.map((w) => `0,${w}`), ...weights.map((w) => `1,${w}`)].join(";");
        return `family=${fam}:ital,wght@${tuples}`;
      }
      return `family=${fam}:wght@${weights.join(";")}`;
    });
  if (!params.length) return null;
  return `https://fonts.googleapis.com/css2?${[...new Set(params)].join("&")}&display=swap`;
}
