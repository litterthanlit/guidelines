import { Slide } from "@/components/brand/Slide";
import { BrandTheme } from "@/components/brand/theme";
import { loadBrand } from "@/lib/data";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** Chrome-less single page, used by the MCP `render_preview` tool and for sharing. */
export default async function RenderPage({ params }: { params: Promise<{ slug: string; pageId: string }> }) {
  const { slug, pageId } = await params;
  const brand = await loadBrand(slug);
  const index = brand.pages.findIndex((p) => p.id === pageId);
  if (index < 0) notFound();
  return (
    <BrandTheme brand={brand} className="flex min-h-dvh items-center justify-center bg-black">
      <div style={{ width: "min(100vw, calc(100dvh * 16 / 9))" }}>
        <Slide brand={brand} page={brand.pages[index]!} index={index} />
      </div>
    </BrandTheme>
  );
}
