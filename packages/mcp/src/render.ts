import type { Browser } from "playwright-core";

/**
 * Screenshots a guideline page from the running studio so the agent can see
 * what it made. Requires `pnpm dev` (or GUIDELINES_APP_URL pointing at a
 * running studio) and a Chromium binary.
 */

export const appUrl = () => (process.env.GUIDELINES_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

let browser: Browser | undefined;

async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;
  const { chromium } = await import("playwright-core");
  const executablePath = process.env.GUIDELINES_CHROMIUM || undefined;
  try {
    browser = await chromium.launch({ executablePath, headless: true });
  } catch (err) {
    try {
      browser = await chromium.launch({ channel: "chrome", headless: true });
    } catch {
      throw new Error(
        `Could not launch Chromium (${(err as Error).message.split("\n")[0]}). ` +
          "Set GUIDELINES_CHROMIUM to a Chrome/Chromium binary, or run `npx playwright install chromium`.",
      );
    }
  }
  return browser;
}

export async function renderPage(slug: string, pageId: string, width = 1440): Promise<Buffer> {
  const url = `${appUrl()}/render/${encodeURIComponent(slug)}/${encodeURIComponent(pageId)}`;
  const b = await getBrowser();
  const height = Math.round((width * 9) / 16);
  const page = await b.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  try {
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: 20_000 }).catch((err: Error) => {
      throw new Error(`Studio not reachable at ${appUrl()} — start it with \`pnpm dev\`. (${err.message.split("\n")[0]})`);
    });
    if (!res || !res.ok()) throw new Error(`Render route returned ${res?.status()} for ${url}`);
    await page.evaluate(() => document.fonts.ready.then(() => true));
    await page.waitForTimeout(150);
    return await page.screenshot({ type: "png", fullPage: false });
  } finally {
    await page.close();
  }
}

export async function closeBrowser() {
  await browser?.close().catch(() => {});
}
