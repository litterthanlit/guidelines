import { exportTokens, TOKEN_FORMATS, type TokenFormat } from "@guidelines/core";
import { readBrand } from "@guidelines/core/store";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") ?? "css") as TokenFormat;
    if (!TOKEN_FORMATS.includes(format)) return Response.json({ error: `format must be one of ${TOKEN_FORMATS.join(", ")}` }, { status: 400 });
    const out = exportTokens(await readBrand(slug), format);
    const headers: Record<string, string> = { "Content-Type": `${out.mime}; charset=utf-8`, "Cache-Control": "no-store" };
    if (url.searchParams.get("download")) headers["Content-Disposition"] = `attachment; filename="${out.filename}"`;
    return new Response(out.content, { headers });
  });
}
