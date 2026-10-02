import type { LayoutId } from "./schema";

export type SlotKind =
  | "text" // single line
  | "richtext" // paragraphs, blank line separates paragraphs
  | "lines" // one item per line
  | "asset" // a single asset id
  | "assets" // comma separated asset ids
  | "option"; // one of `options`

export interface SlotSpec {
  key: string;
  kind: SlotKind;
  label: string;
  hint?: string;
  options?: string[];
  required?: boolean;
}

export interface LayoutSpec {
  id: LayoutId;
  name: string;
  description: string;
  /** Which brand data the layout reads besides its slots. */
  reads: string[];
  slots: SlotSpec[];
}

const title: SlotSpec = { key: "title", kind: "text", label: "Section title", required: true };
const body: SlotSpec = {
  key: "body",
  kind: "richtext",
  label: "Body copy",
  hint: "2–4 sentences explaining the rule and why it matters.",
};

export const LAYOUTS: Record<LayoutId, LayoutSpec> = {
  cover: {
    id: "cover",
    name: "Cover",
    description: "Full-bleed hero image with a large display-serif title set bottom-left. Use as page one.",
    reads: ["logo", "meta.name", "typography.display", "colors"],
    slots: [
      { key: "title", kind: "text", label: "Title", hint: "Usually “Brand Guidelines”.", required: true },
      { key: "subtitle", kind: "text", label: "Subtitle" },
      { key: "image", kind: "asset", label: "Hero image", hint: "Falls back to a palette gradient." },
    ],
  },
  statement: {
    id: "statement",
    name: "Statement",
    description: "A single centered serif statement floating on a soft, blurred palette gradient. For mission, positioning or chapter openers.",
    reads: ["colors", "typography.display"],
    slots: [
      { key: "eyebrow", kind: "text", label: "Eyebrow" },
      { key: "headline", kind: "text", label: "Headline", required: true },
      { key: "body", kind: "richtext", label: "Supporting copy" },
      { key: "tone", kind: "option", label: "Tone", options: ["light", "dark"] },
    ],
  },
  logomark: {
    id: "logomark",
    name: "Logomark",
    description: "The mark shown on a light and a dark panel side by side, with clear-space notes.",
    reads: ["logo", "colors"],
    slots: [title, body, { key: "show", kind: "option", label: "Show", options: ["mark", "lockup"] }],
  },
  palette: {
    id: "palette",
    name: "Color palette",
    description: "Tonal columns for each brand color with generated tints and shades and hex labels, plus contrast badges.",
    reads: ["colors"],
    slots: [title, body],
  },
  "type-specimen": {
    id: "type-specimen",
    name: "Type specimen",
    description: "Large family name, alphabet and numerals, plus the type scale.",
    reads: ["typography"],
    slots: [title, body, { key: "font", kind: "option", label: "Font role", options: ["display", "text", "mono"] }],
  },
  "imagery-grid": {
    id: "imagery-grid",
    name: "Imagery grid",
    description: "A grid of 1–6 brand images on a quiet panel, with optional captions.",
    reads: ["imagery"],
    slots: [title, body, { key: "images", kind: "assets", label: "Images", hint: "Comma separated asset ids (max 6)." }],
  },
  "application-mockup": {
    id: "application-mockup",
    name: "Application mockup",
    description: "Shows the identity applied: a billboard, a hanging banner, or a UI card floating on a gradient.",
    reads: ["logo", "colors", "typography"],
    slots: [
      title,
      body,
      { key: "variant", kind: "option", label: "Mockup", options: ["billboard", "banner", "card"] },
      { key: "image", kind: "asset", label: "Image" },
      { key: "headline", kind: "text", label: "Mockup headline" },
      { key: "cta", kind: "text", label: "Call to action" },
    ],
  },
  "iconography-grid": {
    id: "iconography-grid",
    name: "Iconography",
    description: "The brand icon set in soft tiles on a tinted field.",
    reads: ["icons", "colors"],
    slots: [title, body],
  },
  "do-dont": {
    id: "do-dont",
    name: "Do & don't",
    description: "Two columns of usage rules, optionally with an example image each.",
    reads: ["colors"],
    slots: [
      title,
      body,
      { key: "do", kind: "lines", label: "Do", hint: "One rule per line." },
      { key: "dont", kind: "lines", label: "Don't", hint: "One rule per line." },
      { key: "doImage", kind: "asset", label: "Do example" },
      { key: "dontImage", kind: "asset", label: "Don't example" },
    ],
  },
};

export const LAYOUT_IDS = Object.keys(LAYOUTS) as LayoutId[];

/** Section order used when scaffolding a new guideline. */
export const DEFAULT_SECTIONS: { layout: LayoutId; slots: Record<string, string> }[] = [
  { layout: "cover", slots: { title: "Brand Guidelines" } },
  { layout: "statement", slots: { eyebrow: "Our purpose", headline: "", tone: "light" } },
  { layout: "logomark", slots: { title: "Logomark", show: "mark" } },
  { layout: "palette", slots: { title: "Color palette" } },
  { layout: "type-specimen", slots: { title: "Primary font", font: "display" } },
  { layout: "type-specimen", slots: { title: "Secondary font", font: "text" } },
  { layout: "imagery-grid", slots: { title: "Brand imagery" } },
  { layout: "application-mockup", slots: { title: "Billboard", variant: "billboard" } },
];
