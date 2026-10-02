"use client";

import { LAYOUT_IDS, LAYOUTS, type LayoutId } from "@guidelines/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Slide } from "../brand/Slide";
import type { EditApi } from "../brand/slots";
import { BrandTheme } from "../brand/theme";
import { Inspector } from "./Inspector";
import { Present } from "./Present";
import { isTyping } from "./StudioBar";
import { useStore } from "./store";

export function PagesView() {
  const { brand, apply, upload, flashed } = useStore();
  const [selected, setSelected] = useState<string | undefined>(brand.pages[0]?.id);
  const [presenting, setPresenting] = useState<number | null>(null);
  const [drawer, setDrawer] = useState<"pages" | "inspect" | null>(null);
  const refs = useRef(new Map<string, HTMLElement>());

  // Keep a valid selection as pages come and go.
  useEffect(() => {
    if (!selected || !brand.pages.some((p) => p.id === selected)) setSelected(brand.pages[0]?.id);
  }, [brand.pages, selected]);

  const edit = useMemo<EditApi>(
    () => ({
      setSlot: (pageId, key, value) => void apply([{ type: "updatePage", id: pageId, slots: { [key]: value } }]),
      upload: (file, t) => void upload(file, t),
    }),
    [apply, upload],
  );

  const select = useCallback((id: string, scroll = true) => {
    setSelected(id);
    if (scroll) refs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey || presenting !== null) return;
      const idx = brand.pages.findIndex((p) => p.id === selected);
      if (e.key === "ArrowDown" || e.key === "j") {
        const next = brand.pages[Math.min(brand.pages.length - 1, idx + 1)];
        if (next) {
          e.preventDefault();
          select(next.id);
        }
      } else if (e.key === "ArrowUp" || e.key === "k") {
        const prev = brand.pages[Math.max(0, idx - 1)];
        if (prev) {
          e.preventDefault();
          select(prev.id);
        }
      } else if (e.key === "p") {
        setPresenting(Math.max(0, idx));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [brand.pages, selected, select, presenting]);

  const addPage = (layout: LayoutId) => {
    const idx = brand.pages.findIndex((p) => p.id === selected);
    const title: Record<string, string> = LAYOUTS[layout].slots.some((s) => s.key === "title") ? { title: LAYOUTS[layout].name } : {};
    void apply([{ type: "addPage", layout, slots: title, index: idx >= 0 ? idx + 1 : undefined }]);
  };

  return (
    <BrandTheme brand={brand} className="h-full">
      <div className="grid h-full lg:grid-cols-[208px_minmax(0,1fr)_340px]">
        {/* Page rail */}
        <aside
          aria-label="Pages"
          className={`${drawer === "pages" ? "fixed inset-y-14 left-0 z-30 w-[240px] shadow-lift" : "hidden"} min-h-0 flex-col border-r border-line bg-canvas lg:static lg:flex lg:w-auto lg:shadow-none`}
        >
          <PageRail selected={selected} onSelect={(id) => (select(id), setDrawer(null))} onAdd={addPage} />
        </aside>

        {/* Canvas */}
        <div className="relative min-h-0 overflow-y-auto scrollbar-thin" id="canvas">
          <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-canvas/85 px-4 py-2 backdrop-blur-md">
            <button
              type="button"
              className="btn btn-ghost lg:hidden"
              onClick={() => setDrawer(drawer === "pages" ? null : "pages")}
              aria-expanded={drawer === "pages"}
            >
              Pages
            </button>
            <span className="label hidden lg:inline">{brand.pages.length} pages · ↑↓ to move · P to present</span>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() =>
                  setPresenting(
                    Math.max(
                      0,
                      brand.pages.findIndex((p) => p.id === selected),
                    ),
                  )
                }
                disabled={!brand.pages.length}
              >
                <svg viewBox="0 0 16 16" className="size-3" fill="currentColor" aria-hidden>
                  <path d="M4 2.5v11l9-5.5z" />
                </svg>
                Present
              </button>
              <button
                type="button"
                className="btn btn-ghost xl:hidden lg:hidden"
                onClick={() => setDrawer(drawer === "inspect" ? null : "inspect")}
                aria-expanded={drawer === "inspect"}
              >
                Inspect
              </button>
            </div>
          </div>

          <ol className="mx-auto flex max-w-[1180px] flex-col gap-8 px-4 py-8 pb-28 sm:px-8 md:gap-12">
            {brand.pages.map((page, i) => {
              const isSel = page.id === selected;
              return (
                <li
                  key={page.id}
                  ref={(el) => {
                    if (el) refs.current.set(page.id, el);
                    else refs.current.delete(page.id);
                  }}
                  className="scroll-mt-20"
                >
                  <div className="mb-2 flex items-baseline gap-3">
                    <span className="label">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-[12px] text-ink-3">{LAYOUTS[page.layout].name}</span>
                  </div>
                  <div
                    onPointerDown={() => select(page.id, false)}
                    onFocusCapture={() => setSelected(page.id)}
                    className={`overflow-hidden rounded-[6px] transition-shadow duration-300 ${
                      isSel ? "shadow-lift ring-2 ring-ink ring-offset-4 ring-offset-canvas" : "shadow-float"
                    } ${flashed.has(page.id) ? "animate-flash" : ""}`}
                  >
                    <Slide brand={brand} page={page} index={i} edit={edit} />
                  </div>
                </li>
              );
            })}
            {brand.pages.length === 0 && (
              <li className="panel flex flex-col items-center gap-3 p-12 text-center">
                <p className="text-ink-2">No pages yet.</p>
                <button className="btn btn-primary" onClick={() => void apply([{ type: "scaffoldPages" }])}>
                  Scaffold default sections
                </button>
              </li>
            )}
          </ol>
        </div>

        {/* Inspector */}
        <aside
          aria-label="Inspector"
          className={`${drawer === "inspect" ? "fixed inset-y-14 right-0 z-30 w-[min(360px,100vw)] shadow-lift" : "hidden"} min-h-0 flex-col border-l border-line bg-surface lg:static lg:flex lg:w-auto lg:shadow-none`}
        >
          <Inspector pageId={selected} onSelect={select} />
        </aside>
      </div>

      {drawer && <button aria-label="Close panel" className="fixed inset-0 z-20 bg-black/10 lg:hidden" onClick={() => setDrawer(null)} />}
      {presenting !== null && <Present start={presenting} onClose={() => setPresenting(null)} />}
    </BrandTheme>
  );
}

