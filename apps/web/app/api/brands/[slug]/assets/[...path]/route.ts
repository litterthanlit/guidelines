import { assetPath, mimeFor } from "@guidelines/core/store";
import { readFile } from "node:fs/promises";
import { handle } from "@/lib/http";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; path: string[] }> }) {
  return handle(async () => {
    const { slug, path } = await ctx.params;
    const rel = `assets/${path.map(decodeURIComponent).join("/")}`;
    const mime = mimeFor(rel);
    if (!mime) return new Response("Not found", { status: 404 });
    let bytes: Buffer;
    try {
      bytes = await readFile(assetPath(slug, rel));
    } catch {
      return new Response("Not found", { status: 404 });
    }
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mime,
        // Asset files are never overwritten (unique names), so they cache well.
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
        // SVGs opened directly must not run script.
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      },
    });
  });
}
