/**
 * Builds the committed example brand at brands/hypher: a dark/light identity
 * system shown on three brand boards (overview, system, index). Uses the same
 * ops and procedural artwork the agent uses. Re-run any time:
 *
 *   pnpm --filter @guidelines/mcp seed:hypher
 */
import { rm } from "node:fs/promises";
import { artColors, parseArt, renderArt, type Brand, type OpInput } from "@guidelines/core";
import { brandDir, createBrand, mutateBrand, readBrand, saveAssetFile } from "@guidelines/core/store";

process.env.GUIDELINES_DIR ??= new URL("../../../brands", import.meta.url).pathname;

const slug = "hypher";
await rm(brandDir(slug), { recursive: true, force: true });

await createBrand(
  {
    slug,
    meta: {
      name: "Hypher",
      tagline: "Project memory for coding agents.",
      story:
        "Hypher keeps the context behind your code — the ideas, experiments, trade-offs and dead ends that never land in git — and hands it to every coding agent you work with. You don't explain the project again.",
      audience: "Developers and small teams who build with AI coding agents every day.",
      voice: ["Precise", "Calm", "Technical", "Warm"],
      keywords: ["Ideas", "Experiments", "Trade-offs", "Dead ends", "Decisions"],
    },
    logo: {
      wordmark: "hypher",
      clearSpace: 0.5,
      minSize: 16,
      notes:
        "A conduit: a wide block of context narrows into a single channel and opens out again, carried forward. Always horizontal; never stack the wordmark.",
    },
  },
  "system",
);

const markSvg = `<svg viewBox="0 0 120 28" fill="currentColor"><path d="M0 2H44V10H77C81.5 10 82.5 2 88 2H111L120 26H88C82.5 26 81.5 18 77 18H44V26H0Z"/></svg>`;

const base: OpInput[] = [
  {
    type: "setColors",
    colors: [
      { id: "ivory", name: "Ivory", hex: "#F3F1EA", role: "background", usage: "Pages, cards and generous space.", traits: ["Balance", "Legibility", "Space"] },
      { id: "charcoal", name: "Charcoal", hex: "#171A1B", role: "text", usage: "Type, rules and dark surfaces.", traits: ["Depth", "Focus", "Clarity"] },
      {
        id: "signal-blue",
        name: "Signal Blue",
        hex: "#1689D4",
        role: "primary",
        usage: "Artwork, links and the memory signal.",
        traits: ["Signal", "Memory", "Trust"],
      },
      {
        id: "ice-blue",
        name: "Ice Blue",
        hex: "#80C7EE",
        role: "secondary",
        usage: "Line art and highlights on charcoal.",
        traits: ["Flow", "Structure", "Intelligence"],
      },
      {
        id: "signal-orange",
        name: "Signal Orange",
        hex: "#F48254",
        role: "accent",
        usage: "The human moment: one spark per view.",
        traits: ["Decisions", "Human input", "Momentum"],
      },
    ],
  },
  {
    type: "setTypography",
    display: {
      family: "Inter Tight",
      source: "google",
      weights: [400, 500, 700],
      italic: false,
      fallback: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      usage: "Headlines. Bold, tight, short — three to five words.",
    },
    text: {
      family: "Inter",
      source: "google",
      weights: [400, 500, 600],
      italic: false,
      fallback: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      usage: "Interface and body copy.",
    },
    mono: {
      family: "IBM Plex Mono",
      source: "google",
      weights: [400, 500],
      italic: false,
      fallback: "ui-monospace, 'SF Mono', Menlo, monospace",
      usage: "Labels, captions and subheads — tracked caps for labels, sentence case for copy.",
    },
    scale: [
      { name: "Display", font: "display", size: 96, lineHeight: 0.95, tracking: -0.045, weight: 700 },
      { name: "Headline", font: "display", size: 48, lineHeight: 1, tracking: -0.035, weight: 700 },
      { name: "Subhead", font: "mono", size: 20, lineHeight: 1.4, tracking: 0.01, weight: 400 },
      { name: "Body", font: "text", size: 16, lineHeight: 1.5, tracking: 0, weight: 400 },
      { name: "Label", font: "mono", size: 11, lineHeight: 1.6, tracking: 0.22, weight: 400 },
    ],
  },
  {
    type: "setLogo",
    patch: {
      markSvg,
      font: { family: "Michroma", source: "google", weights: [400], italic: false, fallback: "system-ui, sans-serif", usage: "Wordmark only." },
      wordmarkWeight: 400,
      wordmarkTracking: -0.01,
    },
  },
  {
    type: "setImageryStyle",
    style:
      "Grainy, sprayed light: rays and ribbons of signal blue bursting from a dark core with a spark of orange. Fine line art on charcoal for systems. Lots of ivory space. No people, no screenshots.",
  },
];
await mutateBrand(slug, base, { actor: "system", summary: "Foundations" });

// Imagery: the procedural artwork, saved as assets for the imagery page and moodboard.
const brand: Brand = await readBrand(slug);
async function art(spec: string, tone: "light" | "dark", alt: string, w = 1600, h = 1000) {
  const svg = renderArt(parseArt(spec)!, artColors(brand, tone), { width: w, height: h });
  const file = await saveAssetFile(slug, `${spec.replace(":", "-")}-${tone}.svg`, new TextEncoder().encode(svg));
  return { id: `art-${spec.replace(":", "-")}-${tone}`, file, alt, caption: "", credit: "Procedural · guidelines-art-v1", prompt: spec, width: w, height: h };
}
const assets = [
  await art("burst:2", "light", "Blue rays bursting from a dark core with an orange halo"),
  await art("swirl:3", "light", "Sweeping blue ribbons sprayed across ivory"),
  await art("converge:2", "light", "Blue streaks converging to a bright orange point"),
  await art("flow:4", "dark", "Fine ice-blue lines funnelling through a glowing channel on charcoal"),
  await art("strata:2", "dark", "Stacked wireframe planes with one glowing layer"),
  await art("diverge:3", "light", "Rays fanning out from a bright point"),
];

