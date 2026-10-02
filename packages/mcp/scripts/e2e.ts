/**
 * End-to-end check of the agent ⇄ designer loop. Requires the studio running
 * (`pnpm dev`). Spawns the real stdio MCP server, drives it like an agent, and
 * watches the studio in a headless browser.
 *
 *   pnpm --filter @guidelines/mcp e2e
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = process.env.GUIDELINES_APP_URL ?? "http://localhost:3000";
const slug = `e2e-${Date.now().toString(36)}`;
const brandsDir = process.env.GUIDELINES_DIR ?? path.resolve(here, "../../../brands");

const client = new Client({ name: "e2e", version: "1.0.0" });
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve(here, "../bin/guidelines-mcp.mjs")],
    env: { ...(process.env as Record<string, string>), GUIDELINES_DIR: brandsDir, GUIDELINES_IMAGE_PROVIDER: "gradient" },
    stderr: "pipe",
  }),
);

type Content = { type: string; text?: string; data?: string };
async function tool(name: string, args: Record<string, unknown>) {
  const res = (await client.callTool({ name, arguments: args })) as { content: Content[]; isError?: boolean };
  const text = res.content.find((c) => c.type === "text")?.text ?? "";
  if (res.isError) throw new Error(`${name} failed: ${text}`);
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {}
  return { res, text, json };
}

const step = (msg: string) => console.log(`• ${msg}`);
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined;
const browser = await chromium.launch({
  executablePath: process.env.GUIDELINES_CHROMIUM || undefined,
  proxy,
  args: process.env.GUIDELINES_CHROMIUM_ARGS?.split(" ").filter(Boolean) ?? [],
});

try {
  step(`agent creates brand "${slug}"`);
  await tool("create_brand", { name: "E2E Studio", slug, tagline: "Testing, quietly." });
  await tool("set_palette", {
    slug,
    colors: [
      { name: "Paper", hex: "#F5F3EE", role: "background" },
      { name: "Ink", hex: "#1D1D1D", role: "text" },
      { name: "Signal", hex: "#3B5BDB", role: "primary" },
    ],
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (process.env.E2E_DEBUG) page.on("request", (r) => r.method() === "POST" && console.log("  POST", r.url(), r.postData()?.slice(0, 160)));
  await page.goto(`${app}/b/${slug}`, { waitUntil: "networkidle" });
  await page.getByText("Live", { exact: true }).waitFor({ timeout: 10_000 });
  step("studio open and live");

  const brand = (await tool("get_brand", { slug })).json;
  const cover = brand.pages.find((p: { layout: string }) => p.layout === "cover").id;
  const statement = brand.pages.find((p: { layout: string }) => p.layout === "statement").id;

  step("agent edits the cover title → studio updates without reload");
  await tool("update_page", { slug, pageId: cover, slots: { title: "Live from the agent" }, expectedRev: brand.rev });
  await page.locator(".slide h1", { hasText: "Live from the agent" }).first().waitFor({ timeout: 8_000 });
  await page.getByText("Edited page", { exact: false }).first().waitFor({ timeout: 8_000 });

  step("designer types a statement headline inline → agent reads it back");
  const headline = page.locator(`[data-layout="statement"] [data-slot="headline"]`).first();
  await headline.scrollIntoViewIfNeeded();
  await headline.click();
  await page.keyboard.type("Written by a human");
  // Headlines are multiline: Enter adds a line, ⌘/Ctrl+Enter commits.
  await page.keyboard.press("Control+Enter");
  let got = "";
  for (let i = 0; i < 40 && got !== "Written by a human"; i++) {
    await new Promise((r) => setTimeout(r, 150));
    got = (await tool("get_page", { slug, pageId: statement })).json.page.slots.headline;
  }
  if (got !== "Written by a human") throw new Error(`Agent saw headline "${got}"`);
  const after = (await tool("get_brand", { slug })).json;
  if (after.updatedBy !== "designer") throw new Error(`Expected updatedBy designer, got ${after.updatedBy}`);

  step("agent's stale write is rejected after the designer edit");
  const stale = (await client.callTool({ name: "update_meta", arguments: { slug, tagline: "stale", expectedRev: brand.rev } })) as { isError?: boolean };
  if (!stale.isError) throw new Error("Stale write was not rejected");

  step("agent generates an image onto the cover");
  await tool("generate_image", { slug, prompt: "horizon streaks", alt: "Soft horizon", placeOn: { pageId: cover, slot: "image" } });
  await page.locator(`[data-layout="cover"] img`).first().waitFor({ timeout: 8_000 });

  step("agent renders a preview");
  const shot = await tool("render_preview", { slug, page: 1 });
  const img = shot.res.content.find((c) => c.type === "image");
  if (!img?.data || img.data.length < 10_000) throw new Error("render_preview returned no image");

  step("designer undo restores the previous image slot");
  await page.getByRole("button", { name: /Undo/ }).first().click();
  await page.locator(`[data-layout="cover"] img`).first().waitFor({ state: "detached", timeout: 8_000 });

  if (errors.length) throw new Error(`Page errors:\n${errors.join("\n")}`);
  console.log("✓ agent ⇄ studio loop works");
} finally {
  await browser.close();
  await client.close();
  await rm(path.join(brandsDir, slug), { recursive: true, force: true });
}
