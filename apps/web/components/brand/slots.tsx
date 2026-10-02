"use client";

import type { Brand, Page } from "@guidelines/core";
import { createContext, useContext, useState, type CSSProperties, type ElementType, type KeyboardEvent, type ReactNode } from "react";
import { assetUrl } from "./theme";

/**
 * Slots are the editable regions of a guideline page. In the studio they become
 * inline-editable text and image drop zones; in renders they are plain markup.
 */

export interface EditApi {
  setSlot: (pageId: string, key: string, value: string | null) => void;
  upload: (file: File, target: { pageId: string; slot: string; append?: boolean }) => void;
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
  const { page } = useSlide();
  const edit = useEdit();
  const value = page.slots[k] ?? "";
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
    const next = (el.innerText ?? "")
      .replace(/ /g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (next !== value.trim()) edit.setSlot(page.id, k, next || null);
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
        for (const f of append ? files.slice(0, 6) : files.slice(0, 1)) edit.upload(f, { pageId: page.id, slot, append });
      }}
    >
      {children}
    </div>
  );
}

/** An asset image that fills its (positioned) parent, with an optional fallback. */
export function SlotImage({ k, fallback, className = "s-img", eager }: { k: string; fallback?: ReactNode; className?: string; eager?: boolean }) {
  const { brand, page } = useSlide();
  const edit = useEdit();
  const asset = assetFor(brand, page.slots[k]);
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

export function Mark({ size, className, style }: { size: string; className?: string; style?: CSSProperties }) {
  const { brand } = useSlide();
  if (!brand.logo.markSvg) return null;
  return <span aria-hidden className={`s-mark ${className ?? ""}`} style={{ width: size, height: size, ...style }} />;
}

export function Lockup({ scale = 1, className, style }: { scale?: number; className?: string; style?: CSSProperties }) {
  const { brand } = useSlide();
  const name = brand.logo.wordmark || brand.meta.name;
  return (
    <div className={`s-lockup ${className ?? ""}`} style={{ fontSize: `calc(var(--u) * ${1.05 * scale})`, ...style }} aria-label={name}>
      <Mark size={`calc(var(--u) * ${1.3 * scale})`} />
      <span>{name}</span>
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
