import { undoBrand } from "@guidelines/core/store";
import { handle } from "@/lib/http";

export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await ctx.params;
    return Response.json(await undoBrand(slug, "designer"));
  });
}