const ops: OpInput[] = [
  ...assets.map((asset) => ({ type: "addAsset" as const, asset })),
  {
    type: "addPage",
    id: "cover",
    layout: "cover",
    slots: { title: "Keep the context.", subtitle: "Brand guidelines · Edition 01", art: "burst:2" },
  },
  { type: "addBoard", template: "overview", id: "overview" },
  { type: "addBoard", template: "system", id: "system" },
  { type: "addBoard", template: "index", id: "index" },
  {
    type: "addPage",
    id: "logomark",
    layout: "logomark",
    slots: {
      title: "Logomark",
      show: "lockup",
      body: "A wide block of context narrows into one channel and opens out again — memory, carried forward. Keep half the mark's height clear on every side.",
    },
  },
  {
    type: "addPage",
    id: "palette",
    layout: "palette",
    slots: {
      title: "Color",
      body: "Ivory and charcoal carry the system. Signal Blue is the memory itself; Signal Orange marks the human decision — one spark per view.",
    },
  },
  {
    type: "addPage",
    id: "type",
    layout: "type-specimen",
    slots: {
      title: "Typeface",
      font: "display",
      body: "Inter Tight Bold, set tight, for short confident headlines. IBM Plex Mono in tracked caps for every label.",
    },
  },
  {
    type: "addPage",
    id: "imagery",
    layout: "imagery-grid",
    slots: {
      title: "Imagery",
      body: "Light that behaves like memory: sprayed, grainy, always moving toward or away from a single point.",
      images: assets.map((a) => a.id).join(","),
    },
  },
];
await mutateBrand(slug, ops, { actor: "system", summary: "Pages and boards" });

// Copy, tuned per board.
const tile = (pageId: string, id: string, slots: Record<string, string | null>, patch: Record<string, unknown> = {}): OpInput => ({
  type: "updateTile",
  pageId,
  id,
  slots,
  patch,
});
await mutateBrand(
  slug,
  [
    tile("overview", "logo", { caption: "Project memory\nfor coding agents" }),
    tile("overview", "hero", { eyebrow: "Signal memory", headline: "Keep\nthe context.", subhead: "You don’t explain\nthe project again." }),
    tile("overview", "steps", {
      label: "Project memory in motion",
      items: "Capture — Ideas, decisions, and progress.\nRemember — Preserved across sessions.\nResume — Pick up exactly where you left off.",
    }),
    tile("overview", "poster", { headline: "You don’t explain the project again.", subhead: "Project memory\nfor coding agents.", cta: "Start capturing" }),
    tile("system", "logo", { caption: "Context engine\nProject memory for coding agents." }),
    tile("system", "hero", {
      headline: "Every session.\nSame context.",
      subhead: "Project memory for coding agents.\nRetaining the decisions that never land in git.",
      index: "Ideas\nExperiments\nTrade offs\nDead ends\nDecisions",
      noteLeft: "Context\naligns\nagents",
      noteRight: "From fragmented\nto continuous",
    }),
    tile("system", "palette", { caption: "Context engine\nProject memory for coding agents.", colors: "charcoal,ice-blue,signal-orange,ivory" }),
    tile("system", "steps", {
      label: "The context engine",
      items:
        "Capture — Automatically capture the full context of your work.\nPreserve — Retain the decisions, experiments and insights that never land in git.\nContinue — Give coding agents the context to pick up where you left off.",
    }),
    tile("system", "web", { headline: "Pick up where you left off.", subhead: "Project memory for coding agents.", cta: "Start capturing" }),
    tile("system", "poster", { headline: "The\ndecisions\nstay.", caption: "Project memory\nfor coding agents" }),
    tile("index", "illustrations", { items: "Capture the context\nPreserve decisions\nContinue anywhere" }),
    tile("index", "type", { headline: "Every session.\nSame context.", subhead: "Trusted by teams who ship with agents", mark: "center" }),
    tile("index", "web", { links: "Capture context\nDiscover decisions\nPreserve experiments\nShare across agents\nResume any session\nAudit trade-offs" }),
  ],
  { actor: "system", summary: "Board copy" },
);

await mutateBrand(
  slug,
  [
    {
      type: "boardAdd",
      items: [
        { kind: "image", ref: assets[0]!.id, w: 420, h: 262 },
        { kind: "image", ref: assets[3]!.id, w: 420, h: 262 },
        { kind: "swatch", ref: "signal-blue", w: 200, h: 200 },
        { kind: "swatch", ref: "signal-orange", w: 200, h: 200 },
        { kind: "type", ref: "display", text: "Keep the context.", w: 420, h: 200 },
        { kind: "image", ref: assets[1]!.id, w: 420, h: 262 },
        { kind: "note", text: "Grain over gloss. Every image moves toward or away from one point.", w: 300, h: 160 },
      ],
    },
    { type: "boardArrange", columns: 3, width: 1300, gap: 16 },
  ],
  { actor: "system", summary: "Moodboard" },
);

console.log(`Seeded ${slug}.`);
