import { artStyleFromPrompt, parseArt, renderArt, type ArtColors } from "@guidelines/core";

/**
 * Image generation adapter. Providers, in auto-detect order:
 *   fal      — FAL_KEY        (Flux; default model fal-ai/flux/dev)
 *   openai   — OPENAI_API_KEY (gpt-image-1 by default)
 *   gradient — no key needed: on-palette procedural artwork (bursts, swirls,
 *              line flows, emblems, orbs, grids, haze, bands) as SVG.
 * Force one with GUIDELINES_IMAGE_PROVIDER=fal|openai|gradient.
 */

export type Aspect = "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
export type ProviderId = "fal" | "openai" | "gradient";

export interface GenerateRequest {
  prompt: string;
  aspect: Aspect;
  /** Brand colors, used by the gradient provider and appended as a hint for others. */
  palette: string[];
  /** Global imagery direction from the brand, prepended to the prompt. */
  style?: string;
  /** Role-mapped brand colors for procedural artwork. Derived from `palette` when absent. */
  colors?: ArtColors;
  /** Procedural artwork spec ("burst:3") for the offline provider. Picked from the prompt when absent. */
  art?: string;
}

export interface GeneratedImage {
  bytes: Uint8Array;
  ext: ".png" | ".jpg" | ".webp" | ".svg";
  width: number;
  height: number;
  provider: ProviderId;
  model: string;
}

const DIMENSIONS: Record<Aspect, [number, number]> = {
  "16:9": [1600, 900],
  "4:3": [1440, 1080],
  "1:1": [1200, 1200],
  "3:4": [1080, 1440],
  "9:16": [900, 1600],
};

export function resolveProvider(requested?: ProviderId): ProviderId {
  const forced = requested ?? (process.env.GUIDELINES_IMAGE_PROVIDER as ProviderId | undefined);
  if (forced) return forced;
  if (process.env.FAL_KEY) return "fal";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "gradient";
}

export function composePrompt(req: GenerateRequest): string {
  const parts = [req.prompt.trim()];
  if (req.style?.trim()) parts.push(`Art direction: ${req.style.trim()}`);
  if (req.palette.length) parts.push(`Color palette: ${req.palette.join(", ")}.`);
  parts.push("No text, no logos, no watermarks.");
  return parts.join("\n");
}

export async function generateImage(req: GenerateRequest, requested?: ProviderId): Promise<GeneratedImage> {
  const provider = resolveProvider(requested);
  switch (provider) {
    case "fal":
      return generateFal(req);
    case "openai":
      return generateOpenAI(req);
    case "gradient":
      return generateGradient(req);
  }
}

async function fetchBytes(url: string): Promise<{ bytes: Uint8Array; type: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  return { bytes: new Uint8Array(await res.arrayBuffer()), type: res.headers.get("content-type") ?? "" };
}

const extFor = (type: string): GeneratedImage["ext"] => (type.includes("jpeg") || type.includes("jpg") ? ".jpg" : type.includes("webp") ? ".webp" : ".png");

async function generateFal(req: GenerateRequest): Promise<GeneratedImage> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not set.");
  const model = process.env.FAL_MODEL ?? "fal-ai/flux/dev";
  const imageSize: Record<Aspect, string> = {
    "16:9": "landscape_16_9",
    "4:3": "landscape_4_3",
    "1:1": "square_hd",
    "3:4": "portrait_4_3",
    "9:16": "portrait_16_9",
  };
  const res = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: composePrompt(req), image_size: imageSize[req.aspect], num_images: 1, enable_safety_checker: true }),
  });
  if (!res.ok) throw new Error(`fal.ai error ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const json = (await res.json()) as { images?: { url: string; width?: number; height?: number; content_type?: string }[] };
  const img = json.images?.[0];
  if (!img) throw new Error("fal.ai returned no image.");
  const { bytes, type } = await fetchBytes(img.url);
  const [w, h] = DIMENSIONS[req.aspect];
  return { bytes, ext: extFor(img.content_type ?? type), width: img.width ?? w, height: img.height ?? h, provider: "fal", model };
}

async function generateOpenAI(req: GenerateRequest): Promise<GeneratedImage> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set.");
  const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
  const size: Record<Aspect, [string, number, number]> = {
    "16:9": ["1536x1024", 1536, 1024],
    "4:3": ["1536x1024", 1536, 1024],
    "1:1": ["1024x1024", 1024, 1024],
    "3:4": ["1024x1536", 1024, 1536],
    "9:16": ["1024x1536", 1024, 1536],
  };
  const [s, w, h] = size[req.aspect];
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: composePrompt(req), size: s, n: 1 }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
  const item = json.data?.[0];
  if (item?.b64_json) return { bytes: Buffer.from(item.b64_json, "base64"), ext: ".png", width: w, height: h, provider: "openai", model };
  if (item?.url) {
    const { bytes, type } = await fetchBytes(item.url);
    return { bytes, ext: extFor(type), width: w, height: h, provider: "openai", model };
  }
  throw new Error("OpenAI returned no image.");
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Best-effort role mapping for a bare palette list: first = primary, last = background. */
export function paletteColors(palette: string[]): ArtColors {
  const pal = palette.length ? palette : ["#7D93C9", "#C9D6EA", "#F3EFE6"];
  const bg = pal[pal.length - 1]!;
  const primary = pal[0]!;
  const secondary = pal[1] ?? primary;
  const light = pal[2] ?? secondary;
  const accent = pal.length > 3 ? pal[pal.length - 2]! : secondary;
  return { bg, ink: "#151515", primary, secondary, accent, light };
}

/**
 * Offline, deterministic, on-palette artwork. Uses `req.art` when given,
 * otherwise picks a style from the prompt ("burst", "swirl", "flow", "orb",
 * "grid", "streak"…) and seeds it from the prompt text.
 */
export function gradientSvg(req: GenerateRequest): string {
  const [width, height] = DIMENSIONS[req.aspect];
  const spec = parseArt(req.art) ?? { style: artStyleFromPrompt(req.prompt), seed: (hash(req.prompt + req.aspect) % 997) + 1 };
  return renderArt(spec, req.colors ?? paletteColors(req.palette), { width, height });
}

function generateGradient(req: GenerateRequest): GeneratedImage {
  const [w, h] = DIMENSIONS[req.aspect];
  return {
    bytes: new TextEncoder().encode(gradientSvg(req)),
    ext: ".svg",
    width: w,
    height: h,
    provider: "gradient",
    model: "guidelines-art-v1",
  };
}
