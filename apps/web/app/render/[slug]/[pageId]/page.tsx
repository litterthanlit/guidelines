import { Slide } from "@/components/brand/Slide";
import { BrandTheme } from "@/components/brand/theme";
import { loadBrand } from "@/lib/data";
import { pageAspect } from "@guidelines/core";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** Chrome-less single page, used by the MCP `render_preview` tool and for sharing. */
export default async function RenderPage({ params }: { params: Promise<{ slug: string; pageId: string }> }) {
  const { slug, pageId } = await params;
  const brand = await loadBrand(slug);
  const index = brand.pages.findIndex((p) => p.id === pageId);
  if (index < 0) notFound();
  const page = brand.pages[index]!;
  const [w, h] = pageAspect(page);
  return (
    <BrandTheme brand={brand} className="flex min-h-dvh items-center justify-center bg-black">
      <div style={{ width: `min(100vw, calc(100dvh * ${w} / ${h}))` }}>
        <Slide brand={brand} page={page} index={index} />
      </div>
    </BrandTheme>
  );
}
