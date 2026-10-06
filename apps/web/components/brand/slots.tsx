"use client";

import { svgAspect, type Brand, type Page, type Tile } from "@guidelines/core";
import { createContext, useContext, useState, type CSSProperties, type ElementType, type KeyboardEvent, type ReactNode } from "react";
import { assetUrl } from "./theme";

/**
 * Slots are the editable regions of a guideline page. In the studio they become
 * inline-editable text and image drop zones; in renders they are plain markup.
 */

export interface EditApi {
  setSlot: (pageId: string, key: string, value: string | null) => void;
  upload: (file: File, target: { pageId: string; slot: string; append?: boolean; tileId?: string }) => void;
  setTileSlot?: (pageId: string, tileId: string, key: string, value: string | null) => void;
  selectTile?: (pageId: string, tileId: string | null) => void;
  selectedTile?: string | null;
}

export const EditContext = createContext<EditApi | null>(null);

interface SlideCtx {
  brand: Brand;
  page: Page;
  index: number;
}
export const SlideContext = createContext<SlideCtx | null>(null);

export function useSlide() {
  const ctx = useContext(SlideContext);
  if (!ctx) throw new Error("useSlide outside <Slide>");
  return ctx;
}

export function useEdit() {
  return useContext(EditContext);
}

/** Set while rendering a board tile: slots then read from and write to the tile. */
export const TileContext = createContext<Tile | null>(null);

export function useTile() {
  return useContext(TileContext);
}

/** A slot's value and setter, scoped to the current tile or page. */
export function useSlot(k: string) {
  const { page } = useSlide();
  const tile = useTile();
  const edit = useEdit();
  const value = (tile ? tile.slots[k] : page.slots[k]) ?? "";
  const set = edit ? (v: string | null) => (tile ? edit.setTileSlot?.(page.id, tile.id, k, v) : edit.setSlot(page.id, k, v)) : undefined;
  return { value, set, edit };
}

export function SlotText({
  k,
  as: Tag = "div",
  className,
  style,
  placeholder,
  multiline = false,
  fallback = "",
}: {
  k: string;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
  multiline?: boolean;
  fallback?: string;
}) {
  const { value, set, edit } = useSlot(k);
  const shown = value || fallback;

  if (!edit) {
    if (!shown) return null;
    return (
      <Tag className={className} style={style}>
        {shown}
      </Tag>
    );
  }

  const commit = (el: HTMLElement) => {
    const next = readEditable(el)
      .replace(/ /g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (next !== value.trim()) set?.(next || null);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      (e.currentTarget as HTMLElement).textContent = value;
      (e.currentTarget as HTMLElement).blur();
    }
    if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).blur();
    }
  };

  return (
    <Tag
      // Remount when the value changes remotely so React never fights the DOM
      // that contentEditable has mutated.
      key={value}
      className={className}
      style={style}
      data-slot={k}
      data-placeholder={placeholder ?? (fallback || k)}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-multiline={multiline}
      aria-label={placeholder ?? k}
      spellCheck
      onBlur={(e: React.FocusEvent<HTMLElement>) => commit(e.currentTarget)}
      onKeyDown={onKeyDown}
    >
      {value}
    </Tag>
  );
}

/**
 * Raw text of a contentEditable region. Unlike innerText this ignores CSS
 * (e.g. text-transform: uppercase) while still turning <br>/<div> into newlines.
 */
function readEditable(el: Node): string {
  let out = "";
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) out += n.textContent ?? "";
    else if (n.nodeName === "BR") out += "\n";
    else if (n.nodeType === Node.ELEMENT_NODE) out += (/^(DIV|P)$/.test(n.nodeName) && out ? "\n" : "") + readEditable(n);
  });
  return out;
}

export function assetFor(brand: Brand, id: string | undefined) {
  if (!id) return undefined;
  return brand.imagery.assets.find((a) => a.id === id.trim());
}

