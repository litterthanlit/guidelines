// Visual smoke test: screenshots the studio and every guideline page.
//   pnpm dev            (in another terminal)
//   pnpm --filter @guidelines/web smoke [slug] [outDir]
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const base = process.env.GUIDELINES_APP_URL ?? "http://localhost:3000";
const slug = process.argv[2] ?? "meridian";
const out = process.argv[3] ?? "./smoke";
await mkdir(out, { recursive: true });

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined;
const args = process.env.GUIDELINES_CHROMIUM_ARGS?.split(" ").filter(Boolean) ?? [];
const browser = await chromium.launch({ executablePath: process.env.GUIDELINES_CHROMIUM || undefined, proxy, args });
const errors = [];

async function shot(path, file, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => errors.push(`${path}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${path}: ${m.text()}`));
  const res = await page.goto(base + path, { waitUntil: "networkidle" });
  if (!res?.ok()) errors.push(`${path}: HTTP ${res?.status()}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${file}.png`, fullPage: false });
  await page.close();
}

const brand = await (await fetch(`${base}/api/brands/${slug}`)).json();
await shot("/", "home", { width: 1440, height: 900 });
await shot("/", "home-mobile", { width: 390, height: 844 });
await shot(`/b/${slug}`, "studio", { width: 1440, height: 900 });
await shot(`/b/${slug}`, "studio-mobile", { width: 390, height: 844 });
await shot(`/b/${slug}/board`, "board", { width: 1440, height: 900 });
await shot(`/b/${slug}/tokens`, "tokens", { width: 1440, height: 900 });
for (const [i, p] of brand.pages.entries()) {
  await shot(`/render/${slug}/${p.id}`, `page-${String(i + 1).padStart(2, "0")}-${p.layout}`, { width: 1440, height: 810 });
}
await shot(`/render/${slug}/${brand.pages[0].id}`, "page-01-mobile", { width: 390, height: 844 });
await browser.close();

if (errors.length) {
  console.error(`✗ ${errors.length} problems:\n${errors.join("\n")}`);
  process.exit(1);
}
console.log(`✓ ${brand.pages.length + 7} screenshots in ${out}`);
