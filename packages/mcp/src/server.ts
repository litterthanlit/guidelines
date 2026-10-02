import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  applyOps,
  auditBrand,
  ColorRole,
  contrastReport,
  exportTokens,
  findCatalogFont,
  FONT_CATALOG,
  Hex,
  LAYOUTS,
  LayoutId,
  makeId,
  Op,
  primaryTextPair,
  proposePalettes,
  slugify,
  suggestPairings,
  summarizeBrand,
  TOKEN_FORMATS,
  TypeStyle,
  type Brand,
  type Font,
  type OpInput,
} from "@guidelines/core";
import { brandDir, createBrand, listBrands, mutateBrand, readBrand, saveAssetFile, undoBrand } from "@guidelines/core/store";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { generateImage, resolveProvider, type Aspect } from "./imagegen";
import { appUrl, renderPage } from "./render";

const INSTRUCTIONS = `Guidelines is a brand-guidelines studio. You co-design a brand with a designer who watches a live preview at ${appUrl()}/b/<slug>.

Workflow that produces the best results:
1. Interview first (use the brand_kickoff prompt): audience, 3–5 personality adjectives, references, what to avoid.
2. create_brand (scaffolds a cover → billboard page sequence).
3. Color: propose_palettes from a seed, discuss, then set_palette. Keep 4–6 core colors with clear roles. Body text on background must reach WCAG AA (4.5:1).
4. Type: propose_type_pairings / list_fonts, then set_typography with a type scale (Display, Heading, Body, Caption).
5. Logo: author a simple, geometric logomark as clean SVG (viewBox, no text, fill="currentColor") via set_logo.
6. Imagery: set an art direction in update_meta/set_imagery_style, then generate_image and place results with placeOn.
7. Fill page copy with update_page — short, confident, 2–4 sentences per page.
8. render_preview to look at pages, audit_brand to catch issues, iterate.

Always pass expectedRev from your last read when editing; on a conflict, re-read with get_brand (the designer may have edited) and merge rather than overwrite.`;

type Json = Record<string, unknown> | unknown[];

const ok = (data: Json | string, extra?: CallToolResult["content"]): CallToolResult => ({
  content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }, ...(extra ?? [])],
});

function fail(err: unknown): CallToolResult {
  let message = err instanceof Error ? err.message : String(err);
  if (err instanceof z.ZodError) {
    message = `Invalid input: ${err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`;
  }
  return { isError: true, content: [{ type: "text", text: message }] };
}

const safe =
  <A>(fn: (args: A) => Promise<CallToolResult>) =>
  async (args: A): Promise<CallToolResult> => {
    try {
      return await fn(args);
    } catch (err) {
      return fail(err);
    }
  };

const slugArg = z.string().describe('Brand slug, e.g. "meridian"');
const revArg = z.number().int().optional().describe("Rev from your last read. Rejects the write if the brand changed since.");

const FontArg = z.object({
  family: z.string().describe('Font family name, e.g. "Fraunces" (see list_fonts)'),
  weights: z.array(z.number().int()).optional(),
  italic: z.boolean().optional(),
  source: z.enum(["google", "system", "file"]).optional(),
  fallback: z.string().optional(),
  usage: z.string().optional(),
});

function toFont(arg: z.infer<typeof FontArg>): Font {
  const cat = findCatalogFont(arg.family);
  return {
    family: cat?.family ?? arg.family,
    source: arg.source ?? "google",
    weights: arg.weights ?? cat?.weights.filter((w) => w >= 300 && w <= 700) ?? [400],
    italic: arg.italic ?? false,
    fallback: arg.fallback ?? cat?.fallback ?? "system-ui, sans-serif",
    usage: arg.usage ?? "",
  };
}

async function edit(slug: string, ops: OpInput[], expectedRev?: number, summary?: string) {
  const b = await mutateBrand(slug, ops, { actor: "agent", expectedRev, summary });
  return b;
}

const changed = (b: Brand, note: string, extra: Record<string, unknown> = {}) =>
  ok({ ok: true, rev: b.rev, note, preview: `${appUrl()}/b/${b.slug}`, ...extra });

