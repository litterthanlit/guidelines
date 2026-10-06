"use client";

import { contrastRatio, readableOn, svgDataUri, wcagLevel, type Color } from "@guidelines/core";
import type { CSSProperties } from "react";
import { Art } from "./Art";
import { assetFor, DropZone, Lockup, Mark, SlotImage, SlotText, TextColumn, useEdit, useSlide } from "./slots";
import { assetUrl } from "./theme";

const u = (n: number) => `calc(var(--u) * ${n})`;

/* ───────────────────────────── Cover ───────────────────────────── */

export function CoverLayout() {
  const { brand, page } = useSlide();
  const art = page.slots.art;
  return (
    <>
      <SlotImage
        k="image"
        eager
        fallback={
          art ? (
            <Art brand={brand} spec={art} tone="light" aspect={16 / 9} />
          ) : (
            <div className="absolute inset-0 s-grain" style={{ background: "var(--b-gradient)" }} />
          )
        }
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgb(0 0 0 / 0.28) 0%, rgb(0 0 0 / 0) 28%, rgb(0 0 0 / 0) 50%, rgb(0 0 0 / 0.5) 100%)" }}
      />
      <div className="relative flex h-full flex-col text-white" style={{ padding: "var(--pad)" }}>
        <Lockup scale={1.5} />
        <div className="mt-auto flex items-end justify-between" style={{ gap: u(2) }}>
          <div>
            <SlotText k="title" as="h1" className="s-display s-cover-title" placeholder="Brand Guidelines" />
            <SlotText k="subtitle" as="p" style={{ fontSize: u(1), marginTop: u(1.2), opacity: 0.85 }} placeholder="Subtitle" />
          </div>
          <p style={{ fontSize: u(0.72), opacity: 0.85, whiteSpace: "nowrap" }}>{brand.meta.name} Brand Guidelines</p>
        </div>
      </div>
    </>
  );
}

/* ───────────────────────────── Statement ───────────────────────────── */

export function StatementLayout() {
  const { brand, page } = useSlide();
  const dark = page.slots.tone === "dark";
  return (
    <>
      {page.slots.art ? (
        <Art brand={brand} spec={page.slots.art} tone={dark ? "dark" : "light"} aspect={16 / 9} />
      ) : (
        <div
          aria-hidden
          className="absolute inset-[-10%] s-grain"
          style={{ background: "var(--b-gradient)", filter: `blur(${u(3)}) ${dark ? "brightness(0.45) saturate(1.2)" : "saturate(1.05)"}` }}
        />
      )}
      <div
        className="relative flex h-full flex-col items-center justify-center text-center"
        style={{ padding: "var(--pad)", color: dark ? "#fff" : "var(--b-fg)" }}
      >
        <div
          className="s-statement-card flex flex-col items-center"
          style={{
            padding: `${u(2.6)} ${u(3.6)}`,
            borderRadius: u(0.4),
            background: dark ? "rgb(255 255 255 / 0.08)" : "rgb(255 255 255 / 0.32)",
            border: `1px solid ${dark ? "rgb(255 255 255 / 0.18)" : "rgb(255 255 255 / 0.55)"}`,
            backdropFilter: "blur(14px) saturate(1.3)",
            WebkitBackdropFilter: "blur(14px) saturate(1.3)",
          }}
        >
          <SlotText k="eyebrow" className="s-eyebrow" placeholder="Eyebrow" />
          <SlotText
            k="headline"
            as="h2"
            className="s-display s-statement-title"
            style={{ marginTop: u(1) }}
            placeholder="A single, confident statement"
            multiline
          />
          <SlotText
            k="body"
            as="p"
            style={{ fontSize: u(0.85), marginTop: u(1.4), opacity: 0.8, maxWidth: "44ch", whiteSpace: "pre-line" }}
            placeholder="Supporting copy"
            multiline
          />
          <div style={{ marginTop: u(1.8), fontSize: u(0.7), opacity: 0.8 }} className="inline-flex items-center gap-[0.5em]">
            <span aria-hidden style={{ width: "0.6em", height: "0.6em", borderRadius: 99, background: "currentColor" }} />
            <ByBrand />
          </div>
        </div>
      </div>
    </>
  );
}

function ByBrand() {
  const { brand } = useSlide();
  return <span>by {brand.meta.name}</span>;
}

