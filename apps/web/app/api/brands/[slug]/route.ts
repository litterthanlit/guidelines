import { readBrand } from "@guidelines/core/store";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await ctx.params;
    return Response.json(await readBrand(slug), { headers: { "Cache-Control": "no-store" } });
  });
}
