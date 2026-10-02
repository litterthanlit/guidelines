import { Op } from "@guidelines/core";
import { mutateBrand } from "@guidelines/core/store";
import { z } from "zod";
import { handle } from "@/lib/http";

const Body = z.object({
  ops: z.array(Op).min(1).max(200),
  expectedRev: z.number().int().optional(),
});

/** Designer edits from the studio. Same op language and store as the agent. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const { ops, expectedRev } = Body.parse(await req.json());
    const brand = await mutateBrand(slug, ops, { actor: "designer", expectedRev });
    return Response.json(brand);
  });
}
