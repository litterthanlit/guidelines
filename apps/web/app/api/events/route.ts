import { subscribe, type BrandEvent } from "@/lib/watch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Server-Sent Events: pushes `{slug, rev, updatedBy}` whenever a brand.json changes on disk. */
export async function GET(req: Request) {
  const only = new URL(req.url).searchParams.get("slug");
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          cleanup();
        }
      };
      send(": connected\n\n");
      const unsub = subscribe((e: BrandEvent) => {
        if (!only || e.slug === only) send(`event: brand\ndata: ${JSON.stringify(e)}\n\n`);
      });
      const ping = setInterval(() => send(": ping\n\n"), 15_000);
      cleanup = () => {
        clearInterval(ping);
        unsub();
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
