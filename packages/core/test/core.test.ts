import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  apcaContrast,
  applyOps,
  auditBrand,
  Brand,
  buildScale,
  contrastRatio,
  exportTokens,
  masonry,
  OpError,
  parseBrand,
  proposePalettes,
  sanitizeSvg,
  SCALE_STEPS,
} from "../src/index";
import { ConflictError, createBrand, mutateBrand, readActivity, readBrand, undoBrand } from "../src/store";

const base = () =>
  parseBrand({
    slug: "acme",
    meta: { name: "Acme" },
  });

describe("schema", () => {
  it("fills defaults and round-trips through JSON", () => {
    const b = base();
    expect(b.rev).toBe(0);
    expect(b.typography.display.family).toBeTruthy();
    const again = Brand.parse(JSON.parse(JSON.stringify(b)));
    expect(again).toEqual(b);
  });

  it("normalizes hex to uppercase and rejects bad slugs", () => {
    const b = applyOps(base(), [{ type: "setColors", colors: [{ name: "Ink", hex: "#1a1a1a", role: "text" }] }]);
    expect(b.colors[0]!.hex).toBe("#1A1A1A");
    expect(() => parseBrand({ slug: "Bad Slug", meta: { name: "x" } })).toThrow();
  });
});

describe("color", () => {
  it("computes WCAG contrast", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBe(21);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
  });

  it("computes APCA with polarity", () => {
    expect(apcaContrast("#000000", "#FFFFFF")).toBeGreaterThan(100);
    expect(apcaContrast("#FFFFFF", "#000000")).toBeLessThan(-100);
    expect(apcaContrast("#888888", "#888888")).toBe(0);
  });

  it("builds a monotonic 11-step scale", () => {
    const scale = buildScale("#7D93C9");
    expect(Object.keys(scale)).toEqual([...SCALE_STEPS]);
    const lum = SCALE_STEPS.map((s) => contrastRatio(scale[s], "#000000"));
    for (let i = 1; i < lum.length; i++) expect(lum[i]!).toBeLessThan(lum[i - 1]!);
  });

  it("proposes palettes that include the seed", () => {
    const p = proposePalettes("#3B5BDB");
    expect(p.length).toBeGreaterThanOrEqual(3);
    for (const prop of p) for (const c of prop.colors) expect(c.hex).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe("mutations", () => {
  it("never mutates the input brand", () => {
    const b = base();
    const snapshot = JSON.stringify(b);
    applyOps(b, [
      { type: "updateMeta", patch: { tagline: "Hi" } },
      { type: "scaffoldPages" },
      { type: "setColors", colors: [{ name: "Blue", hex: "#3355FF", role: "primary" }] },
    ]);
    expect(JSON.stringify(b)).toBe(snapshot);
  });

  it("adds, edits, reorders and removes pages", () => {
    let b = applyOps(base(), [
      { type: "addPage", layout: "cover", slots: { title: "Brand Guidelines" }, id: "cover" },
      { type: "addPage", layout: "palette", slots: { title: "Color" }, id: "color" },
    ]);
    expect(b.pages.map((p) => p.id)).toEqual(["cover", "color"]);
    b = applyOps(b, [
      { type: "updatePage", id: "color", slots: { body: "Use sparingly.", title: null } },
      { type: "reorderPages", ids: ["color"] },
    ]);
    expect(b.pages.map((p) => p.id)).toEqual(["color", "cover"]);
    expect(b.pages[0]!.slots).toEqual({ body: "Use sparingly." });
    b = applyOps(b, [{ type: "removePage", id: "cover" }]);
    expect(b.pages).toHaveLength(1);
  });

  it("gives colors stable unique ids and scales", () => {
    const b = applyOps(base(), [
      {
        type: "setColors",
        colors: [
          { name: "Sky", hex: "#90A7CE", role: "primary" },
          { name: "Sky", hex: "#90A7CE", role: "secondary" },
        ],
      },
    ]);
    expect(b.colors.map((c) => c.id)).toEqual(["sky", "sky-2"]);
    expect(Object.keys(b.colors[0]!.scale)).toHaveLength(11);
  });

  it("removing an asset clears page slots and board items", () => {
    const b = applyOps(base(), [
      { type: "addAsset", asset: { id: "a1", file: "assets/a.png" } },
      { type: "addAsset", asset: { id: "a2", file: "assets/b.png" } },
      { type: "addPage", layout: "imagery-grid", slots: { images: "a1,a2" }, id: "img" },
      { type: "boardAdd", items: [{ kind: "image", ref: "a1" }] },
      { type: "removeAsset", id: "a1" },
    ]);
    expect(b.pages[0]!.slots.images).toBe("a2");
    expect(b.board.items).toHaveLength(0);
  });

  it("rejects invalid references and unsafe asset paths", () => {
    expect(() => applyOps(base(), [{ type: "boardAdd", items: [{ kind: "swatch", ref: "nope" }] }])).toThrow(OpError);
    expect(() => applyOps(base(), [{ type: "addAsset", asset: { id: "x", file: "../../etc/passwd" } }])).toThrow(OpError);
  });

  it("masonry packs items into the shortest column", () => {
    const items = [0, 1, 2, 3].map((i) => ({ x: i, y: 0, w: 100, h: i === 0 ? 300 : 100, z: 0 }));
    const out = masonry(items, 2, 210, 10);
    expect(out[0]).toMatchObject({ x: 0, y: 0, w: 100, h: 300 });
    expect(out[1]).toMatchObject({ x: 110, y: 0 });
    expect(out[2]).toMatchObject({ x: 110, y: 110 });
  });
});

describe("svg sanitizer", () => {
  it("strips scripts, handlers and external refs", () => {
    const dirty = `<?xml version="1.0"?><svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)"><rect width="10" height="10" onclick="x()"/></a><image href="https://evil.test/x.png"/><foreignObject><div/></foreignObject></svg>`;
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/script|onload|onclick|javascript|evil\.test|foreignObject/i);
    expect(clean).toMatch(/^<svg xmlns=/);
    expect(clean).toContain("<rect");
  });

  it("rejects non-svg input", () => {
    expect(() => sanitizeSvg("<div>hi</div>")).toThrow();
  });
});

describe("tokens", () => {
  const b = applyOps(base(), [
    {
      type: "setColors",
      colors: [
        { name: "Paper", hex: "#F4F2EE", role: "background" },
        { name: "Ink", hex: "#1C1C1C", role: "text" },
        { name: "Sky", hex: "#90A7CE", role: "primary" },
      ],
    },
    {
      type: "setTypography",
      scale: [
        { name: "Display", font: "display", size: 64, lineHeight: 1.05, tracking: -0.02, weight: 400 },
        { name: "Body", font: "text", size: 16, lineHeight: 1.5, tracking: 0, weight: 400 },
      ],
    },
  ]);

  it("exports CSS variables", () => {
    const css = exportTokens(b, "css").content;
    expect(css).toContain("--color-sky: #90A7CE;");
    expect(css).toContain("--color-sky-500:");
    expect(css).toContain("--background: #F4F2EE;");
    expect(css).toContain("--text-display: 4rem;");
    expect(css).toMatchSnapshot();
  });

  it("exports a Tailwind v4 theme and W3C JSON", () => {
    expect(exportTokens(b, "tailwind").content).toContain("@theme {");
    const w3c = JSON.parse(exportTokens(b, "w3c-json").content);
    expect(w3c.color.sky.$value).toBe("#90A7CE");
    expect(w3c.typography.body.$value.fontSize).toBe("1rem");
    const figma = JSON.parse(exportTokens(b, "figma-variables-json").content);
    expect(figma.collections[0].variables.length).toBeGreaterThan(30);
  });

  it("audit flags low body contrast", () => {
    const low = applyOps(b, [{ type: "updateColor", id: "ink", patch: { hex: "#C8C8C8" } }]);
    expect(auditBrand(low).some((i) => i.severity === "error" && i.area === "accessibility")).toBe(true);
    expect(auditBrand(b).some((i) => i.area === "accessibility" && i.severity === "error")).toBe(false);
  });
});

describe("store", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "guidelines-"));
    process.env.GUIDELINES_DIR = dir;
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("creates, mutates with rev checks, logs activity and undoes", async () => {
    const created = await createBrand({ slug: "demo", meta: { name: "Demo" } }, "agent");
    expect(created.rev).toBe(1);

    const r2 = await mutateBrand("demo", [{ type: "updateMeta", patch: { tagline: "One" } }], { actor: "agent", expectedRev: 1 });
    expect(r2.rev).toBe(2);
    await expect(mutateBrand("demo", [{ type: "updateMeta", patch: { tagline: "Stale" } }], { actor: "designer", expectedRev: 1 })).rejects.toBeInstanceOf(
      ConflictError,
    );

    await mutateBrand("demo", [{ type: "updateMeta", patch: { tagline: "Two" } }], { actor: "designer" });
    expect((await readBrand("demo")).meta.tagline).toBe("Two");

    const u1 = await undoBrand("demo", "designer");
    expect(u1.meta.tagline).toBe("One");
    const u2 = await undoBrand("demo", "designer");
    expect(u2.meta.tagline).toBe("");
    expect(u2.rev).toBe(5);

    const activity = await readActivity("demo");
    expect(activity[0]!.summary).toMatch(/Undo/);
    expect(activity.map((a) => a.actor)).toContain("agent");
  });

  it("can undo the first edit of a brand whose history folder is missing", async () => {
    await createBrand({ slug: "cloned", meta: { name: "Cloned", tagline: "Original" } });
    await rm(path.join(dir, "cloned", "history"), { recursive: true, force: true });
    await mutateBrand("cloned", [{ type: "updateMeta", patch: { tagline: "Edited" } }], { actor: "designer" });
    expect((await undoBrand("cloned", "designer")).meta.tagline).toBe("Original");
  });

  it("serializes concurrent writers", async () => {
    await createBrand({ slug: "race", meta: { name: "Race" } });
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => mutateBrand("race", [{ type: "addPage", layout: "statement", slots: { headline: `H${i}` } }], { actor: "agent" })),
    );
    const b = await readBrand("race");
    expect(b.pages).toHaveLength(10);
    expect(b.rev).toBe(11);
  });
});