export function createServer(): McpServer {
  const server = new McpServer({ name: "guidelines", version: "0.1.0" }, { instructions: INSTRUCTIONS });

  // ───────────────────────────── Read ─────────────────────────────

  server.registerTool(
    "list_brands",
    { title: "List brands", description: "List brand projects in the studio.", inputSchema: {}, annotations: { readOnlyHint: true } },
    safe(async () => ok({ brands: await listBrands(), studio: appUrl() })),
  );

  server.registerTool(
    "get_brand",
    {
      title: "Get brand",
      description: "Read a brand. Returns a compact summary (colors, type, pages, slots) plus `rev`. Pass full=true for the raw document.",
      inputSchema: { slug: slugArg, full: z.boolean().optional() },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ slug, full }) => {
      const b = await readBrand(slug);
      return ok(full ? b : summarizeBrand(b));
    }),
  );

  server.registerTool(
    "get_page",
    {
      title: "Get page",
      description: "Read one page with its layout's slot spec, so you know which slots to fill.",
      inputSchema: { slug: slugArg, pageId: z.string() },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ slug, pageId }) => {
      const b = await readBrand(slug);
      const page = b.pages.find((p) => p.id === pageId);
      if (!page) throw new Error(`No page "${pageId}". Pages: ${b.pages.map((p) => p.id).join(", ")}`);
      return ok({ rev: b.rev, index: b.pages.indexOf(page) + 1, page, layout: LAYOUTS[page.layout] });
    }),
  );

  server.registerTool(
    "list_layouts",
    {
      title: "List page layouts",
      description: "All page layouts with their slots. Slots of kind asset/assets take asset ids; option slots take one of `options`.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    safe(async () => ok(Object.values(LAYOUTS))),
  );

  server.registerTool(
    "list_fonts",
    {
      title: "List fonts",
      description: "Curated Google Fonts catalog with categories and moods. Prefer these; any Google Font family name also works.",
      inputSchema: {
        category: z.enum(["serif", "sans", "mono", "display"]).optional(),
        mood: z.string().optional().describe("Filter by mood keyword, e.g. editorial, technical, luxury"),
      },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ category, mood }) =>
      ok(FONT_CATALOG.filter((f) => (!category || f.category === category) && (!mood || f.mood.some((m) => m.includes(mood.toLowerCase()))))),
    ),
  );

  // ─────────────────────────── Create & edit ───────────────────────────

  server.registerTool(
    "create_brand",
    {
      title: "Create brand",
      description: "Start a new brand project. By default scaffolds a full guideline page sequence to fill in.",
      inputSchema: {
        name: z.string(),
        slug: z.string().optional().describe("Defaults to a slug of the name"),
        tagline: z.string().optional(),
        story: z.string().optional().describe("2–4 sentences: what the brand does and why it exists"),
        audience: z.string().optional(),
        voice: z.array(z.string()).optional().describe("3–5 voice/personality attributes"),
        keywords: z.array(z.string()).optional().describe("Mood keywords used for type and imagery suggestions"),
        scaffold: z.boolean().optional().describe("Add default sections (default true)"),
      },
    },
    safe(async (a) => {
      const slug = a.slug ? slugify(a.slug) : slugify(a.name);
      const created = await createBrand(
        {
          slug,
          meta: { name: a.name, tagline: a.tagline ?? "", story: a.story ?? "", audience: a.audience ?? "", voice: a.voice ?? [], keywords: a.keywords ?? [] },
          logo: { wordmark: a.name, clearSpace: 0.5, minSize: 24, notes: "" },
        },
        "agent",
      );
      const b = a.scaffold === false ? created : await edit(slug, [{ type: "scaffoldPages" }], created.rev, "Scaffolded default sections");
      return ok({ ok: true, slug, rev: b.rev, preview: `${appUrl()}/b/${slug}`, pages: summarizeBrand(b).pages });
    }),
  );

  server.registerTool(
    "update_meta",
    {
      title: "Update brand meta",
      description: "Update name, tagline, story, audience, voice attributes or keywords.",
      inputSchema: {
        slug: slugArg,
        name: z.string().optional(),
        tagline: z.string().optional(),
        story: z.string().optional(),
        audience: z.string().optional(),
        voice: z.array(z.string()).optional(),
        keywords: z.array(z.string()).optional(),
        expectedRev: revArg,
      },
    },
    safe(async ({ slug, expectedRev, ...patch }) => changed(await edit(slug, [{ type: "updateMeta", patch }], expectedRev), "Meta updated")),
  );

  server.registerTool(
    "propose_palettes",
    {
      title: "Propose palettes",
      description:
        "Generate 4 palette directions from a seed color (monochrome+signal, analogous, complementary, dusk). Each includes roles and a body-text contrast check.",
      inputSchema: { seed: z.string().describe("Seed hex, e.g. #7D93C9") },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ seed }) => {
      const props = proposePalettes(Hex.parse(seed));
      return ok(
        props.map((p) => {
          const pair = primaryTextPair(p.colors);
          return { ...p, bodyText: pair ? `${pair.ratio}:1 ${pair.level}` : "n/a" };
        }),
      );
    }),
  );

  const ColorArg = z.object({
    name: z.string(),
    hex: z.string().describe("#RRGGBB"),
    role: ColorRole,
    usage: z.string().optional().describe("When to use it, e.g. 'Primary surfaces and hero backgrounds'"),
    id: z.string().optional(),
  });

  server.registerTool(
    "set_palette",
    {
      title: "Set palette",
      description:
        "Set brand colors. Tonal 50–950 scales are generated automatically (OKLCH). Rejects palettes whose body text (role text on role background) fails WCAG AA unless force=true. Returns a contrast report.",
      inputSchema: {
        slug: slugArg,
        colors: z.array(ColorArg).min(1),
        replace: z.boolean().optional().describe("Replace all colors (default) or append"),
        force: z.boolean().optional(),
        expectedRev: revArg,
      },
    },
    safe(async ({ slug, colors, replace, force, expectedRev }) => {
      const op: OpInput = { type: "setColors", colors, replace: replace ?? true };
      const preview = applyOps(await readBrand(slug), [op]);
      const pair = primaryTextPair(preview.colors);
      if (pair && pair.ratio < 4.5 && !force) {
        return fail(
          `Body text ${pair.textName} ${pair.text} on ${pair.backgroundName} ${pair.background} is only ${pair.ratio}:1 (needs 4.5:1 for WCAG AA). Darken the text or lighten the background — or pass force=true if this pair is never used for body copy.`,
        );
      }
      const b = await edit(slug, [op], expectedRev);
      return changed(b, "Palette set", {
        colors: b.colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex, role: c.role })),
        contrast: contrastReport(b.colors)
          .slice(0, 12)
          .map((p) => `${p.textName} on ${p.backgroundName}: ${p.ratio}:1 ${p.level} (APCA ${p.apca})`),
      });
    }),
  );

  server.registerTool(
    "update_color",
    {
      title: "Update color",
      description: "Edit one color by id (name, hex, role, usage). The tonal scale regenerates when hex changes.",
      inputSchema: {
        slug: slugArg,
        id: z.string(),
        name: z.string().optional(),
        hex: z.string().optional(),
        role: ColorRole.optional(),
        usage: z.string().optional(),
        expectedRev: revArg,
      },
    },
    safe(async ({ slug, id, expectedRev, ...patch }) => changed(await edit(slug, [{ type: "updateColor", id, patch }], expectedRev), "Color updated")),
  );

  server.registerTool(
    "propose_type_pairings",
    {
      title: "Propose type pairings",
      description: "Curated display/text font pairings ranked by mood keywords.",
      inputSchema: { keywords: z.array(z.string()).optional() },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ keywords }) => ok(suggestPairings(keywords ?? []).slice(0, 5))),
  );

  server.registerTool(
    "set_typography",
    {
      title: "Set typography",
      description: "Set display (headlines), text (body/UI) and optional mono fonts, and a type scale. Sizes in px; tracking in em (e.g. -0.02).",
      inputSchema: {
        slug: slugArg,
        display: FontArg.optional(),
        text: FontArg.optional(),
        mono: FontArg.nullable().optional(),
        scale: z.array(TypeStyle).optional(),
        expectedRev: revArg,
      },
    },
    safe(async ({ slug, display, text, mono, scale, expectedRev }) => {
      const op: OpInput = {
        type: "setTypography",
        display: display ? toFont(display) : undefined,
        text: text ? toFont(text) : undefined,
        mono: mono === null ? null : mono ? toFont(mono) : undefined,
        scale,
      };
      return changed(await edit(slug, [op], expectedRev), "Typography updated");
    }),
  );

  server.registerTool(
    "set_logo",
    {
      title: "Set logo",
      description:
        'Set the wordmark text and/or logomark SVG. Author marks as clean geometric SVG: a viewBox, simple paths, fill="currentColor" (it is recolored for light/dark), no text, no embedded images. Scripts and external refs are stripped.',
      inputSchema: {
        slug: slugArg,
        wordmark: z.string().optional(),
        markSvg: z.string().optional(),
        clearSpace: z.number().optional().describe("Clear space as a multiple of mark height"),
        minSize: z.number().optional().describe("Minimum height in px"),
        notes: z.string().optional().describe("Concept and usage notes"),
        expectedRev: revArg,
      },
    },
    safe(async ({ slug, expectedRev, ...patch }) => changed(await edit(slug, [{ type: "setLogo", patch }], expectedRev), "Logo updated")),
  );

  server.registerTool(
    "set_icons",
    {
      title: "Set icons",
      description: 'Set the brand icon set (shown on iconography pages). Each icon: a name and a 24×24 SVG using stroke/fill="currentColor".',
      inputSchema: {
        slug: slugArg,
        icons: z.array(z.object({ name: z.string(), svg: z.string(), id: z.string().optional() })).min(1),
        replace: z.boolean().optional(),
        expectedRev: revArg,
      },
    },
    safe(async ({ slug, icons, replace, expectedRev }) =>
      changed(await edit(slug, [{ type: "setIcons", icons, replace: replace ?? true }], expectedRev), `${icons.length} icons set`),
    ),
  );

  server.registerTool(
    "set_imagery_style",
    {
      title: "Set imagery direction",
      description: "Set the brand's art direction for imagery. It is prepended to every generate_image prompt for consistency.",
      inputSchema: { slug: slugArg, style: z.string(), expectedRev: revArg },
    },
    safe(async ({ slug, style, expectedRev }) => changed(await edit(slug, [{ type: "setImageryStyle", style }], expectedRev), "Imagery direction set")),
  );

  server.registerTool(
    "add_page",
    {
      title: "Add page",
      description: "Add a guideline page. See list_layouts for layouts and slots.",
      inputSchema: {
        slug: slugArg,
        layout: LayoutId,
        slots: z.record(z.string(), z.string()).optional(),
        index: z.number().int().min(0).optional().describe("0-based insert position; default end"),
        id: z.string().optional().describe('Readable page id, e.g. "palette"'),
        expectedRev: revArg,
      },
    },
    safe(async ({ slug, layout, slots, index, id, expectedRev }) => {
      const b = await edit(slug, [{ type: "addPage", layout, slots: slots ?? {}, index, id }], expectedRev);
      const page = index !== undefined ? b.pages[Math.min(index, b.pages.length - 1)] : b.pages[b.pages.length - 1];
      return changed(b, "Page added", { pageId: page?.id, slots: LAYOUTS[layout].slots.map((s) => `${s.key} (${s.kind})`) });
    }),
  );

  server.registerTool(
    "update_page",
    {
      title: "Update page",
      description: "Set slot values on a page (merge). Pass null to clear a slot. Optionally switch layout.",
      inputSchema: {
        slug: slugArg,
        pageId: z.string(),
        slots: z.record(z.string(), z.string().nullable()).optional(),
        layout: LayoutId.optional(),
        expectedRev: revArg,
      },
    },
    safe(async ({ slug, pageId, slots, layout, expectedRev }) =>
      changed(await edit(slug, [{ type: "updatePage", id: pageId, slots: slots ?? {}, layout }], expectedRev), "Page updated"),
    ),
  );

  server.registerTool(
    "remove_page",
    {
      title: "Remove page",
      description: "Delete a page.",
      inputSchema: { slug: slugArg, pageId: z.string(), expectedRev: revArg },
      annotations: { destructiveHint: true },
    },
    safe(async ({ slug, pageId, expectedRev }) => changed(await edit(slug, [{ type: "removePage", id: pageId }], expectedRev), "Page removed")),
  );

  server.registerTool(
    "reorder_pages",
    {
      title: "Reorder pages",
      description: "Set page order. Listed ids come first, in order; unlisted pages keep their relative order after them.",
      inputSchema: { slug: slugArg, pageIds: z.array(z.string()), expectedRev: revArg },
    },
    safe(async ({ slug, pageIds, expectedRev }) => changed(await edit(slug, [{ type: "reorderPages", ids: pageIds }], expectedRev), "Pages reordered")),
  );

  server.registerTool(
    "apply_ops",
    {
      title: "Apply ops (batch)",
      description:
        "Apply several low-level ops atomically in one revision. Op types: updateMeta, setColors, updateColor, removeColor, setTypography, setLogo, setImageryStyle, addAsset, updateAsset, removeAsset, setIcons, addPage, updatePage, removePage, reorderPages, scaffoldPages, boardAdd, boardUpdate, boardRemove, boardArrange.",
      inputSchema: { slug: slugArg, ops: z.array(z.record(z.string(), z.unknown())).min(1), expectedRev: revArg },
    },
    safe(async ({ slug, ops, expectedRev }) => {
      const parsed = ops.map((o) => Op.parse(o));
      return changed(await edit(slug, parsed, expectedRev), `${parsed.length} ops applied`);
    }),
  );

  server.registerTool(
    "undo",
    { title: "Undo", description: "Step the brand back one revision (repeatable).", inputSchema: { slug: slugArg } },
    safe(async ({ slug }) => changed(await undoBrand(slug, "agent"), "Undone")),
  );

  // ─────────────────────────── Imagery & board ───────────────────────────

  const PlaceArg = z
    .object({ pageId: z.string(), slot: z.string().describe("e.g. image, images, doImage") })
    .optional()
    .describe("Place the new asset into a page slot. For `images` slots it is appended.");

  async function addAssetAndPlace(
    slug: string,
    asset: { id: string; file: string; alt: string; caption?: string; credit?: string; prompt?: string; width?: number; height?: number },
    placeOn?: { pageId: string; slot: string },
    addToBoard?: boolean,
  ) {
    const b0 = await readBrand(slug);
    const ops: OpInput[] = [{ type: "addAsset", asset: { caption: "", credit: "", ...asset } }];
    if (placeOn) {
      const page = b0.pages.find((p) => p.id === placeOn.pageId);
      if (!page) throw new Error(`No page "${placeOn.pageId}".`);
      const spec = LAYOUTS[page.layout].slots.find((s) => s.key === placeOn.slot);
      if (!spec || (spec.kind !== "asset" && spec.kind !== "assets")) {
        throw new Error(
          `Slot "${placeOn.slot}" on ${page.layout} does not take images. Image slots: ${
            LAYOUTS[page.layout].slots
              .filter((s) => s.kind.startsWith("asset"))
              .map((s) => s.key)
              .join(", ") || "none"
          }`,
        );
      }
      const prev = page.slots[placeOn.slot]?.trim();
      const value = spec.kind === "assets" && prev ? `${prev},${asset.id}` : asset.id;
      ops.push({ type: "updatePage", id: page.id, slots: { [placeOn.slot]: value } });
    }
    if (addToBoard) {
      const ratio = asset.width && asset.height ? asset.height / asset.width : 0.75;
      ops.push({ type: "boardAdd", items: [{ kind: "image", ref: asset.id, w: 360, h: Math.round(360 * ratio) }] });
    }
    return edit(slug, ops);
  }

  server.registerTool(
    "generate_image",
    {
      title: "Generate image",
      description:
        "Generate brand imagery and save it as an asset. The brand's imagery direction and palette are added to the prompt. Provider auto-detects: FAL_KEY → Flux, OPENAI_API_KEY → gpt-image, otherwise an offline on-palette gradient artwork (prompts with 'streak'/'motion'/'horizon' give motion-blur bands). Optionally place it on a page and/or the moodboard.",
      inputSchema: {
        slug: slugArg,
        prompt: z.string().describe("Describe subject, composition, light, medium. No text in images."),
        aspect: z.enum(["16:9", "4:3", "1:1", "3:4", "9:16"]).optional(),
        alt: z.string().describe("Alt text describing the image for screen readers"),
        caption: z.string().optional(),
        placeOn: PlaceArg,
        addToBoard: z.boolean().optional(),
        provider: z.enum(["fal", "openai", "gradient"]).optional(),
        usePalette: z.boolean().optional().describe("Include brand colors in the prompt (default true)"),
      },
    },
    safe(async ({ slug, prompt, aspect, alt, caption, placeOn, addToBoard, provider, usePalette }) => {
      const b = await readBrand(slug);
      const palette = usePalette === false ? [] : b.colors.map((c) => c.hex);
      const img = await generateImage({ prompt, aspect: (aspect ?? "16:9") as Aspect, palette, style: b.imagery.style }, provider);
      const id = makeId("img");
      const file = await saveAssetFile(slug, `${slugify(prompt).slice(0, 32)}${img.ext}`, img.bytes);
      const next = await addAssetAndPlace(
        slug,
        { id, file, alt, caption, prompt, credit: `Generated · ${img.model}`, width: img.width, height: img.height },
        placeOn,
        addToBoard,
      );
      return changed(next, `Image generated with ${img.provider}`, {
        assetId: id,
        file,
        provider: img.provider,
        ...(img.provider === "gradient" && resolveProvider() === "gradient"
          ? { tip: "No FAL_KEY/OPENAI_API_KEY set — produced an abstract gradient. Set a key for photographic or illustrative imagery." }
          : {}),
      });
    }),
  );

  server.registerTool(
    "add_image_from_url",
    {
      title: "Add image from URL",
      description: "Download an image the designer referenced (png/jpg/webp/svg/gif) into the brand's assets.",
      inputSchema: {
        slug: slugArg,
        url: z.string().url(),
        alt: z.string(),
        caption: z.string().optional(),
        credit: z.string().optional(),
        placeOn: PlaceArg,
        addToBoard: z.boolean().optional(),
      },
    },
    safe(async ({ slug, url, alt, caption, credit, placeOn, addToBoard }) => {
      const u = new URL(url);
      if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only http(s) URLs are supported.");
      const res = await fetch(u);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const type = res.headers.get("content-type") ?? "";
      const ext = type.includes("svg")
        ? ".svg"
        : type.includes("jpeg")
          ? ".jpg"
          : type.includes("webp")
            ? ".webp"
            : type.includes("gif")
              ? ".gif"
              : type.includes("png")
                ? ".png"
                : path.extname(u.pathname);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const id = makeId("img");
      const file = await saveAssetFile(slug, `${path.basename(u.pathname, path.extname(u.pathname)) || "image"}${ext}`, bytes);
      const next = await addAssetAndPlace(slug, { id, file, alt, caption, credit: credit ?? u.hostname }, placeOn, addToBoard);
      return changed(next, "Image added", { assetId: id, file });
    }),
  );

  server.registerTool(
    "board_add",
    {
      title: "Add to moodboard",
      description:
        "Add items to the moodboard canvas. kind=image (ref=asset id), swatch (ref=color id), type (ref=display|text|mono, text=specimen), note (text). Omit x/y to append below.",
      inputSchema: {
        slug: slugArg,
        items: z
          .array(
            z.object({
              kind: z.enum(["image", "swatch", "type", "note"]),
              ref: z.string().optional(),
              text: z.string().optional(),
              x: z.number().optional(),
              y: z.number().optional(),
              w: z.number().optional(),
              h: z.number().optional(),
            }),
          )
          .min(1),
        expectedRev: revArg,
      },
    },
    safe(async ({ slug, items, expectedRev }) => changed(await edit(slug, [{ type: "boardAdd", items }], expectedRev), `${items.length} board items added`)),
  );

  server.registerTool(
    "board_arrange",
    {
      title: "Arrange moodboard",
      description: "Auto-arrange the moodboard as a masonry grid.",
      inputSchema: { slug: slugArg, columns: z.number().int().min(1).max(8).optional(), expectedRev: revArg },
    },
    safe(async ({ slug, columns, expectedRev }) =>
      changed(await edit(slug, [{ type: "boardArrange", columns: columns ?? 4, width: 1600, gap: 16 }], expectedRev), "Board arranged"),
    ),
  );

  // ─────────────────────────── Review & export ───────────────────────────

  server.registerTool(
    "audit_brand",
    {
      title: "Audit brand",
      description: "Check accessibility (contrast, alt text, type size), completeness and consistency. Returns issues by severity.",
      inputSchema: { slug: slugArg },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ slug }) => {
      const issues = auditBrand(await readBrand(slug));
      return ok({ errors: issues.filter((i) => i.severity === "error").length, warnings: issues.filter((i) => i.severity === "warning").length, issues });
    }),
  );

  server.registerTool(
    "render_preview",
    {
      title: "Render page preview",
      description: "Screenshot a guideline page from the running studio so you can see it. Identify the page by id or 1-based number.",
      inputSchema: {
        slug: slugArg,
        pageId: z.string().optional(),
        page: z.number().int().min(1).optional(),
        width: z.number().int().min(320).max(2400).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ slug, pageId, page, width }) => {
      const b = await readBrand(slug);
      const target = pageId ? b.pages.find((p) => p.id === pageId) : b.pages[(page ?? 1) - 1];
      if (!target) throw new Error(`Page not found. Pages: ${b.pages.map((p, i) => `${i + 1}:${p.id}`).join(", ")}`);
      const png = await renderPage(slug, target.id, width ?? 1440);
      return ok(`Page ${b.pages.indexOf(target) + 1} · ${LAYOUTS[target.layout].name} (${target.id}) · rev ${b.rev}`, [
        { type: "image", data: png.toString("base64"), mimeType: "image/png" },
      ]);
    }),
  );

  server.registerTool(
    "export_tokens",
    {
      title: "Export design tokens",
      description:
        "Export colors and type as css (custom properties), tailwind (v4 @theme), w3c-json (DTCG) or figma-variables-json. Also saved to brands/<slug>/exports/.",
      inputSchema: { slug: slugArg, format: z.enum(TOKEN_FORMATS) },
    },
    safe(async ({ slug, format }) => {
      const out = exportTokens(await readBrand(slug), format);
      const dir = path.join(brandDir(slug), "exports");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, out.filename), out.content);
      return ok(`Saved brands/${slug}/exports/${out.filename}\n\n${out.content}`);
    }),
  );

  // ─────────────────────────── Prompts ───────────────────────────

  server.registerPrompt(
    "brand_kickoff",
    {
      title: "Brand kickoff",
      description: "Interview the designer, then build a complete first draft of the guidelines.",
      argsSchema: { brief: z.string().optional().describe("Anything already known about the brand") },
    },
    ({ brief }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Let's create brand guidelines together in the Guidelines studio.
${brief ? `\nWhat I know so far:\n${brief}\n` : ""}
First, interview me — at most 6 short questions, asked together: name and what it does, audience, 3–5 personality adjectives, 2–3 reference brands or images, colors or styles to avoid, where it will mostly appear (product UI, print, social, OOH).

Then build a complete first draft without stopping for approval at each step:
1. create_brand with a tagline, story, voice and keywords.
2. propose_palettes from a seed that fits, then set_palette (4–6 colors, clear roles, AA body contrast).
3. propose_type_pairings, then set_typography with a scale (Display 72/1.0, Heading 40/1.1, Subhead 24/1.25, Body 16/1.5, Caption 12/1.4 — adjust to taste).
4. Draw a simple geometric logomark SVG (viewBox, fill="currentColor") and set_logo with concept notes.
5. set_imagery_style, then generate_image for the cover (placeOn cover.image), 3–6 imagery-grid images (placeOn the imagery page), and a billboard image; add a few to the moodboard.
6. Write every page's copy with update_page — confident, specific, 2–4 sentences.
7. render_preview the cover and palette pages, audit_brand, fix what you find.

Finish with a short summary and the studio link.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "review_guidelines",
    {
      title: "Review guidelines",
      description: "Critique the current guidelines like an art director and fix issues.",
      argsSchema: { slug: z.string() },
    },
    ({ slug }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Review the "${slug}" brand guidelines as a senior art director. Run audit_brand, then render_preview every page. Assess hierarchy, whitespace, consistency of voice, palette restraint, type pairing and imagery coherence. List the 5 most impactful improvements, then apply them (pass expectedRev on each write) and re-render to confirm.`,
          },
        },
      ],
    }),
  );

  // ─────────────────────────── Resources ───────────────────────────

  const listResources = async () => ({
    resources: (await listBrands()).map((b) => ({ uri: `brand://${b.slug}`, name: b.name, mimeType: "application/json" })),
  });

  server.registerResource(
    "brand",
    new ResourceTemplate("brand://{slug}", { list: listResources }),
    { title: "Brand summary", description: "Compact brand summary JSON", mimeType: "application/json" },
    async (uri, { slug }) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(summarizeBrand(await readBrand(String(slug))), null, 2) }],
    }),
  );

  server.registerResource(
    "brand-tokens",
    new ResourceTemplate("brand://{slug}/tokens.css", { list: undefined }),
    { title: "Brand tokens (CSS)", description: "CSS custom properties for a brand", mimeType: "text/css" },
    async (uri, { slug }) => ({
      contents: [{ uri: uri.href, mimeType: "text/css", text: exportTokens(await readBrand(String(slug)), "css").content }],
    }),
  );

  return server;
}
