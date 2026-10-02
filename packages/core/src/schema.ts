import { z } from "zod";

/**
 * The brand document. One `brand.json` per brand project, shared by the MCP
 * server (agent) and the web studio (designer). Everything renders from this.
 */

export const SCHEMA_VERSION = 1;

export const Hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected a 6-digit hex color like #1A2B3C")
  .transform((v) => v.toUpperCase());

export const Slug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Lowercase letters, digits and dashes only");

export const Actor = z.enum(["agent", "designer", "system"]);
export type Actor = z.infer<typeof Actor>;

export const ColorRole = z.enum(["primary", "secondary", "accent", "neutral", "background", "text"]);
export type ColorRole = z.infer<typeof ColorRole>;

/** Tonal scale steps, Tailwind-style. */
export const SCALE_STEPS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const;
export type ScaleStep = (typeof SCALE_STEPS)[number];

export const Color = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hex: Hex,
  role: ColorRole,
  usage: z.string().default(""),
  /** Generated OKLCH tonal scale, keyed by step. */
  scale: z.record(z.string(), Hex).default({}),
});
export type Color = z.infer<typeof Color>;

export const FontSource = z.enum(["google", "system", "file"]);

export const Font = z.object({
  family: z.string().min(1),
  source: FontSource.default("google"),
  weights: z.array(z.number().int().min(100).max(900)).default([400]),
  italic: z.boolean().default(false),
  fallback: z.string().default("system-ui, sans-serif"),
  /** For `file` fonts: asset path relative to the brand folder. */
  file: z.string().optional(),
  usage: z.string().default(""),
});
export type Font = z.infer<typeof Font>;

export const TypeRole = z.enum(["display", "text", "mono"]);

export const TypeStyle = z.object({
  name: z.string().min(1),
  font: TypeRole,
  size: z.number().positive(),
  lineHeight: z.number().positive(),
  tracking: z.number().default(0),
  weight: z.number().int().min(100).max(900).default(400),
});
export type TypeStyle = z.infer<typeof TypeStyle>;

export const Typography = z.object({
  display: Font,
  text: Font,
  mono: Font.optional(),
  scale: z.array(TypeStyle).default([]),
});
export type Typography = z.infer<typeof Typography>;

export const Logo = z.object({
  wordmark: z.string().default(""),
  /** Sanitized SVG markup for the logomark (symbol). */
  markSvg: z.string().optional(),
  /** Clear space around the logo as a multiple of the mark height. */
  clearSpace: z.number().min(0).default(0.5),
  /** Minimum rendered height in px. */
  minSize: z.number().min(0).default(24),
  notes: z.string().default(""),
});
export type Logo = z.infer<typeof Logo>;

export const Asset = z.object({
  id: z.string().min(1),
  /** Path relative to the brand folder, e.g. `assets/cover.png`. */
  file: z.string().min(1),
  alt: z.string().default(""),
  caption: z.string().default(""),
  credit: z.string().default(""),
  prompt: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type Asset = z.infer<typeof Asset>;

export const Icon = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  svg: z.string().min(1),
});
export type Icon = z.infer<typeof Icon>;

export const LayoutId = z.enum([
  "cover",
  "statement",
  "logomark",
  "palette",
  "type-specimen",
  "imagery-grid",
  "application-mockup",
  "iconography-grid",
  "do-dont",
]);
export type LayoutId = z.infer<typeof LayoutId>;

export const Page = z.object({
  id: z.string().min(1),
  layout: LayoutId,
  /** Slot values. Text, asset ids (comma separated for lists), or options. */
  slots: z.record(z.string(), z.string()).default({}),
});
export type Page = z.infer<typeof Page>;

export const BoardItemKind = z.enum(["image", "swatch", "type", "note"]);

export const BoardItem = z.object({
  id: z.string().min(1),
  kind: BoardItemKind,
  /** Asset id (image), color id (swatch), or type role (type). */
  ref: z.string().optional(),
  text: z.string().default(""),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  z: z.number().int().default(0),
});
export type BoardItem = z.infer<typeof BoardItem>;

export const Meta = z.object({
  name: z.string().min(1),
  tagline: z.string().default(""),
  story: z.string().default(""),
  audience: z.string().default(""),
  voice: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
});
export type Meta = z.infer<typeof Meta>;

export const Brand = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  slug: Slug,
  rev: z.number().int().min(0).default(0),
  updatedAt: z.string().default(() => new Date(0).toISOString()),
  updatedBy: Actor.default("system"),
  /** Set when this revision restored an older one (undo chain). */
  restoredFrom: z.number().int().optional(),
  meta: Meta,
  logo: Logo.default({ wordmark: "", clearSpace: 0.5, minSize: 24, notes: "" }),
  colors: z.array(Color).default([]),
  typography: Typography.default({
    display: { family: "Fraunces", source: "google", weights: [400], italic: false, fallback: "Georgia, serif", usage: "" },
    text: { family: "Inter", source: "google", weights: [400, 500], italic: false, fallback: "system-ui, sans-serif", usage: "" },
    scale: [],
  }),
  imagery: z.object({ style: z.string().default(""), assets: z.array(Asset).default([]) }).default({ style: "", assets: [] }),
  icons: z.array(Icon).default([]),
  pages: z.array(Page).default([]),
  board: z.object({ items: z.array(BoardItem).default([]) }).default({ items: [] }),
});
export type Brand = z.infer<typeof Brand>;
export type BrandInput = z.input<typeof Brand>;

export function parseBrand(input: unknown): Brand {
  return Brand.parse(input);
}
