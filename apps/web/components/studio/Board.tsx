"use client";

import { readableOn, type BoardItem, type Brand } from "@guidelines/core";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { assetFor } from "../brand/slots";
import { assetUrl, BrandTheme } from "../brand/theme";
import { useStore } from "./store";

const CANVAS_W = 1600;
const SNAP = 8;
const snap = (n: number) => Math.round(n / SNAP) * SNAP;

type Geometry = Pick<BoardItem, "x" | "y" | "w" | "h">;

/**
 * Freeform moodboard. Items live in a 1600-unit-wide canvas scaled to fit;
 * drag to move, corner to resize (images keep their aspect), snap to an 8-unit grid.
 */
export function Board() {
  const { brand, apply, upload } = useStore();
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [selected, setSelected] = useState<string | null>(null);
  const [live, setLive] = useState<Record<string, Geometry>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.max(0.2, Math.min(1, (e!.contentRect.width - 48) / CANVAS_W))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const items = brand.board.items;
  const height = Math.max(900, ...items.map((i) => (live[i.id]?.y ?? i.y) + (live[i.id]?.h ?? i.h) + 240));
  const maxZ = items.reduce((m, i) => Math.max(m, i.z), 0);

  const startDrag = (e: ReactPointerEvent, item: BoardItem, mode: "move" | "resize") => {
    if (editing === item.id) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(item.id);
    const start = { x: e.clientX, y: e.clientY };
    const origin = { x: item.x, y: item.y, w: item.w, h: item.h };
    const ratio = item.h / item.w;
    const keepAspect = (item.kind === "image") !== e.shiftKey;
    let last: Geometry = origin;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.x) / scale;
      const dy = (ev.clientY - start.y) / scale;
      if (mode === "move") {
        last = { ...origin, x: snap(Math.max(0, Math.min(CANVAS_W - origin.w, origin.x + dx))), y: snap(Math.max(0, origin.y + dy)) };
      } else {
        const w = snap(Math.max(80, Math.min(CANVAS_W - origin.x, origin.w + dx)));
        const h = keepAspect ? Math.round(w * ratio) : snap(Math.max(60, origin.h + dy));
        last = { ...origin, w, h };
      }
      setLive((l) => ({ ...l, [item.id]: last }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const changed = last.x !== item.x || last.y !== item.y || last.w !== item.w || last.h !== item.h;
      const z = item.z < maxZ ? maxZ + 1 : item.z;
      if (changed || z !== item.z) {
        void apply([{ type: "boardUpdate", id: item.id, patch: { ...last, z } }]).finally(() =>
          setLive((l) => {
            const { [item.id]: _, ...rest } = l;
            return rest;
          }),
        );
      } else {
        setLive((l) => {
          const { [item.id]: _, ...rest } = l;
          return rest;
        });
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onItemKey = (e: ReactKeyboardEvent, item: BoardItem) => {
    if (editing) return;
    const step = e.shiftKey ? SNAP * 4 : SNAP;
    const nudge: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (nudge[e.key]) {
      e.preventDefault();
      const [dx, dy] = nudge[e.key]!;
      void apply([{ type: "boardUpdate", id: item.id, patch: { x: Math.max(0, item.x + dx), y: Math.max(0, item.y + dy) } }]);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      void apply([{ type: "boardRemove", id: item.id }]);
      setSelected(null);
    } else if (e.key === "Enter" && item.kind === "note") {
      e.preventDefault();
      setEditing(item.id);
    }
  };

  const visibleTop = useCallback(() => {
    const el = wrap.current;
    return el ? snap(el.scrollTop / scale + 40) : 40;
  }, [scale]);

  const add = (kind: BoardItem["kind"], ref?: string, text = "") => {
    const size = kind === "swatch" ? { w: 200, h: 260 } : kind === "type" ? { w: 520, h: 320 } : { w: 320, h: 200 };
    void apply([{ type: "boardAdd", items: [{ kind, ref, text, x: snap(40 + Math.random() * 200), y: visibleTop(), ...size }] }]);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (setSelected(null), setEditing(null));
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <BrandTheme brand={brand} className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-line bg-canvas px-4 py-2">
        <span className="label mr-2 hidden sm:inline">Moodboard · {items.length}</span>
        <button type="button" className="btn btn-outline" onClick={() => fileInput.current?.click()}>
          Add images
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            for (const f of [...(e.target.files ?? [])].slice(0, 12)) void upload(f, { board: true });
            e.target.value = "";
          }}
        />
        <button type="button" className="btn btn-outline" onClick={() => add("note", undefined, "A note on mood, material or reference…")}>
          Note
        </button>
        <AddMenu label="Swatch" options={brand.colors.map((c) => ({ id: c.id, label: c.name, color: c.hex }))} onPick={(id) => add("swatch", id)} />
        <AddMenu
          label="Type"
          options={[
            { id: "display", label: `Display · ${brand.typography.display.family}` },
            { id: "text", label: `Text · ${brand.typography.text.family}` },
          ]}
          onPick={(id) => add("type", id)}
        />
        <div className="ml-auto flex items-center gap-1.5">
          <AddMenu
            label="Auto-arrange"
            options={[3, 4, 5].map((n) => ({ id: String(n), label: `${n} columns` }))}
            onPick={(n) => void apply([{ type: "boardArrange", columns: Number(n), width: CANVAS_W, gap: 16 }])}
            align="right"
          />
        </div>
      </div>

      <div
        ref={wrap}
        className="relative min-h-0 flex-1 overflow-auto p-6 scrollbar-thin"
        style={{ backgroundImage: "radial-gradient(var(--color-line-strong) 1px, transparent 1px)", backgroundSize: `${16 * scale}px ${16 * scale}px` }}
        onPointerDown={() => (setSelected(null), setEditing(null))}
        onDragOver={(e) => {
          if (![...e.dataTransfer.types].includes("Files")) return;
          e.preventDefault();
          setDropping(true);
        }}
        onDragLeave={(e) => e.currentTarget === e.target && setDropping(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropping(false);
          const rect = e.currentTarget.getBoundingClientRect();
          const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
          files.slice(0, 12).forEach((f, i) => {
            const x = snap((e.clientX - rect.left + e.currentTarget.scrollLeft - 24) / scale + i * 24);
            const y = snap((e.clientY - rect.top + e.currentTarget.scrollTop - 24) / scale + i * 24);
            void upload(f, { board: true, x: Math.max(0, x), y: Math.max(0, y) });
          });
        }}
      >
        <div className="relative" style={{ width: CANVAS_W * scale, height: height * scale }}>
          <div className="absolute top-0 left-0 origin-top-left" style={{ width: CANVAS_W, height, transform: `scale(${scale})` }}>
            {items.map((item) => {
              const g = live[item.id] ?? item;
              const isSel = selected === item.id;
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.kind}${item.text ? `: ${item.text.slice(0, 40)}` : ""}. Arrow keys to move, Delete to remove.`}
                  aria-pressed={isSel}
                  onPointerDown={(e) => startDrag(e, item, "move")}
                  onDoubleClick={() => item.kind === "note" && setEditing(item.id)}
                  onKeyDown={(e) => onItemKey(e, item)}
                  onFocus={() => setSelected(item.id)}
                  className={`group absolute touch-none select-none ${live[item.id] ? "" : "transition-[left,top,width,height] duration-300 ease-out"} ${isSel ? "z-[9999]" : ""}`}
                  style={{ left: g.x, top: g.y, width: g.w, height: g.h, zIndex: isSel ? 9999 : item.z, cursor: editing === item.id ? "text" : "grab" }}
                >
                  <div className={`size-full overflow-hidden rounded-[8px] transition-shadow ${isSel ? "shadow-lift ring-2 ring-signal" : "shadow-float"}`}>
                    <BoardItemView
                      item={item}
                      brand={brand}
                      editing={editing === item.id}
                      onDoneEditing={(text) => {
                        setEditing(null);
                        if (text !== item.text) void apply([{ type: "boardUpdate", id: item.id, patch: { text } }]);
                      }}
                    />
                  </div>
                  {isSel && editing !== item.id && (
                    <>
                      <span
                        aria-hidden
                        onPointerDown={(e) => startDrag(e, item, "resize")}
                        className="absolute -right-2 -bottom-2 size-4 cursor-nwse-resize rounded-full border-2 border-signal bg-white"
                        style={{ transform: `scale(${1 / scale})` }}
                      />
                      <button
                        type="button"
                        aria-label="Remove item"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => (void apply([{ type: "boardRemove", id: item.id }]), setSelected(null))}
                        className="absolute -top-3 -right-3 grid size-6 place-items-center rounded-full bg-ink text-[13px] text-white shadow-float"
                        style={{ transform: `scale(${1 / scale})` }}
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {items.length === 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-8 text-center">
            <div>
              <p className="text-[15px] font-medium">An empty board</p>
              <p className="mt-1 max-w-sm text-ink-3">
                Drop images here, add swatches and type specimens, or ask the agent to collect references with board_add.
              </p>
            </div>
          </div>
        )}
        {dropping && <div className="pointer-events-none absolute inset-3 rounded-2xl border-2 border-dashed border-signal bg-signal-soft/40" />}
      </div>
    </BrandTheme>
  );
}

function BoardItemView({ item, brand, editing, onDoneEditing }: { item: BoardItem; brand: Brand; editing: boolean; onDoneEditing: (text: string) => void }) {
  if (item.kind === "image") {
    const a = assetFor(brand, item.ref);
    if (!a) return <div className="grid size-full place-items-center bg-sunken text-[12px] text-ink-3">Missing image</div>;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={assetUrl(brand.slug, a.file)} alt={a.alt} className="size-full object-cover" draggable={false} loading="lazy" />;
  }
  if (item.kind === "swatch") {
    const c = brand.colors.find((x) => x.id === item.ref);
    if (!c) return <div className="grid size-full place-items-center bg-sunken text-[12px] text-ink-3">Missing color</div>;
    const ink = readableOn(c.hex);
    return (
      <div className="flex size-full flex-col">
        <div className="flex-1" style={{ background: c.hex }} />
        <div className="flex h-[30%] min-h-14 flex-col justify-center gap-0.5 px-4" style={{ background: c.scale["50"] ?? "#fff" }}>
          <span className="text-[15px] font-medium" style={{ color: readableOn(c.scale["50"] ?? "#fff") }}>
            {c.name}
          </span>
          <span className="font-mono text-[12px] opacity-70" style={{ color: readableOn(c.scale["50"] ?? "#fff") }}>
            {c.hex}
          </span>
        </div>
        <span className="sr-only">{ink}</span>
      </div>
    );
  }
  if (item.kind === "type") {
    const role = item.ref === "text" ? "text" : item.ref === "mono" ? "mono" : "display";
    const f = (role === "mono" ? brand.typography.mono : brand.typography[role]) ?? brand.typography.display;
    return (
      <div className="flex size-full flex-col justify-between bg-[#FBFAF8] p-7 text-[#161616]">
        <span className="text-[14px] text-[#7b7a76]">{role === "display" ? "Primary font" : "Secondary font"}</span>
        <span className="truncate text-[64px] leading-none tracking-[-0.02em]" style={{ fontFamily: `"${f.family}", ${f.fallback}` }}>
          {f.family}
        </span>
        <span className="text-[15px] leading-snug text-[#4a4a48]" style={{ fontFamily: `"${f.family}", ${f.fallback}` }}>
          Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm
          <br />
          0123456789 !?&amp;@
        </span>
      </div>
    );
  }
  return editing ? (
    <textarea
      autoFocus
      defaultValue={item.text}
      aria-label="Note text"
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={(e) => onDoneEditing(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) e.currentTarget.blur();
      }}
      className="size-full resize-none bg-[#FBFAF8] p-5 text-[18px] leading-snug outline-none"
      style={{ fontFamily: "var(--b-text)", color: "#161616" }}
    />
  ) : (
    <div
      className="size-full overflow-hidden bg-[#FBFAF8] p-5 text-[18px] leading-snug whitespace-pre-wrap text-[#161616]"
      style={{ fontFamily: "var(--b-text)" }}
    >
      {item.text || <span className="text-[#7b7a76]">Double-click to write</span>}
    </div>
  );
}

function AddMenu({
  label,
  options,
  onPick,
  align = "left",
}: {
  label: string;
  options: { id: string; label: string; color?: string }[];
  onPick: (id: string) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" className="btn btn-outline" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} disabled={!options.length}>
        {label}
        <svg viewBox="0 0 12 12" className="size-2.5 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="m3 4.5 3 3 3-3" />
        </svg>
      </button>
      {open && (
        <>
          <button aria-hidden tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className={`panel absolute top-full z-40 mt-1.5 min-w-48 animate-fade-up p-1 shadow-lift ${align === "right" ? "right-0" : "left-0"}`}
          >
            {options.map((o) => (
              <button
                key={o.id}
                role="menuitem"
                type="button"
                className="flex w-full items-center gap-2 rounded-[8px] px-3 py-1.5 text-left text-[13px] hover:bg-sunken"
                onClick={() => {
                  onPick(o.id);
                  setOpen(false);
                }}
              >
                {o.color && <span className="size-3.5 rounded-full ring-1 ring-black/10" style={{ background: o.color }} />}
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
