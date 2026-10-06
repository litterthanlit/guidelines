"use client";

import { ART_FOCUS, boardRows, contrastRatio, parseArt, TILES, tileAspect, type Brand, type Color, type Tile, type TileKind } from "@guidelines/core";
import type { ComponentType, CSSProperties, KeyboardEvent, ReactNode } from "react";
import { Art } from "./Art";
import { assetFor, DropZone, Lockup, Mark, SlotImage, SlotText, TileContext, useEdit, useSlide, useTile, type MarkFill } from "./slots";
import { brandTheme } from "./theme";

/*
 * Brand boards: a bento grid of tiles. Type is set in --u (1% of the board's
 * width) so the whole composition scales as one; each tile is also a size
 * container, so its internals can use cqw/cqh to fit their own box.
 */

const lines = (v: string | undefined) =>
  (v ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

const artTone = (t: Tile) => (t.tone === "dark" ? "dark" : "light");

/** Empty optional slots show their placeholder only on the selected tile, so boards stay clean while editing. */
function usePrompting() {
  const { page } = useSlide();
  const tile = useTile();
  const edit = useEdit();
  return !!edit && !!tile && edit.selectedTile === `${page.id}/${tile.id}`;
}

interface TileProps {
  tile: Tile;
  /** Width ÷ height of the tile on the board. */
  aspect: number;
}

/* ─────────────────────────────── board ─────────────────────────────── */

export function BoardLayout() {
  const { page } = useSlide();
  const edit = useEdit();
  const rows = boardRows(page.slots);
  const tiles = page.tiles ?? [];
  return (
    <div
      className="board"
      data-frame={page.slots.frame ?? "rules"}
      style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) edit?.selectTile?.(page.id, null);
      }}
    >
      {tiles.map((t) => (
        <TileFrame key={t.id} tile={t} />
      ))}
      {!tiles.length && <div className="s-empty">{edit ? "Empty board — add tiles from the inspector, or ask the agent to compose one." : ""}</div>}
    </div>
  );
}

const RENDERERS: Record<TileKind, ComponentType<TileProps>> = {
  logo: LogoTile,
  hero: HeroTile,
  art: ArtTile,
  palette: PaletteTile,
  type: TypeTile,
  steps: StepsTile,
  poster: PosterTile,
  web: WebTile,
  text: TextTile,
};

function TileFrame({ tile }: { tile: Tile }) {
  const { page } = useSlide();
  const edit = useEdit();
  const Renderer = RENDERERS[tile.kind];
  const key = `${page.id}/${tile.id}`;
  const aspect = tileAspect(page.slots, tile);
  const select = () => edit?.selectTile?.(page.id, tile.id);
  return (
    <TileContext.Provider value={tile}>
      <div
        className="tile"
        data-kind={tile.kind}
        data-tone={tile.tone}
        data-selected={edit?.selectedTile === key || undefined}
        role="group"
        aria-label={tile.label || `${TILES[tile.kind].name} tile`}
        tabIndex={edit ? 0 : undefined}
        onPointerDownCapture={edit ? select : undefined}
        onFocus={edit ? select : undefined}
        onKeyDown={
          edit
            ? (e: KeyboardEvent) => {
                if (e.target === e.currentTarget && e.key === "Enter") select();
              }
            : undefined
        }
        style={{ gridArea: `${tile.y + 1} / ${tile.x + 1} / span ${tile.h} / span ${tile.w}`, ["--tile-ar" as string]: aspect.toFixed(3) }}
      >
        {tile.label && <span className="tile-label">{tile.label}</span>}
        <div className="tile-body">
          <Renderer tile={tile} aspect={aspect} />
        </div>
      </div>
    </TileContext.Provider>
  );
}

/* ─────────────────────────────── shared bits ─────────────────────────────── */

