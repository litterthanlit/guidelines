/**
 * Builds the committed example brand at brands/meridian using the same store
 * and image generator the agent uses. Re-run any time:
 *
 *   pnpm --filter @guidelines/mcp seed
 */
import { rm } from "node:fs/promises";
import type { OpInput } from "@guidelines/core";
import { brandDir, createBrand, mutateBrand, saveAssetFile } from "@guidelines/core/store";
import { generateImage, type Aspect } from "../src/imagegen";

process.env.GUIDELINES_DIR ??= new URL("../../../brands", import.meta.url).pathname;

const slug = "meridian";
await rm(brandDir(slug), { recursive: true, force: true });

await createBrand(
  {
    slug,
    meta: {
      name: "Meridian",
      tagline: "Money, in its right place.",
      story:
        "Meridian is bookkeeping for small studios — architects, designers, makers. It reconciles accounts, chases invoices and prepares taxes quietly in the background, so the work in front of you gets your full attention.",
      audience: "Independent studios of 2–30 people who care how their tools look and feel.",
      voice: ["Calm", "Precise", "Warm", "Unhurried"],
      keywords: ["calm", "editorial", "trustworthy", "warm"],
    },
    logo: {
      wordmark: "Meridian",
      clearSpace: 0.5,
      minSize: 20,
      notes: "A globe reduced to its essentials: horizon, meridian, and the curve between them — orientation without noise.",
    },
  },
  "system",
);

const palette = ["#90A7CE", "#B5B69F", "#E5EAD8", "#F2F0EB"];
const style = "Soft, atmospheric, painterly light; quiet landscapes at golden hour; generous negative space; no people facing camera.";

async function image(prompt: string, aspect: Aspect, alt: string, caption = "", pal = palette) {
  const img = await generateImage({ prompt, aspect, palette: pal, style }, "gradient");
  const file = await saveAssetFile(slug, `${prompt.split(" ").slice(0, 3).join("-")}${img.ext}`, img.bytes);
  const id = `img-${prompt.split(" ")[0]!.toLowerCase()}-${aspect.replace(":", "x")}`;
  return { id, file, alt, caption, credit: "Generated · guidelines-gradient-v1", prompt, width: img.width, height: img.height };
}

const assets = [
  await image("horizon streaks over a still bay at dusk", "16:9", "Horizontal bands of soft blue and sage light, like a blurred horizon", "", [
    "#90A7CE",
    "#B5B69F",
    "#E5EAD8",
    "#5E7398",
    "#F2F0EB",
  ]),
  await image("mist rising over hills", "4:3", "Soft blue and sage haze", "Mist"),
  await image("field streaks in late summer", "4:3", "Motion-blurred bands of olive and cream", "Field", ["#B5B69F", "#E5EAD8", "#D9774B", "#F2F0EB"]),
  await image("lake reflection morning", "4:3", "Pale blue blur with a warm glow", "Lake", ["#90A7CE", "#F2E3CF", "#E5EAD8", "#C9D6EA"]),
  await image("coastal horizon motion", "4:3", "Layered horizontal bands of sea and sky", "Coast", ["#5E7398", "#90A7CE", "#E5EAD8", "#F2F0EB"]),
  await image("evening glow over valley", "4:3", "Warm ember light fading into blue", "Valley", ["#D9774B", "#F2C9A8", "#90A7CE", "#F2F0EB"]),
  await image("sage meadow haze", "4:3", "Muted sage and olive haze", "Meadow", ["#B5B69F", "#8C8E73", "#E5EAD8", "#F2F0EB"]),
  await image("dusk sky banding over water", "16:9", "Billboard image: dusky blue horizon bands", "", ["#5E7398", "#90A7CE", "#D9774B", "#E5EAD8", "#F2F0EB"]),
];

