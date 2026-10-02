import { existsSync } from "node:fs";
import { appendFile, mkdir, open, readdir, readFile, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyOps, OpError, summarizeOps, type OpInput } from "./mutations";
import { Brand, Slug, type Actor, type BrandInput } from "./schema";

/**
 * File-backed brand store. Layout per brand:
 *
 *   brands/<slug>/brand.json      current document
 *   brands/<slug>/assets/…        images, fonts
 *   brands/<slug>/history/<rev>.json   snapshots for undo
 *   brands/<slug>/activity.jsonl  who changed what
 *
 * Writes are serialized with a lock file and land atomically via rename, so the
 * MCP server and the web app can safely write concurrently.
 */

export class ConflictError extends Error {
  constructor(
    public readonly expected: number,
    public readonly actual: number,
  ) {
    super(`Brand changed since you read it (you had rev ${expected}, current is rev ${actual}). Re-read and retry.`);
  }
}

export class NotFoundError extends Error {}

const HISTORY_LIMIT = 100;

export function findRoot(start = process.cwd()): string {
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

export function brandsDir(): string {
  return process.env.GUIDELINES_DIR ? path.resolve(process.env.GUIDELINES_DIR) : path.join(findRoot(), "brands");
}

export function brandDir(slug: string): string {
  return path.join(brandsDir(), Slug.parse(slug));
}

const brandFile = (slug: string) => path.join(brandDir(slug), "brand.json");

export interface ActivityEntry {
  rev: number;
  at: string;
  actor: Actor;
  summary: string;
}

export async function listBrands(): Promise<{ slug: string; name: string; rev: number; updatedAt: string; pages: number }[]> {
  const dir = brandsDir();
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    try {
      const b = await readBrand(e.name);
      out.push({ slug: b.slug, name: b.meta.name, rev: b.rev, updatedAt: b.updatedAt, pages: b.pages.length });
    } catch {
      // not a brand folder
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function readBrand(slug: string): Promise<Brand> {
  const file = brandFile(slug);
  if (!existsSync(file)) throw new NotFoundError(`No brand "${slug}". Use list_brands or create_brand.`);
  return Brand.parse(JSON.parse(await readFile(file, "utf8")));
}

export async function brandExists(slug: string): Promise<boolean> {
  return existsSync(brandFile(slug));
}

async function withLock<T>(slug: string, fn: () => Promise<T>): Promise<T> {
  const lock = path.join(brandDir(slug), ".lock");
  const deadline = Date.now() + 5000;
  for (;;) {
    try {
      const fh = await open(lock, "wx");
      await fh.writeFile(String(process.pid));
      await fh.close();
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      // Break stale locks (crashed writer).
      try {
        const s = await stat(lock);
        if (Date.now() - s.mtimeMs > 10_000) await unlink(lock).catch(() => {});
      } catch {}
      if (Date.now() > deadline) throw new Error(`Timed out waiting for lock on "${slug}".`);
      await new Promise((r) => setTimeout(r, 25));
    }
  }
  try {
    return await fn();
  } finally {
    await unlink(lock).catch(() => {});
  }
}

async function writeAtomic(file: string, content: string) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, content);
  await rename(tmp, file);
}

async function persist(slug: string, next: Brand, actor: Actor, summary: string) {
  const dir = brandDir(slug);
  await mkdir(path.join(dir, "history"), { recursive: true });
  const json = JSON.stringify(next, null, 2) + "\n";
  await writeAtomic(path.join(dir, "history", `${next.rev}.json`), json);
  await writeAtomic(brandFile(slug), json);
  const entry: ActivityEntry = { rev: next.rev, at: next.updatedAt, actor, summary };
  await appendFile(path.join(dir, "activity.jsonl"), JSON.stringify(entry) + "\n");
  await pruneHistory(slug, next.rev);
}

/** Snapshot `brand` if its revision has none yet (e.g. a freshly cloned brand), so it can be undone back to. */
async function ensureSnapshot(slug: string, brand: Brand) {
  const file = path.join(brandDir(slug), "history", `${brand.rev}.json`);
  if (existsSync(file)) return;
  await mkdir(path.dirname(file), { recursive: true });
  await writeAtomic(file, JSON.stringify(brand, null, 2) + "\n");
}

async function pruneHistory(slug: string, rev: number) {
  if (rev % 20 !== 0) return;
  const dir = path.join(brandDir(slug), "history");
  const files = await readdir(dir);
  for (const f of files) {
    const n = parseInt(f, 10);
    if (Number.isFinite(n) && n < rev - HISTORY_LIMIT) await rm(path.join(dir, f), { force: true });
  }
}

export async function createBrand(input: BrandInput, actor: Actor = "agent"): Promise<Brand> {
  const slug = Slug.parse(input.slug);
  if (await brandExists(slug)) throw new OpError(`Brand "${slug}" already exists.`);
  await mkdir(path.join(brandDir(slug), "assets"), { recursive: true });
  const brand = Brand.parse({ ...input, slug, rev: 1, updatedAt: new Date().toISOString(), updatedBy: actor });
  await withLock(slug, () => persist(slug, brand, actor, `Created brand “${brand.meta.name}”`));
  return brand;
}

export interface MutateOptions {
  actor: Actor;
  /** Optimistic concurrency: reject if the brand moved past this rev. */
  expectedRev?: number;
  summary?: string;
}

export async function mutateBrand(slug: string, ops: OpInput[], opts: MutateOptions): Promise<Brand> {
  return withLock(slug, async () => {
    const current = await readBrand(slug);
    if (opts.expectedRev !== undefined && opts.expectedRev !== current.rev) {
      throw new ConflictError(opts.expectedRev, current.rev);
    }
    const applied = applyOps(current, ops);
    await ensureSnapshot(slug, current);
    const next: Brand = {
      ...applied,
      rev: current.rev + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: opts.actor,
      restoredFrom: undefined,
    };
    await persist(slug, Brand.parse(next), opts.actor, opts.summary ?? summarizeOps(ops));
    return next;
  });
}

/**
 * Undo walks back one revision at a time. Each undo writes the restored state
 * as a new revision (history is append-only), remembering where it came from so
 * repeated undos keep stepping backwards.
 */
export async function undoBrand(slug: string, actor: Actor): Promise<Brand> {
  return withLock(slug, async () => {
    const current = await readBrand(slug);
    const target = (current.restoredFrom ?? current.rev) - 1;
    if (target < 1) throw new OpError("Nothing to undo.");
    const snap = path.join(brandDir(slug), "history", `${target}.json`);
    if (!existsSync(snap)) throw new OpError("Nothing further to undo (history pruned).");
    const restored = Brand.parse(JSON.parse(await readFile(snap, "utf8")));
    const next: Brand = {
      ...restored,
      rev: current.rev + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
      restoredFrom: target,
    };
    await persist(slug, next, actor, `Undo → restored rev ${target}`);
    return next;
  });
}

export async function readActivity(slug: string, limit = 30): Promise<ActivityEntry[]> {
  const file = path.join(brandDir(slug), "activity.jsonl");
  if (!existsSync(file)) return [];
  const lines = (await readFile(file, "utf8")).trim().split("\n").filter(Boolean);
  return lines
    .slice(-limit)
    .map((l) => JSON.parse(l) as ActivityEntry)
    .reverse();
}

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

export const ALLOWED_ASSET_EXT = Object.keys(MIME);

export function mimeFor(file: string): string | undefined {
  return MIME[path.extname(file).toLowerCase()];
}

/** Resolve an asset path safely inside a brand folder. */
export function assetPath(slug: string, rel: string): string {
  const base = path.join(brandDir(slug), "assets");
  const full = path.resolve(brandDir(slug), rel);
  if (!full.startsWith(base + path.sep)) throw new OpError("Asset path escapes the brand folder.");
  return full;
}

/** Write bytes into brands/<slug>/assets and return the relative file path. */
export async function saveAssetFile(slug: string, name: string, bytes: Uint8Array): Promise<string> {
  const ext = path.extname(name).toLowerCase();
  if (!mimeFor(name)) throw new OpError(`Unsupported asset type "${ext}". Allowed: ${ALLOWED_ASSET_EXT.join(", ")}`);
  if (bytes.byteLength > 25 * 1024 * 1024) throw new OpError("Asset exceeds 25 MB.");
  const stem =
    path
      .basename(name, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "asset";
  const dir = path.join(brandDir(slug), "assets");
  await mkdir(dir, { recursive: true });
  let file = `${stem}${ext}`;
  let n = 2;
  while (existsSync(path.join(dir, file))) file = `${stem}-${n++}${ext}`;
  await writeFile(path.join(dir, file), bytes);
  return `assets/${file}`;
}