/* ───────────────────────────── Logomark ───────────────────────────── */

export function LogomarkLayout() {
  const { brand, page } = useSlide();
  const lockup = page.slots.show === "lockup" || !brand.logo.markSvg;
  const clear = brand.logo.clearSpace;
  const Panel = ({ bg, fg }: { bg: string; fg: string }) => (
    <div className="relative flex flex-1 items-center justify-center" style={{ background: bg, color: fg }}>
      <div className="relative" style={{ padding: `calc(${u(9)} * ${clear})` }}>
        <span aria-hidden className="pointer-events-none absolute inset-0" style={{ outline: `1px dashed ${fg}`, opacity: 0.22 }} />
        {lockup ? <Lockup scale={2.6} /> : <Mark size={u(9)} />}
      </div>
    </div>
  );
  return (
    <div className="spread">
      <TextColumn titleFallback="Logomark" />
      <div className="spread-media flex" style={{ background: "transparent", outline: "1px solid color-mix(in srgb, var(--b-fg) 18%, transparent)" }}>
        <Panel bg="var(--b-bg)" fg="var(--b-fg)" />
        <Panel bg="var(--b-fg)" fg="var(--b-bg)" />
      </div>
    </div>
  );
}

/* ───────────────────────────── Palette ───────────────────────────── */

function Chip({ hex, label, grow }: { hex: string; label: string; grow?: boolean }) {
  const ink = readableOn(hex);
  return (
    <div
      className="flex items-center justify-center s-mono"
      style={{ background: hex, color: ink, flex: grow ? "1 1 0" : "0 0 auto", height: grow ? undefined : u(2.1), fontSize: u(0.62), letterSpacing: "0.02em" }}
    >
      {label}
    </div>
  );
}

function PaletteColumn({ c }: { c: Color }) {
  const tints = ["50", "100", "200", "300"].map((s) => c.scale[s]).filter(Boolean) as string[];
  const shades = ["600", "700", "800", "900"].map((s) => c.scale[s]).filter(Boolean) as string[];
  const ink = readableOn(c.hex);
  const ratio = contrastRatio(ink, c.hex);
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {tints.map((h) => (
        <Chip key={`t${h}`} hex={h} label={h.slice(1).toLowerCase()} />
      ))}
      <div className="relative flex flex-1 flex-col justify-between" style={{ background: c.hex, color: ink, padding: u(0.9) }}>
        <div>
          <div style={{ fontSize: u(0.95), fontWeight: 500 }}>{c.name}</div>
          <div className="s-mono" style={{ fontSize: u(0.62), opacity: 0.75, marginTop: u(0.2) }}>
            {c.role}
          </div>
        </div>
        <div className="s-mono" style={{ fontSize: u(0.65) }}>
          <div>{c.hex}</div>
          <div style={{ opacity: 0.75, marginTop: u(0.2) }}>
            {wcagLevel(ratio)} · {ratio}:1
          </div>
        </div>
      </div>
      {shades.map((h) => (
        <Chip key={`s${h}`} hex={h} label={h.slice(1).toLowerCase()} />
      ))}
    </div>
  );
}

export function PaletteLayout() {
  const { brand } = useSlide();
  const colors = brand.colors.slice(0, 7);
  return (
    <div className="spread">
      <TextColumn titleFallback="Color palette" />
      <div className="spread-media flex" style={{ background: "transparent", borderRadius: 0 }}>
        {colors.length ? colors.map((c) => <PaletteColumn key={c.id} c={c} />) : <div className="s-empty">No colors yet — ask the agent to set a palette.</div>}
      </div>
    </div>
  );
}

/* ───────────────────────────── Type specimen ───────────────────────────── */