/** Full-bleed image or artwork behind a tile. Images win; drop an image to replace the art. */
function TileMedia({ tile, aspect, spec, className }: TileProps & { spec?: string; className?: string }) {
  const { brand } = useSlide();
  const edit = useEdit();
  const art = spec ?? tile.slots.art;
  if (assetFor(brand, tile.slots.image)) return <SlotImage k="image" />;
  if (!parseArt(art) && !edit) return null;
  return (
    <DropZone slot="image" className={`absolute inset-0 ${className ?? ""}`}>
      <Art brand={brand} spec={art} tone={artTone(tile)} aspect={aspect} />
    </DropZone>
  );
}

/** Registration cross used to annotate corners. */
function Cross({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={`t-cross ${className ?? ""}`} style={style}>
      <path d="M10 0v20M0 10h20" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" fill="none" />
    </svg>
  );
}

function Label({
  k,
  placeholder,
  rule,
  short,
  trailing,
  fallback,
}: {
  k: string;
  placeholder: string;
  rule?: boolean;
  /** A short dash of rule after the label instead of one running to the edge. */
  short?: boolean;
  trailing?: ReactNode;
  fallback?: string;
}) {
  return (
    <div className="t-labelrow">
      <SlotText k={k} className="s-label" placeholder={placeholder} fallback={fallback} />
      {rule && <span aria-hidden className={`t-rule-h ${short ? "is-short" : ""}`} />}
      {trailing}
    </div>
  );
}

