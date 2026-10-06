import { atmosphericGradient, googleFontsHref, readableOn, svgAspect, svgDataUri, type Brand, type Color, type Font } from "@guidelines/core";
import type { CSSProperties, ReactNode } from "react";

export const assetUrl = (slug: string, file: string) =>
  `/api/brands/${encodeURIComponent(slug)}/assets/${file
    .replace(/^assets\//, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

const pick = (b: Brand, ...roles: Color["role"][]) => {
  for (const r of roles) {
    const c = b.colors.find((c) => c.role === r);
    if (c) return c;
  }
  return undefined;
};

const stack = (f: Font) => `"${f.family}", ${f.fallback}`;

export function brandTheme(b: Brand) {
  const bgC = pick(b, "background");
  const bg = bgC?.hex ?? "#F4F3F0";
  const fg = pick(b, "text")?.hex ?? readableOn(bg);
  const primaryC = pick(b, "primary", "accent", "secondary");
  const primary = primaryC?.hex ?? fg;
  const accent = pick(b, "accent", "primary")?.hex ?? primary;
  const neutral = pick(b, "neutral");
  // A panel tone one step away from the page background.
  const panel = neutral?.scale["100"] ?? bgC?.scale["100"] ?? "#E7E6E2";
  const tint = primaryC?.scale["100"] ?? panel;
  const secondary = pick(b, "secondary")?.hex ?? primaryC?.scale["300"] ?? accent;
  // Headline weight and tracking come from the largest display style in the type scale.
  const displayStyle = [...b.typography.scale].filter((s) => s.font === "display").sort((x, y) => y.size - x.size)[0];
  const gradientColors = b.colors
    .filter((c) => c.role !== "text")
    .map((c) => c.hex)
    .slice(0, 4);
  const vars = {
    "--b-bg": bg,
    "--b-fg": fg,
    "--b-primary": primary,
    "--b-primary-ink": readableOn(primary),
    "--b-accent": accent,
    "--b-panel": panel,
    "--b-tint": tint,
    "--b-display": stack(b.typography.display),
    "--b-text": stack(b.typography.text),
    "--b-mono": b.typography.mono ? stack(b.typography.mono) : "ui-monospace, monospace",
    "--b-secondary": secondary,
    "--b-display-weight": displayStyle?.weight ?? 400,
    "--b-display-tracking": `${displayStyle?.tracking ?? -0.02}em`,
    "--b-logo": b.logo.font ? stack(b.logo.font) : stack(b.typography.text),
    "--b-logo-weight": b.logo.wordmarkWeight ?? (b.logo.font ? (b.logo.font.weights[0] ?? 500) : 500),
    "--b-logo-tracking": `${b.logo.wordmarkTracking ?? -0.01}em`,
    "--mark-aspect": svgAspect(b.logo.markSvg),
    "--b-gradient": atmosphericGradient(gradientColors, b.slug.length),
    "--mark": b.logo.markSvg ? `url("${svgDataUri(b.logo.markSvg)}")` : "none",
  } as CSSProperties;
  return { vars, bg, fg, primary, accent, panel };
}

/** Injects brand fonts. React 19 hoists these <link>/<style> tags into <head>. */
export function BrandFonts({ brand }: { brand: Brand }) {
  const fonts = [brand.typography.display, brand.typography.text, brand.typography.mono, brand.logo.font].filter(Boolean) as Font[];
  const google = fonts.filter((f) => f.source === "google");
  const files = fonts.filter((f) => f.source === "file" && f.file);
  // One stylesheet per family, so an unavailable weight in one family can't break the others.
  const hrefs = [...new Set(google.map((f) => googleFontsHref([f])).filter(Boolean) as string[])];
  return (
    <>
      {hrefs.length > 0 && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        </>
      )}
      {hrefs.map((href) => (
        <link key={href} rel="stylesheet" href={href} precedence="brand-fonts" />
      ))}
      {files.length > 0 && (
        <style href={`brand-fonts-${brand.slug}`} precedence="brand-fonts">
          {files
            .map((f) => `@font-face{font-family:"${f.family.replace(/["\\]/g, "")}";src:url("${assetUrl(brand.slug, f.file!)}");font-display:swap;}`)
            .join("\n")}
        </style>
      )}
    </>
  );
}

export function BrandTheme({ brand, children, className, style }: { brand: Brand; children: ReactNode; className?: string; style?: CSSProperties }) {
  const { vars } = brandTheme(brand);
  return (
    <div className={className} style={{ ...vars, ...style }}>
      <BrandFonts brand={brand} />
      {children}
    </div>
  );
}