const icon = (d: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const icons = [
  ["Calendar", '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'],
  ["Invoice", '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>'],
  ["Paid", '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/>'],
  ["Report", '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>'],
  ["Search", '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>'],
  ["Studio", '<path d="M4 10.5 12 4l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/>'],
  ["Filter", '<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>'],
  ["Client", '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>'],
  ["Meridian", '<circle cx="12" cy="12" r="8.5"/><ellipse cx="12" cy="12" rx="4" ry="8.5"/><path d="M3.5 12h17"/>'],
  ["Card", '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 14.5h3"/>'],
  ["Bank", '<path d="M3.5 9 12 4l8.5 5zM5 9v8M9.5 9v8M14.5 9v8M19 9v8M3.5 20h17"/>'],
  ["Reminder", '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>'],
  ["Secure", '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'],
  [
    "Automate",
    '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="2.5"/>',
  ],
].map(([name, d]) => ({ name: name!, svg: icon(d!) }));

const markSvg = `<svg viewBox="0 0 48 48" fill="currentColor">
<path fill-rule="evenodd" d="M24 3a21 21 0 1 1 0 42a21 21 0 1 1 0-42zm0 3.5a17.5 17.5 0 1 0 0 35a17.5 17.5 0 1 0 0-35z"/>
<path fill-rule="evenodd" d="M24 6.5c5.6 0 9.5 7.8 9.5 17.5S29.6 41.5 24 41.5 14.5 33.7 14.5 24 18.4 6.5 24 6.5zm0 3.4c-3.4 0-6.1 6.3-6.1 14.1S20.6 38.1 24 38.1s6.1-6.3 6.1-14.1S27.4 9.9 24 9.9z"/>
<rect x="5" y="22.3" width="38" height="3.4" rx="1.7"/>
</svg>`;

const [cover, ...grid] = assets;
const billboard = assets[assets.length - 1]!;
const gridImgs = grid.slice(0, 6);

const ops: OpInput[] = [
  {
    type: "setColors",
    colors: [
      { id: "paper", name: "Paper", hex: "#F2F0EB", role: "background", usage: "Default page and surface color." },
      { id: "ink", name: "Ink", hex: "#222222", role: "text", usage: "Body text, rules and the logomark." },
      { id: "sky", name: "Sky", hex: "#90A7CE", role: "primary", usage: "Primary brand color for hero moments and key UI." },
      { id: "olive", name: "Olive", hex: "#B5B69F", role: "secondary", usage: "Supporting tone for illustration and data." },
      { id: "sage", name: "Sage", hex: "#E5EAD8", role: "neutral", usage: "Quiet panels and backgrounds." },
      { id: "ember", name: "Ember", hex: "#D9774B", role: "accent", usage: "Sparingly — one signal per view." },
    ],
  },
  {
    type: "setTypography",
    display: {
      family: "PT Serif",
      source: "google",
      weights: [400, 700],
      italic: true,
      fallback: "Georgia, 'Times New Roman', serif",
      usage: "Headlines, campaign lines and section openers. Never below 20px.",
    },
    text: {
      family: "DM Sans",
      source: "google",
      weights: [400, 500, 700],
      italic: false,
      fallback: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      usage: "Interface, body copy, captions and data.",
    },
    mono: {
      family: "IBM Plex Mono",
      source: "google",
      weights: [400, 500],
      italic: false,
      fallback: "ui-monospace, 'SF Mono', Menlo, monospace",
      usage: "Figures, codes and labels.",
    },
    scale: [
      { name: "Display", font: "display", size: 72, lineHeight: 1.02, tracking: -0.02, weight: 400 },
      { name: "Headline", font: "display", size: 40, lineHeight: 1.1, tracking: -0.015, weight: 400 },
      { name: "Subhead", font: "text", size: 22, lineHeight: 1.3, tracking: -0.01, weight: 500 },
      { name: "Body", font: "text", size: 16, lineHeight: 1.55, tracking: 0, weight: 400 },
      { name: "Caption", font: "text", size: 13, lineHeight: 1.45, tracking: 0, weight: 400 },
      { name: "Label", font: "mono", size: 12, lineHeight: 1.4, tracking: 0.04, weight: 500 },
    ],
  },
  { type: "setLogo", patch: { markSvg } },
  { type: "setImageryStyle", style },
  { type: "setIcons", icons, replace: true },
  ...assets.map((a) => ({ type: "addAsset" as const, asset: a })),
  { type: "addPage", id: "cover", layout: "cover", slots: { title: "Brand Guidelines", subtitle: "Edition 01 · 2026", image: cover!.id } },
  {
    type: "addPage",
    id: "purpose",
    layout: "statement",
    slots: {
      eyebrow: "Our purpose",
      headline: "Money, in its right place.",
      body: "We take the noise out of running a studio — so the numbers stay true and the work stays first.",
      tone: "light",
    },
  },
  {
    type: "addPage",
    id: "logomark",
    layout: "logomark",
    slots: {
      title: "Logomark",
      body: "The logomark is the symbol element of our logo, used independently of the wordmark where space is tight. Keep the clear space shown — half the mark's height on every side — and never redraw, outline or rotate it.",
      show: "mark",
    },
  },
  {
    type: "addPage",
    id: "palette",
    layout: "palette",
    slots: {
      title: "Color palette",
      body: "Paper and Ink carry almost everything. Sky leads brand moments; Olive and Sage support. Ember is a signal — use it once per view, never as a background.",
    },
  },
  {
    type: "addPage",
    id: "primary-font",
    layout: "type-specimen",
    slots: {
      title: "Primary font",
      body: "PT Serif sets our headlines with a calm, bookish authority. Use it in promotional material, social and landing pages — not in the product UI.",
      font: "display",
    },
  },
  {
    type: "addPage",
    id: "secondary-font",
    layout: "type-specimen",
    slots: {
      title: "Secondary font",
      body: "DM Sans does the everyday work: interface, body copy, captions and tables. Friendly, legible, never loud.",
      font: "text",
    },
  },
  {
    type: "addPage",
    id: "imagery",
    layout: "imagery-grid",
    slots: {
      title: "Brand imagery",
      body: "Imagery is soft and atmospheric — light over land and water, horizons rather than subjects. It should feel like the moment after the books are closed.",
      images: gridImgs.map((a) => a.id).join(","),
    },
  },
  {
    type: "addPage",
    id: "billboard",
    layout: "application-mockup",
    slots: {
      title: "Billboard",
      body: "At distance, the system reduces to one image, one line and the mark. Headlines stay in PT Serif; everything else gets out of the way.",
      variant: "billboard",
      image: billboard.id,
      headline: "Every invoice, gently chased.",
      cta: "Start free",
    },
  },
  {
    type: "addPage",
    id: "product",
    layout: "application-mockup",
    slots: {
      title: "Product surfaces",
      body: "In the product, glass cards float on atmospheric color. Data uses Sky and Olive; Ember marks the one thing that needs attention.",
      variant: "card",
      headline: "$96,316.10",
      cta: "View report →",
    },
  },
  {
    type: "addPage",
    id: "banner",
    layout: "application-mockup",
    slots: {
      title: "Street banner",
      body: "Banners lead with the headline and lockup on Paper, letting the architecture and sky do the rest.",
      variant: "banner",
      headline: "Automate the books for every studio.",
    },
  },
  {
    type: "addPage",
    id: "icons",
    layout: "iconography-grid",
    slots: {
      title: "Iconography",
      body: "Icons are drawn on a 24px grid with a 1.5px stroke and rounded joins. They inherit Ink and sit on soft white tiles.",
    },
  },
  {
    type: "addPage",
    id: "usage",
    layout: "do-dont",
    slots: {
      title: "Usage",
      body: "A few rules keep Meridian recognisable everywhere it appears.",
      do: "Lead with generous Paper and one strong image\nSet headlines in PT Serif, sentence case\nUse Ember for a single call to action",
      dont: "Fill backgrounds with Ember\nStack more than two typefaces\nPlace text over busy image areas",
      doImage: gridImgs[0]!.id,
      dontImage: gridImgs[4]!.id,
    },
  },
  {
    type: "boardAdd",
    items: [
      { kind: "image", ref: cover!.id, w: 640, h: 360 },
      { kind: "type", ref: "display", w: 520, h: 320 },
      { kind: "swatch", ref: "sky", w: 200, h: 260 },
      { kind: "swatch", ref: "olive", w: 200, h: 260 },
      { kind: "swatch", ref: "ember", w: 200, h: 260 },
      ...gridImgs.slice(0, 5).map((a) => ({ kind: "image" as const, ref: a.id, w: 400, h: 300 })),
      { kind: "note", text: "Quiet confidence. Think gallery wall labels, not fintech dashboards.", w: 400, h: 200 },
      { kind: "type", ref: "text", w: 520, h: 320 },
      { kind: "swatch", ref: "sage", w: 200, h: 260 },
      { kind: "note", text: "Light over land and water — horizons, never subjects.", w: 400, h: 180 },
    ],
  },
  { type: "boardArrange", columns: 4, width: 1600, gap: 16 },
];

const b = await mutateBrand(slug, ops, { actor: "system", summary: "Seeded example brand" });
console.log(`Seeded ${slug}: rev ${b.rev}, ${b.pages.length} pages, ${b.imagery.assets.length} assets, ${b.board.items.length} board items`);
