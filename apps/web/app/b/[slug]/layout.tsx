import { StudioBar } from "@/components/studio/StudioBar";
import { Toasts } from "@/components/studio/Toasts";
import { BrandProvider } from "@/components/studio/store";
import { loadBrand } from "@/lib/data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const brand = await loadBrand(slug);
  return { title: brand.meta.name };
}

export default async function BrandLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await loadBrand(slug);
  return (
    <BrandProvider initial={brand}>
      <div className="flex h-dvh flex-col">
        <StudioBar />
        <main className="min-h-0 flex-1">{children}</main>
      </div>
      <Toasts />
    </BrandProvider>
  );
}