/** Drop target for image files. Renders children; shows a highlight while dragging. */
export function DropZone({
  slot,
  append,
  className,
  style,
  children,
}: {
  slot: string;
  append?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { page } = useSlide();
  const tile = useTile();
  const edit = useEdit();
  const [over, setOver] = useState(false);
  if (!edit)
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  return (
    <div
      className={className}
      style={style}
      data-drop={over ? "over" : undefined}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes("Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
        for (const f of append ? files.slice(0, 6) : files.slice(0, 1)) edit.upload(f, { pageId: page.id, slot, append, tileId: tile?.id });
      }}
    >
      {children}
    </div>
  );
}

/** An asset image that fills its (positioned) parent, with an optional fallback. */
export function SlotImage({ k, fallback, className = "s-img", eager }: { k: string; fallback?: ReactNode; className?: string; eager?: boolean }) {
  const { brand } = useSlide();
  const { value, edit } = useSlot(k);
  const asset = assetFor(brand, value);
  return (
    <DropZone slot={k} className="absolute inset-0">
      {asset ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={className}
          src={assetUrl(brand.slug, asset.file)}
          alt={asset.alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
        />
      ) : (
        (fallback ?? (edit ? <div className="s-empty">Drop an image here</div> : null))
      )}
    </DropZone>
  );
}

export type MarkFill = "solid" | "stripes" | "gradient";

/** The logomark, drawn through a CSS mask. `size` is its height; width follows the mark's aspect ratio. */
export function Mark({ size, fill = "solid", className, style }: { size: string; fill?: MarkFill; className?: string; style?: CSSProperties }) {
  const { brand } = useSlide();
  if (!brand.logo.markSvg) return null;
  return (
    <span
      aria-hidden
      className={`s-mark ${fill !== "solid" ? `s-mark-${fill}` : ""} ${className ?? ""}`}
      style={{ height: size, width: `calc(${size} * var(--mark-aspect, 1))`, ...style }}
    />
  );
}

/**
 * Mark + wordmark. Wide marks sit at x-height, square ones at cap height plus,
 * so lockups of any mark shape balance optically.
 */
export function Lockup({
  scale = 1,
  size,
  show = "lockup",
  fill,
  className,
  style,
}: {
  scale?: number;
  /** Overrides `scale`: any CSS font-size for the wordmark. */
  size?: string;
  show?: "lockup" | "mark" | "wordmark";
  fill?: MarkFill;
  className?: string;
  style?: CSSProperties;
}) {
  const { brand } = useSlide();
  const name = brand.logo.wordmark || brand.meta.name;
  const aspect = svgAspect(brand.logo.markSvg);
  const markEm = aspect > 1.6 ? 0.78 : 1.24;
  const showMark = show !== "wordmark" && !!brand.logo.markSvg;
  const showName = show !== "mark" || !brand.logo.markSvg;
  return (
    <div
      className={`s-lockup ${className ?? ""}`}
      style={{ fontSize: size ?? `calc(var(--u) * ${1.05 * scale})`, gap: aspect > 1.6 ? "0.38em" : "0.48em", ...style }}
      role="img"
      aria-label={name}
    >
      {showMark && <Mark size={`${show === "mark" ? markEm * 1.6 : markEm}em`} fill={fill} />}
      {showName && <span aria-hidden>{name}</span>}
    </div>
  );
}

export function Folio() {
  const { brand, index } = useSlide();
  return (
    <footer className="s-folio">
      Page {index + 1}
      <br />
      {brand.meta.name} Brand Guidelines
    </footer>
  );
}

/** Standard text column used by spread layouts. */
export function TextColumn({ titleFallback, children }: { titleFallback?: string; children?: ReactNode }) {
  return (
    <aside className="spread-text">
      <Lockup />
      <SlotText k="title" as="h2" className="s-title" placeholder="Section title" fallback={titleFallback} />
      <SlotText k="body" className="s-body" placeholder="Add a short explanation…" multiline />
      {children}
      <Folio />
    </aside>
  );
}