function Arrow() {
  return (
    <svg aria-hidden viewBox="0 0 24 12" className="t-arrow">
      <path d="M0 6h22M17 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Button({ k, placeholder, variant = "pill" }: { k: string; placeholder: string; variant?: "pill" | "rect" }) {
  return (
    <span className={`t-button ${variant === "rect" ? "is-rect" : ""}`}>
      <SlotText k={k} placeholder={placeholder} />
      <Arrow />
    </span>
  );
}

/* ─────────────────────────────── logo ─────────────────────────────── */

const LOGO_SIZE = { s: "4.4cqw", m: "6.2cqw", l: "7.8cqw" } as const;

function LogoTile({ tile, aspect }: TileProps) {
  const s = tile.slots;
  const show = (s.show as "lockup" | "mark" | "wordmark") ?? "lockup";
  const align = s.align ?? "center";
  const size = `min(${LOGO_SIZE[(s.size as keyof typeof LOGO_SIZE) ?? "m"] ?? LOGO_SIZE.m}, ${show === "mark" ? 14 : 22}cqh)`;
  const fill = (s.markStyle as MarkFill) ?? "solid";
  const prompting = usePrompting();
  const hasCaption = !!s.caption || prompting;
  const lockup = <Lockup size={size} show={show} fill={fill} />;
  return (
    <>
      {(s.art || s.image) && <TileMedia tile={tile} aspect={aspect} />}
      {align === "left" ? (
        <div className="t-pad relative flex h-full flex-col">
          <div className="flex flex-1 items-center">{lockup}</div>
          {hasCaption && (
            <div>
              <span aria-hidden className="t-rule-h block" />
              <SlotText k="caption" className="s-label" style={{ marginTop: "7cqh", whiteSpace: "pre-line" }} placeholder="Caption" multiline />
            </div>
          )}
        </div>
      ) : align === "bottom-right" ? (
        <div className="t-pad relative flex h-full flex-col items-end justify-end">{lockup}</div>
      ) : (
        <div className="t-pad relative flex h-full flex-col items-center justify-center text-center">
          {lockup}
          {s.caption && <SlotText k="caption" className="s-label" style={{ marginTop: "6cqh", whiteSpace: "pre-line" }} multiline />}
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────── hero ─────────────────────────────── */

const HERO_SIZE = { m: 3.4, l: 5, xl: 6.6 } as const;

function HeroTile({ tile, aspect }: TileProps) {
  const s = tile.slots;
  const edit = usePrompting();
  const align = s.align ?? "top-left";
  const centered = align === "center";
  const size = HERO_SIZE[(s.size as keyof typeof HERO_SIZE) ?? "l"] ?? HERO_SIZE.l;
  const index = lines(s.index);
  const art = parseArt(s.art);
  const focus = (art && ART_FOCUS[art.style]) ?? [0.5, 0.5];
  return (
    <>
      <TileMedia tile={tile} aspect={aspect} />
      {s.fade === "top" && <div aria-hidden className="t-fade" />}
      {s.mark === "center" && !centered && (
        <Mark
          size="11cqh"
          fill="gradient"
          className="t-mark-glow t-mark-inart absolute"
          style={{ left: `${focus[0] * 100}%`, top: `${focus[1] * 100}%`, transform: "translate(-50%, -50%)" }}
        />
      )}
      <div
        className={`t-pad relative flex h-full flex-col ${centered ? "items-center justify-center text-center" : align === "bottom-left" ? "justify-end" : ""}`}
      >
        {(s.eyebrow || edit) && <Label k="eyebrow" placeholder="Eyebrow" rule={!centered} short />}
        {centered && s.mark === "center" && (
          <Mark size={`calc(var(--u) * ${size * 0.42})`} fill="gradient" className="t-mark-glow" style={{ marginBottom: `calc(var(--u) * ${size * 0.3})` }} />
        )}
        <SlotText
          k="headline"
          as="h3"
          className="s-display t-headline"
          style={{
            fontSize: `min(calc(var(--u) * ${size}), ${size * 4.2}cqw)`,
            marginTop: centered ? 0 : `calc(var(--u) * ${size * 0.55})`,
            maxWidth: centered ? "16ch" : "11ch",
          }}
          placeholder="Headline"
          multiline
        />
        {(s.subhead || edit) && (
          <SlotText
            k="subhead"
            className={centered ? "s-label t-accent" : s.subStyle === "label" ? "s-label t-sublabel" : "t-mono-copy"}
            style={{ marginTop: `calc(var(--u) * ${centered ? 1.4 : 1.2})`, maxWidth: centered || s.subStyle === "label" ? undefined : "32ch" }}
            placeholder="Subhead"
            multiline
          />
        )}
        {s.cta && (
          <div style={{ marginTop: "calc(var(--u) * 1.6)", fontSize: "calc(var(--u) * 0.72)" }}>
            <Button k="cta" placeholder="Button" />
          </div>
        )}
      </div>
      {index.length > 0 && (
        <ol className="t-index" aria-label="Index">
          <Cross className="t-index-cross is-top" />
          {index.map((item, i) => (
            <li key={item}>
              <span>{item}</span>
              <span>{String(i + 1).padStart(2, "0")}</span>
            </li>
          ))}
          <Cross className="t-index-cross is-bottom" />
        </ol>
      )}
      {s.noteLeft && (
        <div className="t-note is-left">
          <Cross />
          <SlotText k="noteLeft" className="s-label" style={{ whiteSpace: "pre-line" }} multiline />
        </div>
      )}
      {s.noteRight && (
        <div className="t-note is-right">
          <SlotText k="noteRight" className="s-label" style={{ whiteSpace: "pre-line" }} multiline />
          <Cross />
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────── art ─────────────────────────────── */

function ArtTile({ tile, aspect }: TileProps) {
  const s = tile.slots;
  return (
    <>
      <TileMedia tile={tile} aspect={aspect} />
      {s.mark === "center" && (
        <div className="absolute inset-0 grid place-items-center">
          <Mark size="16cqh" className="t-mark-glow" />
        </div>
      )}
      {s.mark === "corner" && <Mark size="7cqh" className="absolute" style={{ right: "6cqw", bottom: "6cqh" }} />}
      {(s.label || s.caption) && (
        <div className="t-pad pointer-events-none relative flex h-full flex-col">
          {s.label && <Label k="label" placeholder="Label" rule />}
          {s.caption && <SlotText k="caption" className="s-label mt-auto" />}
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────── palette ─────────────────────────────── */

function surfaceHex(brand: Brand, tile: Tile): string {
  const t = brandTheme(brand);
  return tile.tone === "dark" ? t.fg : tile.tone === "panel" ? t.panel : tile.tone === "brand" ? t.primary : t.bg;
}

function PaletteTile({ tile }: TileProps) {
  const { brand } = useSlide();
  const s = tile.slots;
  const ids = (s.colors ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const colors = (ids.length ? ids.map((id) => brand.colors.find((c) => c.id === id)).filter(Boolean) : brand.colors).slice(0, 6) as Color[];
  const surface = surfaceHex(brand, tile);
  const columns = s.style === "columns";
  return (
    <div className="t-pad flex h-full flex-col">
      {s.header === "lockup" ? (
        <div>
          <Lockup size="min(6.4cqw, 9cqh)" />
          {s.caption && <SlotText k="caption" className="s-label" style={{ marginTop: "4cqh", whiteSpace: "pre-line" }} multiline />}
          <span aria-hidden className="t-rule-h block" style={{ marginTop: "5cqh" }} />
        </div>
      ) : (
        <Label k="label" placeholder="Palette" fallback="Palette" />
      )}
      <ul
        className="grid min-h-0 flex-1"
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, colors.length)}, minmax(0, 1fr))`,
          gap: columns ? "4cqw" : "2.6cqw",
          marginTop: columns ? "7cqh" : "6cqh",
        }}
        aria-label="Brand colors"
      >
        {colors.map((c) => {
          const outline = contrastRatio(c.hex, surface) < 1.25;
          return (
            <li key={c.id} className="flex min-h-0 min-w-0 flex-col">
              <div
                className="t-swatch min-h-0"
                role="img"
                aria-label={`${c.name} ${c.hex}`}
                style={{ background: c.hex, flex: columns ? "0 1 52%" : "1 1 auto", boxShadow: outline ? "inset 0 0 0 1px var(--t-rule)" : undefined }}
              />
              <div className="s-label t-hex" style={{ marginTop: columns ? "5cqh" : "4cqh" }}>
                {c.hex}
              </div>
              {columns && (
                <>
                  <div className="s-label" style={{ marginTop: "3cqh" }}>
                    {c.name}
                  </div>
                  {c.traits.length > 0 && (
                    <div className="s-label t-muted" style={{ marginTop: "4cqh", lineHeight: 1.9, whiteSpace: "pre-line" }}>
                      {c.traits.join("\n")}
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ─────────────────────────────── type ─────────────────────────────── */

const WEIGHT_NAMES: Record<number, string> = {
  100: "Thin",
  200: "Extra light",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semibold",
  700: "Bold",
  800: "Extra bold",
  900: "Black",
};

function TypeTile({ tile }: TileProps) {
  const { brand } = useSlide();
  const s = tile.slots;
  const role = (s.font as "display" | "text" | "mono") ?? "display";
  const font = (role === "mono" ? brand.typography.mono : brand.typography[role]) ?? brand.typography.display;
  const family = `"${font.family}", ${font.fallback}`;
  const weight = role === "display" ? "var(--b-display-weight)" : Math.max(...font.weights);
  const styles = [...new Set(font.weights)].sort((a, b) => b - a).map((w) => WEIGHT_NAMES[w] ?? String(w));
  if (role !== "mono" && brand.typography.mono) styles.push("Mono");
  return (
    <div className="t-pad flex h-full flex-col justify-center">
      <SlotText
        k="sample"
        className="t-sample"
        style={{ fontFamily: family, fontWeight: weight, letterSpacing: role === "display" ? "var(--b-display-tracking)" : "-0.02em" }}
        placeholder="AaBb"
        fallback="AaBb"
      />
      <div className="flex items-start" style={{ gap: "5cqw", marginTop: "5cqh" }}>
        <div className="s-label t-family">{font.family}</div>
        <div className="t-rule-v" aria-hidden />
        <div className="s-label t-muted" style={{ lineHeight: 1.9 }}>
          {styles.slice(0, 4).map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
      </div>
      {s.detail !== "compact" && (
        <div className="s-label t-charset" style={{ marginTop: "8cqh" }}>
          ABCDEFGHIJKLMNOPQRSTUVWXYZ
          <br />
          <span style={{ textTransform: "none" }}>abcdefghijklmnopqrstuvwxyz</span>
          <br />
          0123456789 _.,:;()&#123;&#125;[]/-
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────── steps ─────────────────────────────── */

function parseSteps(v: string | undefined) {
  return lines(v)
    .slice(0, 4)
    .map((line) => {
      const [title, ...rest] = line.split(/\s+[—–-]\s+|\s*[—–]\s*$|:\s+/);
      return { title: (title ?? line).trim(), desc: rest.join(" ").trim() };
    });
}

function StepsTile({ tile, aspect }: TileProps) {
  const { brand } = useSlide();
  const s = tile.slots;
  const variant = s.variant ?? "sequence";
  const steps = parseSteps(s.items);
  const arts = (s.arts ?? "").split(",").map((x) => x.trim());
  const n = Math.max(1, steps.length);
  const edit = usePrompting();

  const header = (s.label || edit) && (
    <Label
      k="label"
      placeholder="Label"
      rule
      trailing={
        variant === "columns" ? (
          <span className="s-label t-muted" style={{ flex: "none" }}>
            / {String(n).padStart(2, "0")}
          </span>
        ) : undefined
      }
    />
  );

  if (variant === "cards") {
    return (
      <div className="flex h-full">
        {steps.map((st, i) => (
          <div key={i} className="t-card-col">
            <div className="s-label t-muted" style={{ fontSize: "max(calc(var(--u) * 0.42), 2.2cqh)" }}>
              No. {i + 1}
            </div>
            <div className="t-card-title">{st.title}</div>
            <div className="t-card">
              <Art brand={brand} spec={arts[i] || "prism:1"} tone="dark" aspect={0.82} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "columns") {
    const artAspect = ((aspect / n) * 0.9) / 0.5;
    return (
      <div className="t-pad flex h-full flex-col">
        {header}
        <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, marginTop: "4cqh" }}>
          {steps.map((st, i) => (
            <div key={i} className="t-col flex min-h-0 flex-col">
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <Art brand={brand} spec={arts[i] || "strata:1"} tone={artTone(tile)} aspect={artAspect} grain={0.8} />
              </div>
              <div className="s-label" style={{ marginTop: "3cqh" }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="s-display t-step-title" style={i === n - 1 && tile.tone === "dark" ? { color: "var(--b-secondary)" } : undefined}>
                {st.title}
              </div>
              {st.desc && <div className="s-label t-muted t-step-desc">{st.desc}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // sequence
  const artAspect = ((aspect / n) * 0.82) / 0.56;
  return (
    <div className="t-pad flex h-full flex-col">
      {header}
      <div className="flex min-h-0 flex-1 items-stretch" style={{ marginTop: "6cqh", gap: "2.4cqw" }}>
        {steps.map((st, i) => (
          <div key={i} className="contents">
            {i > 0 && (
              <div className="flex items-center self-start t-muted" style={{ height: "56%" }}>
                <Arrow />
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="relative overflow-hidden" style={{ height: "56%" }}>
                <Art brand={brand} spec={arts[i] || "burst:1"} tone={artTone(tile)} aspect={artAspect} />
              </div>
              <div className="s-label" style={{ marginTop: "5cqh" }}>
                {st.title}
              </div>
              {st.desc && <div className="s-label t-muted t-step-desc">{st.desc}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────── poster ─────────────────────────────── */

function PosterTile({ tile, aspect }: TileProps) {
  const s = tile.slots;
  const edit = usePrompting();
  const logo = s.logo ?? "top";
  return (
    <>
      <TileMedia tile={tile} aspect={aspect} />
      {s.fade !== "none" && <div aria-hidden className="t-fade is-tall" />}
      <div className="t-pad-lg relative flex h-full flex-col">
        {logo === "top" && <Lockup size="min(5cqw, 4cqh)" />}
        <SlotText
          k="headline"
          as="h3"
          className="s-display t-headline"
          style={{ fontSize: s.size === "l" ? "17cqw" : "11.5cqw", marginTop: logo === "top" ? "10cqh" : 0 }}
          placeholder="Poster headline"
          multiline
        />
        {(s.subhead || edit) && (
          <SlotText k="subhead" className="t-mono-copy" style={{ marginTop: "3cqh", fontSize: "4.4cqw" }} placeholder="Subhead" multiline />
        )}
        {s.cta && (
          <div style={{ marginTop: "4cqh", fontSize: "4cqw" }}>
            <Button k="cta" placeholder="Button" />
          </div>
        )}
        {logo === "bottom" && (
          <div className="mt-auto flex items-end justify-between" style={{ gap: "4cqw" }}>
            <Lockup size="min(6cqw, 5cqh)" />
            {s.caption && <SlotText k="caption" className="s-label text-right" style={{ whiteSpace: "pre-line", fontSize: "2.6cqw" }} multiline />}
          </div>
        )}
      </div>
    </>
  );
}

/* ─────────────────────────────── web ─────────────────────────────── */

function BrowserChrome() {
  return (
    <div className="t-chrome" aria-hidden>
      <span />
      <span />
      <span />
      <i />
    </div>
  );
}

function WebTile({ tile, aspect }: TileProps) {
  const { brand } = useSlide();
  const s = tile.slots;
  const nav = lines(s.nav);
  const chrome = s.chrome === "browser";
  const fill = (s.markStyle as MarkFill) ?? "solid";

  if (s.variant === "index") {
    const links = lines(s.links);
    return (
      <div className="flex h-full flex-col">
        {chrome && <BrowserChrome />}
        <div className="t-webpage relative flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between">
            <Mark size="3.4cqh" />
            <nav className="flex s-label t-nav" aria-label="Site">
              {nav.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </nav>
          </div>
          <div className="flex min-h-0 flex-1 items-start justify-between" style={{ marginTop: "6cqh" }}>
            <Mark size="34cqh" fill={fill === "solid" ? "stripes" : fill} style={{ color: "var(--b-accent)" }} />
            <div className="t-muted text-right" style={{ fontFamily: "var(--b-mono)", fontSize: "1.9cqw", lineHeight: 1.5, maxWidth: "34%" }}>
              {(brand.logo.wordmark || brand.meta.name).toLowerCase()}
              <br />
              {brand.meta.tagline.replace(/\.$/, "").toLowerCase()}
            </div>
          </div>
          <ul className="t-links">
            {links.slice(0, 8).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {chrome && <BrowserChrome />}
      <div className="t-webpage relative flex min-h-0 flex-1 flex-col">
        <TileMedia tile={tile} aspect={aspect} />
        <div aria-hidden className="t-fade is-tall" />
        <div className="relative flex items-center justify-between">
          <Lockup size="min(4.4cqw, 3.6cqh)" />
          <nav className="flex s-label t-nav" aria-label="Site">
            {nav.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </nav>
        </div>
        <SlotText
          k="headline"
          as="h3"
          className="s-display t-headline relative"
          style={{ fontSize: "9.6cqw", marginTop: "10cqh", maxWidth: "12ch" }}
          placeholder="Headline"
          multiline
        />
        <SlotText k="subhead" className="relative" style={{ fontSize: "3.4cqw", marginTop: "3cqh", opacity: 0.85 }} placeholder="Subhead" />
        {s.cta && (
          <div className="relative" style={{ marginTop: "4cqh", fontSize: "3cqw" }}>
            <Button k="cta" placeholder="Button" variant="rect" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────── text ─────────────────────────────── */

function TextTile({ tile }: TileProps) {
  const edit = usePrompting();
  const s = tile.slots;
  return (
    <div className="t-pad flex h-full flex-col">
      {(s.eyebrow || edit) && <Label k="eyebrow" placeholder="Eyebrow" rule />}
      <SlotText
        k="headline"
        as="h3"
        className="s-display t-headline"
        style={{ fontSize: "min(8cqw, 14cqh)", marginTop: "auto" }}
        placeholder="Headline"
        multiline
      />
      <SlotText k="body" className="t-body" style={{ marginTop: "4cqh" }} placeholder="Body copy" multiline />
    </div>
  );
}
