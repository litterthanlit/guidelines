"use client";

import { applyOps, Brand as BrandSchema, type Brand, type OpInput } from "@guidelines/core";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface ActivityEntry {
  rev: number;
  at: string;
  actor: "agent" | "designer" | "system";
  summary: string;
}

export interface Toast {
  id: number;
  tone: "info" | "agent" | "error";
  message: string;
}

type Status = "connecting" | "live" | "offline";

interface StoreValue {
  brand: Brand;
  status: Status;
  saving: boolean;
  activity: ActivityEntry[];
  toasts: Toast[];
  /** Page ids changed by the most recent remote (agent) update, for a brief highlight. */
  flashed: Set<string>;
  apply: (ops: OpInput[]) => Promise<void>;
  undo: () => Promise<void>;
  upload: (file: File, target?: { pageId?: string; slot?: string; append?: boolean; board?: boolean; x?: number; y?: number }) => Promise<string | undefined>;
  toast: (message: string, tone?: Toast["tone"]) => void;
  dismiss: (id: number) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore outside <BrandProvider>");
  return ctx;
}

async function readError(res: Response) {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

async function imageSize(file: File): Promise<{ width?: number; height?: number }> {
  try {
    const bmp = await createImageBitmap(file);
    const out = { width: bmp.width, height: bmp.height };
    bmp.close();
    return out;
  } catch {
    return {};
  }
}

function changedPages(prev: Brand, next: Brand): Set<string> {
  const before = new Map(prev.pages.map((p) => [p.id, JSON.stringify(p)]));
  const out = new Set<string>();
  for (const p of next.pages) if (before.get(p.id) !== JSON.stringify(p)) out.add(p.id);
  // Brand-wide changes (colors, type, logo) touch every page.
  const global = (b: Brand) => JSON.stringify([b.colors, b.typography, b.logo, b.meta.name]);
  if (global(prev) !== global(next)) for (const p of next.pages) out.add(p.id);
  return out;
}

/**
 * Holds the brand on the client. Designer edits apply optimistically through
 * the same pure `applyOps` the server uses, then sync. Server-Sent Events from
 * the file watcher pull in agent edits as they land on disk.
 */
export function BrandProvider({ initial, children }: { initial: Brand; children: ReactNode }) {
  const [brand, setBrand] = useState<Brand>(initial);
  const [status, setStatus] = useState<Status>("connecting");
  const [saving, setSaving] = useState(false);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [flashed, setFlashed] = useState<Set<string>>(new Set());

  const slug = initial.slug;
  const brandRef = useRef(brand);
  brandRef.current = brand;
  const serverRev = useRef(initial.rev);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);
  const stale = useRef(false);
  const toastId = useRef(0);

  const toast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 4200);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const loadActivity = useCallback(async () => {
    const res = await fetch(`/api/brands/${slug}/activity`, { cache: "no-store" });
    if (res.ok) {
      const j = (await res.json()) as { activity: ActivityEntry[] };
      setActivity(j.activity);
      return j.activity;
    }
    return [];
  }, [slug]);

  const accept = useCallback((next: Brand) => {
    if (next.rev < serverRev.current) return;
    serverRev.current = next.rev;
    setBrand(next);
  }, []);

  const refetch = useCallback(
    async (fromRemote: boolean) => {
      const res = await fetch(`/api/brands/${slug}`, { cache: "no-store" });
      if (!res.ok) return;
      const next = BrandSchema.parse(await res.json());
      if (next.rev <= serverRev.current && !fromRemote) return;
      const prev = brandRef.current;
      accept(next);
      if (fromRemote && next.updatedBy === "agent") {
        const changed = changedPages(prev, next);
        setFlashed(changed);
        setTimeout(() => setFlashed(new Set()), 1400);
        const latest = (await loadActivity())[0];
        if (latest?.actor === "agent") toast(latest.summary, "agent");
      } else {
        void loadActivity();
      }
    },
    [slug, accept, loadActivity, toast],
  );

  // Live sync
  useEffect(() => {
    void loadActivity();
    const es = new EventSource(`/api/events?slug=${encodeURIComponent(slug)}`);
    es.onopen = () => setStatus("live");
    es.onerror = () => setStatus(es.readyState === EventSource.CLOSED ? "offline" : "connecting");
    es.addEventListener("brand", (ev) => {
      const e = JSON.parse((ev as MessageEvent).data) as { slug: string; rev: number };
      if (e.slug !== slug || e.rev <= serverRev.current) return;
      if (pending.current > 0) stale.current = true;
      else void refetch(true);
    });
    return () => es.close();
  }, [slug, refetch, loadActivity]);

  const enqueue = useCallback(
    <T,>(task: () => Promise<T>): Promise<T> => {
      pending.current++;
      setSaving(true);
      const run = queue.current.then(task, task);
      queue.current = run.catch(() => {});
      return run.finally(() => {
        pending.current--;
        if (pending.current === 0) {
          setSaving(false);
          if (stale.current) {
            stale.current = false;
            void refetch(true);
          }
        }
      });
    },
    [refetch],
  );

  const apply = useCallback(
    async (ops: OpInput[]) => {
      // Optimistic: show the change immediately using the shared op engine.
      try {
        setBrand((b) => applyOps(b, ops));
      } catch (err) {
        toast((err as Error).message, "error");
        return;
      }
      // Designer ops are field-level merges, so they're applied to the latest
      // server state rather than rejected on rev mismatch.
      await enqueue(async () => {
        const res = await fetch(`/api/brands/${slug}/ops`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ops }),
        });
        if (!res.ok) {
          toast(await readError(res), "error");
          // Roll back the optimistic change to the server's truth.
          const fresh = await fetch(`/api/brands/${slug}`, { cache: "no-store" });
          if (fresh.ok) {
            const b = BrandSchema.parse(await fresh.json());
            serverRev.current = b.rev;
            setBrand(b);
          }
          return;
        }
        accept(BrandSchema.parse(await res.json()));
        void loadActivity();
      });
    },
    [slug, enqueue, toast, accept, refetch, loadActivity],
  );

  const undo = useCallback(async () => {
    await enqueue(async () => {
      const res = await fetch(`/api/brands/${slug}/undo`, { method: "POST" });
      if (!res.ok) return toast(await readError(res), "error");
      accept(BrandSchema.parse(await res.json()));
      void loadActivity();
      toast("Undone");
    });
  }, [slug, enqueue, toast, accept, loadActivity]);

  const upload = useCallback<StoreValue["upload"]>(
    async (file, target) => {
      return enqueue(async () => {
        const form = new FormData();
        form.set("file", file);
        const { width, height } = await imageSize(file);
        if (width) form.set("width", String(width));
        if (height) form.set("height", String(height));
        if (target?.pageId && target.slot) {
          form.set("pageId", target.pageId);
          form.set("slot", target.slot);
          if (target.append) form.set("append", "1");
        }
        if (target?.board) {
          form.set("board", "1");
          if (target.x !== undefined && target.y !== undefined) {
            form.set("x", String(Math.round(target.x)));
            form.set("y", String(Math.round(target.y)));
          }
        }
        const res = await fetch(`/api/brands/${slug}/assets`, { method: "POST", body: form });
        if (!res.ok) {
          toast(await readError(res), "error");
          return undefined;
        }
        const j = (await res.json()) as { brand: Brand; assetId: string };
        accept(BrandSchema.parse(j.brand));
        void loadActivity();
        return j.assetId;
      });
    },
    [slug, enqueue, toast, accept, loadActivity],
  );

  const value = useMemo(
    () => ({ brand, status, saving, activity, toasts, flashed, apply, undo, upload, toast, dismiss }),
    [brand, status, saving, activity, toasts, flashed, apply, undo, upload, toast, dismiss],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
