import { makeId, type OpInput } from "@guidelines/core";
import { mutateBrand, readBrand, saveAssetFile } from "@guidelines/core/store";
import { handle } from "@/lib/http";

/**
 * Upload an image (multipart: file, alt?, width?, height?, pageId?, slot?, board?).
 * Optionally places it into a page slot and/or onto the moodboard in the same revision.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Missing file" }, { status: 400 });
    if (!file.type.startsWith("image/")) return Response.json({ error: "Only images can be uploaded here" }, { status: 400 });
    const rel = await saveAssetFile(slug, file.name || "upload.png", new Uint8Array(await file.arrayBuffer()));
    const num = (k: string) => {
      const v = Number(form.get(k));
      return Number.isFinite(v) && v > 0 ? Math.round(v) : undefined;
    };
    const id = makeId("img");
    const width = num("width");
    const height = num("height");
    const alt = String(form.get("alt") ?? "") || file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    const ops: OpInput[] = [{ type: "addAsset", asset: { id, file: rel, alt, caption: "", credit: "", width, height } }];

    const pageId = form.get("pageId");
    const slot = form.get("slot");
    if (typeof pageId === "string" && typeof slot === "string" && pageId && slot) {
      const brand = await readBrand(slug);
      const page = brand.pages.find((p) => p.id === pageId);
      const prev = page?.slots[slot]?.trim();
      const append = form.get("append") === "1" && prev;
      ops.push({ type: "updatePage", id: pageId, slots: { [slot]: append ? `${prev},${id}` : id } });
    }
    if (form.get("board") === "1") {
      const x = Number(form.get("x"));
      const y = Number(form.get("y"));
      const ratio = width && height ? height / width : 0.75;
      ops.push({
        type: "boardAdd",
        items: [{ kind: "image", ref: id, w: 360, h: Math.round(360 * ratio), ...(Number.isFinite(x) && form.has("x") ? { x, y } : {}) }],
      });
    }
    const brand = await mutateBrand(slug, ops, { actor: "designer", summary: `Uploaded ${file.name}` });
    return Response.json({ brand, assetId: id }, { status: 201 });
  });
}