export function TypeSpecimenLayout() {
  const { brand, page } = useSlide();
  const role = (page.slots.font as "display" | "text" | "mono") ?? "display";
  const font = (role === "mono" ? brand.typography.mono : brand.typography[role]) ?? brand.typography.display;
  const family = `"${font.family}", ${font.fallback}`;
  const scale = brand.typography.scale.filter((s) => s.font === role).slice(0, 4);
  return (
    <div className="spread">
      <TextColumn titleFallback={role === "display" ? "Primary font" : "Secondary font"} />
      <div className="spread-media flex flex-col justify-center" style={{ padding: u(3.2) }}>
        <div className="flex items-center" style={{ gap: u(3.2) }}>
          <div style={{ fontFamily: family, fontSize: u(3.6), lineHeight: 1, letterSpacing: "-0.015em", whiteSpace: "nowrap" }}>{font.family}</div>
          <div style={{ fontFamily: family, fontSize: u(1.05), lineHeight: 1.35, wordBreak: "break-all" }}>
            ABCDEFGHIJKLMNOPQRSTUVWXYZ
            <br />
            abcdefghijklmnopqrstuvwxyz
            <br />
            0123456789 &amp;?!@(%)
          </div>
        </div>
        {scale.length > 0 && (
          <div style={{ marginTop: u(3), borderTop: "1px solid color-mix(in srgb, var(--b-fg) 14%, transparent)" }}>
            {scale.map((s) => (
              <div
                key={s.name}
                className="flex items-baseline"
                style={{ gap: u(2), padding: `${u(0.8)} 0`, borderBottom: "1px solid color-mix(in srgb, var(--b-fg) 14%, transparent)" }}
              >
                <div className="s-mono" style={{ width: u(9), flex: "none", fontSize: u(0.62), opacity: 0.7 }}>
                  {s.name} · {s.size}/{Math.round(s.size * s.lineHeight)}
                </div>
                <div
                  style={{
                    fontFamily: family,
                    fontSize: `min(${u(s.size / 16)}, ${u(3.2)})`,
                    lineHeight: s.lineHeight,
                    letterSpacing: `${s.tracking}em`,
                    fontWeight: s.weight,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {brand.meta.tagline || `The quick brown fox jumps over the lazy dog`}
                </div>
              </div>
            ))}
          </div>
        )}
        {font.usage && <p style={{ marginTop: u(1.6), fontSize: u(0.75), opacity: 0.7, maxWidth: "60ch" }}>{font.usage}</p>}
      </div>
    </div>
  );
}

/* ───────────────────────────── Imagery grid ───────────────────────────── */

export function ImageryGridLayout() {
  const { brand, page } = useSlide();
  const edit = useEdit();
  const ids = (page.slots.images ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
  const assets = ids.map((id) => assetFor(brand, id)).filter(Boolean) as NonNullable<ReturnType<typeof assetFor>>[];
  const cols = assets.length <= 1 ? 1 : assets.length <= 4 ? 2 : 3;
  return (
    <div className="spread">
      <TextColumn titleFallback="Brand imagery" />
      <div className="spread-media">
        <DropZone slot="images" append className="absolute inset-0 flex items-center justify-center" style={{ padding: u(3.2) }}>
          {assets.length ? (
            <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: u(1) }}>
              {assets.map((a) => (
                <figure key={a.id} className="relative" style={{ aspectRatio: cols === 1 ? "16 / 10" : "4 / 3.4", margin: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="s-img"
                    style={{ borderRadius: u(0.15) }}
                    src={assetUrl(brand.slug, a.file)}
                    alt={a.alt}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                  {a.caption && (
                    <figcaption
                      className="absolute bottom-0 left-0 s-mono"
                      style={{ fontSize: u(0.55), padding: u(0.5), color: "#fff", textShadow: "0 1px 4px rgb(0 0 0 / 0.5)" }}
                    >
                      {a.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          ) : (
            <div className="s-empty">{edit ? "Drop up to 6 images, or ask the agent to generate imagery." : ""}</div>
          )}
        </DropZone>
      </div>
    </div>
  );
}

/* ───────────────────────────── Application mockups ───────────────────────────── */

function Billboard() {
  const { brand } = useSlide();
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background:
          "radial-gradient(120% 90% at 30% 10%, #d9d6d0 0%, #bdb9b2 55%, #a6a199 100%), repeating-linear-gradient(90deg, rgb(0 0 0 / 0.025) 0 2px, transparent 2px 7%)",
        backgroundBlendMode: "multiply",
      }}
    >
      {/* Wall bolts */}
      <div aria-hidden className="absolute inset-x-[8%] top-[9%] flex justify-between">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} style={{ width: u(0.35), height: u(0.35), borderRadius: 99, background: "rgb(0 0 0 / 0.25)" }} />
        ))}
      </div>
      <div
        className="relative flex flex-col overflow-hidden"
        style={{
          width: "74%",
          aspectRatio: "16 / 9.4",
          border: `${u(0.55)} solid #232323`,
          boxShadow: `0 ${u(1.6)} ${u(3)} rgb(0 0 0 / 0.35)`,
          background: "var(--b-bg)",
        }}
      >
        <div className="relative" style={{ flex: "0 0 60%" }}>
          <SlotImage k="image" fallback={<div className="absolute inset-0 s-grain" style={{ background: "var(--b-gradient)" }} />} />
        </div>
        <div className="flex flex-1 items-start justify-between" style={{ padding: `${u(1.3)} ${u(1.6)}`, gap: u(1.5) }}>
          <div className="flex h-full flex-col">
            <SlotText
              k="headline"
              as="h3"
              className="s-display"
              style={{ fontSize: u(1.6), lineHeight: 1.12, maxWidth: "18ch" }}
              placeholder="Billboard headline"
              multiline
            />
            <p style={{ fontSize: u(0.62), opacity: 0.8, marginTop: "auto", maxWidth: "40ch" }}>{brand.meta.tagline}</p>
          </div>
          <div className="flex h-full flex-col items-end justify-between">
            <Mark size={u(1.8)} />
            <SlotText
              k="cta"
              className="s-mono"
              style={{
                fontSize: u(0.62),
                background: "var(--b-fg)",
                color: "var(--b-bg)",
                padding: `${u(0.4)} ${u(0.8)}`,
                borderRadius: u(0.15),
                whiteSpace: "nowrap",
              }}
              placeholder="Call to action"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Banner() {
  const { brand } = useSlide();
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: "linear-gradient(180deg, var(--b-tint) 0%, color-mix(in srgb, var(--b-primary) 55%, white) 100%)" }}
    >
      <SlotImage k="image" fallback={null} />
      {/* Facade post */}
      <div
        aria-hidden
        className="absolute right-[18%] top-0 h-full"
        style={{ width: "9%", background: "linear-gradient(90deg, #b6a58a, #d8c7a6 40%, #9a8a71)" }}
      />
      <div aria-hidden className="absolute top-[7%] right-[24%]" style={{ width: "44%", height: u(0.5), background: "#8a7b63" }} />
      <div
        className="absolute flex flex-col"
        style={{
          top: "calc(7% + var(--u) * 0.5)",
          right: "26%",
          width: "36%",
          height: "66%",
          background: "var(--b-bg)",
          padding: u(1.6),
          boxShadow: `0 ${u(1)} ${u(2.4)} rgb(0 0 0 / 0.18)`,
        }}
      >
        <Lockup scale={0.9} />
        <SlotText
          k="headline"
          as="h3"
          className="s-display"
          style={{ fontSize: u(2.3), lineHeight: 1.08, marginTop: u(2.2) }}
          placeholder="Banner headline"
          multiline
        />
        <p style={{ fontSize: u(0.62), marginTop: "auto", opacity: 0.8 }}>{brand.meta.story.slice(0, 160)}</p>
      </div>
    </div>
  );
}

function UiCard() {
  const { brand } = useSlide();
  const bars = [0.35, 0.5, 0.42, 0.62, 0.55, 0.8, 0.68, 0.92];
  const swatches = brand.colors.filter((c) => c.role !== "background" && c.role !== "text").map((c) => c.hex);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div aria-hidden className="absolute inset-[-10%] s-grain" style={{ background: "var(--b-gradient)", filter: `blur(${u(2)})` }} />
      <SlotImage k="image" fallback={null} />
      <div
        className="glass relative"
        style={{ width: "46%", borderRadius: u(1), padding: u(1.6), boxShadow: `0 ${u(1.2)} ${u(3)} rgb(0 0 0 / 0.18)`, color: "#151515" }}
      >
        <div className="flex items-center justify-between">
          <Lockup scale={0.7} />
          <span className="s-mono" style={{ fontSize: u(0.55), opacity: 0.6 }}>
            LIVE
          </span>
        </div>
        <SlotText k="headline" as="h3" className="s-display" style={{ fontSize: u(1.9), marginTop: u(1.4) }} placeholder="$96,316" />
        <div className="flex items-end" style={{ gap: u(0.4), height: u(7), marginTop: u(1.2) }}>
          {bars.map((h, i) => (
            <span
              key={i}
              style={{
                flex: 1,
                height: `${h * 100}%`,
                borderRadius: u(0.2),
                background: i % 3 === 2 ? (swatches[1] ?? "var(--b-accent)") : (swatches[0] ?? "var(--b-primary)"),
                opacity: i === bars.length - 1 ? 1 : 0.75,
              }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between" style={{ marginTop: u(1.2) }}>
          <span style={{ fontSize: u(0.6), opacity: 0.6 }}>{brand.meta.tagline}</span>
          <SlotText
            k="cta"
            style={{
              fontSize: u(0.6),
              background: "var(--b-primary)",
              color: "var(--b-primary-ink)",
              padding: `${u(0.35)} ${u(0.75)}`,
              borderRadius: 99,
              whiteSpace: "nowrap",
            }}
            placeholder="Get started →"
          />
        </div>
      </div>
    </div>
  );
}

export function ApplicationMockupLayout() {
  const { page } = useSlide();
  const variant = page.slots.variant ?? "billboard";
  return (
    <div className="spread">
      <TextColumn titleFallback="In use" />
      <div className="spread-media">{variant === "banner" ? <Banner /> : variant === "card" ? <UiCard /> : <Billboard />}</div>
    </div>
  );
}

/* ───────────────────────────── Iconography ───────────────────────────── */

export function IconographyLayout() {
  const { brand } = useSlide();
  return (
    <div className="spread">
      <TextColumn titleFallback="Iconography" />
      <div className="spread-media flex items-center justify-center" style={{ background: "var(--b-tint)", padding: u(3) }}>
        {brand.icons.length ? (
          <div
            className="grid w-full"
            style={{ gridTemplateColumns: `repeat(${Math.min(7, Math.max(4, Math.ceil(Math.sqrt(brand.icons.length * 1.6))))}, minmax(0, 1fr))`, gap: u(1) }}
          >
            {brand.icons.slice(0, 35).map((i) => (
              <div
                key={i.id}
                title={i.name}
                className="flex flex-col items-center justify-center"
                style={{
                  aspectRatio: "1",
                  background: "rgb(255 255 255 / 0.85)",
                  borderRadius: u(0.4),
                  color: "var(--b-fg)",
                  boxShadow: "0 1px 2px rgb(0 0 0 / 0.06)",
                }}
              >
                <span aria-hidden className="s-mark" style={{ width: "42%", height: "42%", ["--mark" as string]: `url("${svgDataUri(i.svg)}")` }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="s-empty">No icons yet — ask the agent to draw an icon set.</div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────── Do & Don't ───────────────────────────── */

export function DoDontLayout() {
  const { page } = useSlide();
  const col = (k: "do" | "dont", imgKey: string, label: string, glyph: string) => {
    const lines = (page.slots[k] ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    return (
      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: u(1) }}>
        <div
          className="relative overflow-hidden"
          style={{ aspectRatio: "4 / 3", borderRadius: u(0.25), background: "color-mix(in srgb, var(--b-fg) 6%, transparent)" }}
        >
          <SlotImage k={imgKey} fallback={null} />
          {k === "dont" && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top right, transparent calc(50% - 1px), #d33 calc(50% - 1px), #d33 calc(50% + 1px), transparent calc(50% + 1px))",
                opacity: 0.6,
              }}
            />
          )}
        </div>
        <div className="flex items-center" style={{ gap: u(0.6), fontWeight: 500, fontSize: u(0.95) }}>
          <span
            aria-hidden
            className="inline-flex items-center justify-center"
            style={{
              width: u(1.4),
              height: u(1.4),
              borderRadius: 99,
              background: k === "do" ? "var(--b-primary)" : "var(--b-fg)",
              color: k === "do" ? "var(--b-primary-ink)" : "var(--b-bg)",
              fontSize: u(0.7),
            }}
          >
            {glyph}
          </span>
          {label}
        </div>
        <SlotText
          k={k}
          as="div"
          style={{ fontSize: u(0.75), lineHeight: 1.6, whiteSpace: "pre-line", opacity: 0.85 }}
          placeholder="One rule per line"
          multiline
          fallback={lines.length ? undefined : ""}
        />
      </div>
    );
  };
  return (
    <div className="spread">
      <TextColumn titleFallback="Usage" />
      <div className="spread-media flex items-center" style={{ padding: u(3), gap: u(2.4) }}>
        {col("do", "doImage", "Do", "✓")}
        {col("dont", "dontImage", "Don’t", "✕")}
      </div>
    </div>
  );
}
