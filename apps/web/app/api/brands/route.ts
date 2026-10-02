import { slugify } from "@guidelines/core";
import { createBrand, listBrands, mutateBrand } from "@guidelines/core/store";
import { z } from "zod";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => Response.json({ brands: await listBrands() }));
}

const Body = z.object({ name: z.string().min(1).max(80), tagline: z.string().max(200).optional() });

export async function POST(req: Request) {
  return handle(async () => {
    const { name, tagline } = Body.parse(await req.json());
    const slug = slugify(name);
    const created = await createBrand(
      { slug, meta: { name, tagline: tagline ?? "" }, logo: { wordmark: name, clearSpace: 0.5, minSize: 24, notes: "" } },
      "designer",
    );
    const brand = await mutateBrand(slug, [{ type: "scaffoldPages" }], { actor: "designer", expectedRev: created.rev });
    return Response.json({ brand }, { status: 201 });
  });
}