function PageRail({ selected, onSelect, onAdd }: { selected?: string; onSelect: (id: string) => void; onAdd: (l: LayoutId) => void }) {
  const { brand, apply } = useStore();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);

  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = brand.pages.map((p) => p.id).filter((id) => id !== dragId);
    ids.splice(ids.indexOf(targetId) + (brand.pages.findIndex((p) => p.id === dragId) < brand.pages.findIndex((p) => p.id === targetId) ? 1 : 0), 0, dragId);
    void apply([{ type: "reorderPages", ids }]);
  };

  const move = (id: string, delta: number) => {
    const ids = brand.pages.map((p) => p.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    void apply([{ type: "reorderPages", ids }]);
  };

  return (
    <>
      <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 scrollbar-thin" aria-label="Page order — drag, or use Alt+↑/↓ to reorder">
        {brand.pages.map((p, i) => (
          <li
            key={p.id}
            draggable
            onDragStart={(e) => {
              setDragId(p.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              setOverId(p.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(p.id);
              setOverId(null);
            }}
            className={`transition ${dragId === p.id ? "opacity-40" : ""} ${overId === p.id && dragId !== p.id ? "translate-y-1" : ""}`}
          >
            <button
              type="button"
              onClick={() => onSelect(p.id)}
              onKeyDown={(e) => {
                if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                  e.preventDefault();
                  e.stopPropagation();
                  move(p.id, e.key === "ArrowUp" ? -1 : 1);
                }
              }}
              aria-current={p.id === selected ? "true" : undefined}
              aria-label={`Page ${i + 1}: ${LAYOUTS[p.layout].name}`}
              className="group block w-full text-left"
            >
              <div className="mb-1 flex items-baseline justify-between">
                <span className={`font-mono text-[10.5px] ${p.id === selected ? "text-ink" : "text-ink-3"}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className="truncate pl-2 text-[11px] text-ink-3">{p.slots.title || LAYOUTS[p.layout].name}</span>
              </div>
              <div
                className={`pointer-events-none overflow-hidden rounded-[4px] ring-offset-2 ring-offset-canvas transition ${p.id === selected ? "ring-2 ring-ink" : "ring-1 ring-line group-hover:ring-line-strong"}`}
                aria-hidden
              >
                <Slide brand={brand} page={p} index={i} responsive={false} />
              </div>
            </button>
          </li>
        ))}
      </ol>
      <div className="relative border-t border-line p-3">
        <button type="button" className="btn btn-outline w-full justify-center" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu">
          + Add page
        </button>
        {menu && (
          <div role="menu" className="panel absolute bottom-full left-3 z-40 mb-2 w-[300px] animate-fade-up overflow-hidden p-1 shadow-lift">
            {LAYOUT_IDS.map((id) => (
              <button
                key={id}
                role="menuitem"
                type="button"
                className="flex w-full flex-col rounded-[10px] px-3 py-2 text-left hover:bg-sunken"
                onClick={() => {
                  onAdd(id);
                  setMenu(false);
                }}
              >
                <span className="text-[13px] font-medium">{LAYOUTS[id].name}</span>
                <span className="line-clamp-1 text-[11.5px] text-ink-3">{LAYOUTS[id].description}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
