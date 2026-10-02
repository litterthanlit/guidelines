import { Slide } from "@/components/brand/Slide";
import { BrandTheme } from "@/components/brand/theme";
import { CopyButton } from "@/components/studio/CopyButton";
import { StudioMark } from "@/components/studio/Logo";
import { NewBrand } from "@/components/studio/NewBrand";
import { findRoot } from "@guidelines/core/store";
import { listBrands, readBrand } from "@guidelines/core/store";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default async function Home() {
  const list = await listBrands();
  const brands = await Promise.all(list.map((b) => readBrand(b.slug)));
  const root = findRoot();
  const command = `claude mcp add guidelines -- node ${root}/packages/mcp/bin/guidelines-mcp.mjs`;

  return (
    <div className="mx-auto max-w-[1360px] px-4 pb-24 sm:px-8">
      <header className="flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-medium tracking-tight">
          <StudioMark />
          Guidelines
        </Link>
        <span className="label hidden sm:block">Brand studio · MCP</span>
      </header>

      <section className="grid gap-10 pt-14 pb-20 md:grid-cols-12 md:pt-24" aria-labelledby="hero">
        <div className="md:col-span-7">
          <p className="label">[001] Studio</p>
          <h1 id="hero" className="mt-5 max-w-[14ch] text-[clamp(2.4rem,5.4vw,4.4rem)] leading-[1.02] font-medium tracking-[-0.035em] text-balance">
            Brand systems, co-authored with your agent.
          </h1>
          <p className="mt-6 max-w-[52ch] text-[15px] text-ink-2">
            Interview, palette, type, logomark, imagery, copy — the agent drafts through MCP while you watch every page update live, then refine anything by
            hand. Export tokens when it&rsquo;s right.
          </p>
          <div className="mt-8">
            <NewBrand />
          </div>
        </div>
        <ol className="flex flex-col gap-px self-end overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line md:col-span-5">
          {[
            ["Connect", "Add the MCP server to Claude Code, Claude Desktop or Cursor.", command],
            ["Brief", "Run the brand_kickoff prompt. The agent interviews you, then drafts the whole system.", null],
            ["Refine", "Edit text inline, drop images, tweak colors — the agent sees your changes too.", null],
          ].map(([title, body, code], i) => (
            <li key={title} className="bg-surface p-5">
              <div className="flex items-baseline gap-3">
                <span className="label">0{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-medium">{title}</h2>
                  <p className="mt-1 text-ink-2">{body}</p>
                  {code && (
                    <div className="mt-3 flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded-lg bg-sunken px-3 py-2 font-mono text-[12px]">{code}</code>
                      <CopyButton text={code} />
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="brands-h">
        <div className="mb-5 flex items-baseline justify-between border-t border-line pt-5">
          <h2 id="brands-h" className="label">
            [002] Brands — {brands.length}
          </h2>
        </div>
        {brands.length === 0 ? (
          <p className="py-16 text-center text-ink-3">No brands yet. Create one above, or ask your agent to run the brand_kickoff prompt.</p>
        ) : (
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((b) => {
              const cover = b.pages.find((p) => p.layout === "cover") ?? b.pages[0];
              return (
                <li key={b.slug} className="animate-fade-up">
                  <Link href={`/b/${b.slug}`} className="group block rounded-[10px] focus-visible:outline-offset-4">
                    <div className="overflow-hidden rounded-[10px] shadow-float transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lift">
                      {cover ? (
                        <BrandTheme brand={b}>
                          <Slide brand={b} page={cover} index={b.pages.indexOf(cover)} responsive={false} />
                        </BrandTheme>
                      ) : (
                        <div className="aspect-video bg-sunken" />
                      )}
                    </div>
                    <div className="mt-3 flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-medium">{b.meta.name}</h3>
                        <p className="truncate text-[13px] text-ink-3">{b.meta.tagline || `${b.pages.length} pages`}</p>
                      </div>
                      <span className="label shrink-0">
                        rev {b.rev} · {ago(b.updatedAt)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
