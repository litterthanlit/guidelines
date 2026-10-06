import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "../src/server";

type TextResult = { content: { type: string; text?: string }[]; isError?: boolean };

describe("guidelines MCP server", () => {
  let dir: string;
  let client: Client;

  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res = (await client.callTool({ name, arguments: args })) as TextResult;
    const text = res.content.find((c) => c.type === "text")?.text ?? "";
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { res, text, json };
  };

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "guidelines-mcp-"));
    process.env.GUIDELINES_DIR = dir;
    process.env.GUIDELINES_IMAGE_PROVIDER = "gradient";
    const server = createServer();
    const [a, b] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test", version: "1.0.0" });
    await Promise.all([server.connect(a), client.connect(b)]);
  });

  afterAll(async () => {
    await client.close();
    await rm(dir, { recursive: true, force: true });
  });

  it("exposes the expected tools, prompts and resources", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    for (const n of [
      "create_brand",
      "set_palette",
      "set_typography",
      "set_logo",
      "generate_image",
      "render_preview",
      "export_tokens",
      "audit_brand",
      "board_add",
      "list_tiles",
      "add_board",
      "add_tile",
      "update_tile",
      "remove_tile",
    ]) {
      expect(names).toContain(n);
    }
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toEqual(expect.arrayContaining(["brand_kickoff", "review_guidelines"]));
  });

  it("runs a full brand-building session", async () => {
    const created = await call("create_brand", { name: "Halden Bay", tagline: "Quiet tools for loud ideas", keywords: ["calm", "editorial"] });
    expect(created.res.isError).toBeFalsy();
    expect(created.json.slug).toBe("halden-bay");
    expect(created.json.pages.length).toBeGreaterThanOrEqual(6);
    const slug = "halden-bay";

    // Contrast guard rejects unreadable body text…
    const bad = await call("set_palette", {
      slug,
      colors: [
        { name: "Paper", hex: "#FFFFFF", role: "background" },
        { name: "Fog", hex: "#DDDDDD", role: "text" },
      ],
    });
    expect(bad.res.isError).toBe(true);
    expect(bad.text).toMatch(/WCAG AA/);

    // …and accepts a good one.
    const good = await call("set_palette", {
      slug,
      colors: [
        { name: "Paper", hex: "#F2F0EB", role: "background" },
        { name: "Ink", hex: "#222222", role: "text" },
        { name: "Sky", hex: "#90A7CE", role: "primary" },
        { name: "Olive", hex: "#B5B69F", role: "secondary" },
      ],
    });
    expect(good.res.isError).toBeFalsy();
    expect(good.json.contrast.length).toBeGreaterThan(0);

    const typo = await call("set_typography", {
      slug,
      display: { family: "PT Serif" },
      text: { family: "DM Sans" },
      scale: [{ name: "Display", font: "display", size: 72, lineHeight: 1, tracking: -0.02, weight: 400 }],
    });
    expect(typo.res.isError).toBeFalsy();

    const logo = await call("set_logo", {
      slug,
      markSvg: '<svg viewBox="0 0 24 24" onload="x()"><path d="M2 20h20v-4H2z" fill="currentColor"/></svg>',
    });
    expect(logo.res.isError).toBeFalsy();

    const brand = await call("get_brand", { slug, full: true });
    expect(brand.json.logo.markSvg).not.toMatch(/onload/);
    expect(brand.json.typography.display.fallback).toMatch(/serif/);
    const cover = brand.json.pages.find((p: any) => p.layout === "cover");

    const img = await call("generate_image", {
      slug,
      prompt: "soft horizon streaks at dusk",
      alt: "Blurred horizon",
      placeOn: { pageId: cover.id, slot: "image" },
      addToBoard: true,
    });
    expect(img.res.isError).toBeFalsy();
    expect(img.json.provider).toBe("gradient");
    const svg = await readFile(path.join(dir, slug, img.json.file), "utf8");
    expect(svg).toMatch(/^<svg/);

    const after = await call("get_page", { slug, pageId: cover.id });
    expect(after.json.page.slots.image).toBe(img.json.assetId);

    // Stale rev is rejected.
    const stale = await call("update_meta", { slug, tagline: "x", expectedRev: 1 });
    expect(stale.res.isError).toBe(true);
    expect(stale.text).toMatch(/changed since/);

    const tokens = await call("export_tokens", { slug, format: "css" });
    expect(tokens.text).toContain("--color-sky: #90A7CE;");

    const audit = await call("audit_brand", { slug });
    expect(audit.json.issues).toBeInstanceOf(Array);

    const res = await client.readResource({ uri: `brand://${slug}` });
    expect(JSON.parse((res.contents[0] as { text: string }).text).slug).toBe(slug);
  });

  it("composes brand boards", async () => {
    const slug = "board-co";
    await call("create_brand", { name: "Board Co", tagline: "Project memory for coding agents.", scaffold: false });
    await call("set_palette", {
      slug,
      colors: [
        { name: "Ivory", hex: "#F3F1EA", role: "background", traits: ["Balance", "Space"] },
        { name: "Charcoal", hex: "#171A1B", role: "text" },
        { name: "Blue", hex: "#1689D4", role: "primary" },
      ],
    });

    const catalog = await call("list_tiles");
    expect(catalog.json.tiles.map((t: any) => t.kind)).toContain("hero");
    expect(catalog.json.artStyles.map((a: any) => a.id)).toEqual(expect.arrayContaining(["burst", "flow", "orb"]));
    expect(catalog.json.templates.map((t: any) => t.id)).toEqual(expect.arrayContaining(["overview", "system", "index", "blank"]));

    const board = await call("add_board", { slug, template: "system", id: "system" });
    expect(board.res.isError).toBeFalsy();
    expect(board.json.pageId).toBe("system");
    expect(board.json.tiles.some((t: any) => t.kind === "palette")).toBe(true);

    const hero = board.json.tiles.find((t: any) => t.kind === "hero");
    const upd = await call("update_tile", {
      slug,
      pageId: "system",
      tileId: hero.id,
      slots: { headline: "Every session.\nSame context.", art: "burst:4" },
      tone: "light",
    });
    expect(upd.res.isError).toBeFalsy();
    expect(upd.json.tile.tone).toBe("light");
    expect(upd.json.tile.slots.art).toBe("burst:4");

    const outside = await call("update_tile", { slug, pageId: "system", tileId: hero.id, x: 10 });
    expect(outside.res.isError).toBe(true);
    expect(outside.text).toMatch(/columns/);

    const blank = await call("add_board", { slug, template: "blank", id: "blank" });
    const added = await call("add_tile", { slug, pageId: blank.json.pageId, kind: "art", slots: { art: "orb:2" } });
    expect(added.json.tiles).toHaveLength(1);
    const removed = await call("remove_tile", { slug, pageId: blank.json.pageId, tileId: added.json.tiles[0].id });
    expect(removed.res.isError).toBeFalsy();

    const art = await call("generate_image", { slug, prompt: "brand artwork", art: "flow:3", tone: "dark", alt: "Line flow" });
    expect(art.res.isError).toBeFalsy();
    const svg = await readFile(path.join(dir, slug, art.json.file), "utf8");
    expect(svg).toContain("#171A1B");

    const logo = await call("set_logo", { slug, wordmark: "board", wordmarkFont: { family: "Michroma" }, wordmarkTracking: 0.02 });
    expect(logo.res.isError).toBeFalsy();
    const full = await call("get_brand", { slug, full: true });
    expect(full.json.logo).toMatchObject({ wordmark: "board", wordmarkTracking: 0.02, font: { family: "Michroma" } });
    expect(full.json.colors[0].traits).toEqual(["Balance", "Space"]);
  });
});
