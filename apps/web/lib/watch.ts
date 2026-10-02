import "server-only";
import { brandsDir } from "@guidelines/core/store";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { EventEmitter } from "node:events";

export interface BrandEvent {
  slug: string;
  rev: number;
  updatedBy: string;
}

type Hub = { emitter: EventEmitter; started: boolean; last: Map<string, number> };

// Survive dev hot-reloads: one watcher per process.
const g = globalThis as unknown as { __guidelinesHub?: Hub };
const hub: Hub = (g.__guidelinesHub ??= { emitter: new EventEmitter(), started: false, last: new Map() });
hub.emitter.setMaxListeners(200);

async function start() {
  if (hub.started) return;
  hub.started = true;
  const { watch } = await import("chokidar");
  const root = brandsDir();
  const watcher = watch(root, {
    ignoreInitial: true,
    depth: 1,
    ignored: (p: string) => /[/\\](history|assets|exports)([/\\]|$)/.test(p) || /\.tmp$/.test(p),
    awaitWriteFinish: { stabilityThreshold: 40, pollInterval: 20 },
  });
  const onFile = async (file: string) => {
    if (path.basename(file) !== "brand.json") return;
    const slug = path.basename(path.dirname(file));
    try {
      const doc = JSON.parse(await readFile(file, "utf8")) as { rev?: number; updatedBy?: string };
      const rev = doc.rev ?? 0;
      if (hub.last.get(slug) === rev) return;
      hub.last.set(slug, rev);
      hub.emitter.emit("brand", { slug, rev, updatedBy: doc.updatedBy ?? "system" } satisfies BrandEvent);
    } catch {
      // partially written; the next event will catch up
    }
  };
  watcher.on("add", onFile).on("change", onFile);
}

export function subscribe(fn: (e: BrandEvent) => void): () => void {
  void start();
  hub.emitter.on("brand", fn);
  return () => hub.emitter.off("brand", fn);
}
