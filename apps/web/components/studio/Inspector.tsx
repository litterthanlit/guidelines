"use client";

import {
  ColorRole,
  contrastRatio,
  FONT_CATALOG,
  findCatalogFont,
  LAYOUT_IDS,
  LAYOUTS,
  primaryTextPair,
  svgDataUri,
  wcagLevel,
  type Brand,
  type Font,
  type LayoutId,
  type Page,
  type SlotSpec,
} from "@guidelines/core";
import { useRef, useState } from "react";
import { assetUrl } from "../brand/theme";
import { ArtPicker, ArtsField } from "./ArtPicker";
import { BoardTiles } from "./BoardInspector";
import { Field, Section, Segmented, TextArea, TextInput, useDraft } from "./fields";
import { useStore, type ActivityEntry } from "./store";

type Tab = "page" | "brand" | "activity";

export function Inspector({
  pageId,
  onSelect,
  tileId,
  onSelectTile,
}: {
  pageId?: string;
  onSelect: (id: string) => void;
  tileId?: string;
  onSelectTile: (pageId: string, tileId: string | null) => void;
}) {
  const [tab, setTab] = useState<Tab>("page");
  const { brand } = useStore();
  const page = brand.pages.find((p) => p.id === pageId);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" aria-label="Inspector" className="flex shrink-0 gap-1 border-b border-line px-3 pt-3">
        {(["page", "brand", "activity"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 pb-2.5 text-[13px] capitalize transition ${tab === t ? "border-ink font-medium" : "border-transparent text-ink-3 hover:text-ink"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {tab === "page" &&
          (page ? (
            <PagePanel key={page.id} page={page} onSelect={onSelect} tileId={tileId} onSelectTile={onSelectTile} />
          ) : (
            <p className="p-5 text-ink-3">Select a page.</p>
          ))}
        {tab === "brand" && <BrandPanel />}
        {tab === "activity" && <ActivityPanel />}
      </div>
    </div>
  );
}

/* ───────────────────────────── Page ───────────────────────────── */

function PagePanel({
  page,
  onSelect,
  tileId,
  onSelectTile,
}: {
  page: Page;
  onSelect: (id: string) => void;
  tileId?: string;
  onSelectTile: (pageId: string, tileId: string | null) => void;
}) {
  const { brand, apply } = useStore();
  const spec = LAYOUTS[page.layout];
  const index = brand.pages.indexOf(page);
  const set = (key: string, value: string | null) => void apply([{ type: "updatePage", id: page.id, slots: { [key]: value } }]);

  return (
    <>
      <Section title={`Page ${index + 1}`}>
        <Field label="Layout" hint={spec.description}>
          {(id) => (
            <select
              id={id}
              className="field"
              value={page.layout}
              onChange={(e) => void apply([{ type: "updatePage", id: page.id, layout: e.target.value as LayoutId }])}
            >
              {LAYOUT_IDS.map((l) => (
                <option key={l} value={l}>
                  {LAYOUTS[l].name}
                </option>
              ))}
            </select>
          )}
        </Field>
      </Section>
      <Section title={page.layout === "board" ? "Board" : "Content"}>
        {spec.slots.map((s) => (
          <SlotField key={s.key} spec={s} value={page.slots[s.key] ?? ""} target={{ pageId: page.id }} onChange={(v) => set(s.key, v)} />
        ))}
      </Section>
      {page.layout === "board" && <BoardTiles page={page} tileId={tileId} onSelectTile={(id) => onSelectTile(page.id, id)} />}
      <Section title="Page actions">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => void apply([{ type: "addPage", layout: page.layout, slots: page.slots, index: index + 1 }])}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="btn btn-outline text-red-600!"
            onClick={() => {
              const next = brand.pages[index + 1] ?? brand.pages[index - 1];
              void apply([{ type: "removePage", id: page.id }]);
              if (next) onSelect(next.id);
            }}
          >
            Delete page
          </button>
        </div>
        <p className="font-mono text-[11px] text-ink-3">id: {page.id}</p>
      </Section>
    </>
  );
}

export interface SlotTarget {
  pageId: string;
  tileId?: string;
}

export function SlotField({
  spec,
  value,
  target,
  tone,
  onChange,
}: {
  spec: SlotSpec;
  value: string;
  target: SlotTarget;
  /** Surface the slot renders on, for artwork previews. */
  tone?: "light" | "dark";
  onChange: (v: string | null) => void;
}) {
  const commit = (v: string) => onChange(v.trim() ? v : null);
  switch (spec.kind) {
    case "text":
      return <TextInput label={spec.label} value={value} onCommit={commit} hint={spec.hint} />;
    case "richtext":
    case "lines":
      return <TextArea label={spec.label} value={value} onCommit={commit} hint={spec.hint} rows={spec.kind === "lines" ? 4 : 4} />;
    case "option":
      return <Segmented label={spec.label} value={value || spec.options?.[0] || ""} options={spec.options ?? []} onChange={onChange} />;
    case "asset":
    case "assets":
      return <AssetPicker spec={spec} target={target} value={value} onChange={onChange} />;
    case "art":
      return <ArtPicker label={spec.label} hint={spec.hint} value={value} tone={tone ?? "light"} onChange={onChange} />;
    case "arts":
      return <ArtsField label={spec.label} hint={spec.hint} value={value} tone={tone ?? "light"} onCommit={commit} />;
  }
}

function AssetPicker({ spec, target, value, onChange }: { spec: SlotSpec; target: SlotTarget; value: string; onChange: (v: string | null) => void }) {
  const { brand, upload } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const multi = spec.kind === "assets";
  const chosen = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const toggle = (id: string) => {
    if (!multi) return onChange(chosen[0] === id ? null : id);
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id].slice(0, 6);
    onChange(next.length ? next.join(",") : null);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-ink-2">
          {spec.label}
          {multi && <span className="ml-1 font-normal text-ink-3">({chosen.length}/6)</span>}
        </span>
        <button type="button" className="text-[12px] text-ink-2 underline-offset-2 hover:underline" onClick={() => input.current?.click()}>
          Upload…
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple={multi}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            for (const f of [...(e.target.files ?? [])].slice(0, multi ? 6 : 1))
              void upload(f, { pageId: target.pageId, tileId: target.tileId, slot: spec.key, append: multi });
            e.target.value = "";
          }}
        />
      </div>
      {brand.imagery.assets.length ? (
        <div className="grid grid-cols-4 gap-1.5">
          {brand.imagery.assets.map((a) => {
            const on = chosen.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={on}
                title={a.alt || a.id}
                onClick={() => toggle(a.id)}
                className={`relative aspect-square overflow-hidden rounded-md bg-sunken transition ${on ? "ring-2 ring-ink ring-offset-1" : "opacity-80 hover:opacity-100"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assetUrl(brand.slug, a.file)} alt={a.alt} className="size-full object-cover" loading="lazy" />
                {on && multi && (
                  <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-ink font-mono text-[9px] text-white">
                    {chosen.indexOf(a.id) + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-line-strong p-3 text-center text-[12px] text-ink-3">
          No images yet. Upload, drop onto the page, or ask the agent to generate.
        </p>
      )}
    </div>
  );
}

/* ───────────────────────────── Brand ───────────────────────────── */

function BrandPanel() {
  const { brand, apply } = useStore();
  const pair = primaryTextPair(brand.colors);
  return (
    <>
      <Section title="Identity">
        <TextInput label="Name" value={brand.meta.name} onCommit={(name) => name.trim() && void apply([{ type: "updateMeta", patch: { name } }])} />
        <TextInput label="Tagline" value={brand.meta.tagline} onCommit={(tagline) => void apply([{ type: "updateMeta", patch: { tagline } }])} />
        <TextArea label="Story" value={brand.meta.story} onCommit={(story) => void apply([{ type: "updateMeta", patch: { story } }])} />
        <TextInput
          label="Voice"
          hint="Comma separated"
          value={brand.meta.voice.join(", ")}
          onCommit={(v) =>
            void apply([
              {
                type: "updateMeta",
                patch: {
                  voice: v
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              },
            ])
          }
        />
      </Section>

      <Section
        title="Color"
        action={
          pair && (
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10.5px] ${pair.ratio >= 4.5 ? "bg-green-50 text-ok" : "bg-red-50 text-red-600"}`}
              title="Body text on background"
            >
              Body {pair.ratio}:1 {pair.level}
            </span>
          )
        }
      >
        <ul className="flex flex-col gap-2">
          {brand.colors.map((c) => (
            <ColorRow key={c.id} id={c.id} />
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-outline w-fit"
          onClick={() => void apply([{ type: "setColors", replace: false, colors: [{ name: "New color", hex: "#8899AA", role: "accent" }] }])}
        >
          + Add color
        </button>
      </Section>

      <Section title="Typography">
        <FontPicker label="Display" role="display" font={brand.typography.display} />
        <FontPicker label="Text" role="text" font={brand.typography.text} />
      </Section>

      <Section title="Logo">
        <TextInput label="Wordmark" value={brand.logo.wordmark} onCommit={(wordmark) => void apply([{ type: "setLogo", patch: { wordmark } }])} />
        <LogoMarkField />
      </Section>

      <Section title="Imagery direction">
        <TextArea
          label="Art direction"
          hint="Prepended to every generated image prompt."
          value={brand.imagery.style}
          onCommit={(style) => void apply([{ type: "setImageryStyle", style }])}
        />
      </Section>
    </>
  );
}

function ColorRow({ id }: { id: string }) {
  const { brand, apply } = useStore();
  const c = brand.colors.find((x) => x.id === id)!;
  const { draft, setDraft, bind } = useDraft(c.hex);
  const update = (patch: Record<string, string>) => void apply([{ type: "updateColor", id, patch }]);
  const bg = brand.colors.find((x) => x.role === "background")?.hex ?? "#FFFFFF";
  const ratio = contrastRatio(c.hex, bg);
  return (
    <li className="flex items-center gap-2">
      <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg ring-1 ring-black/10" style={{ background: c.hex }}>
        <span className="sr-only">Pick {c.name}</span>
        <input
          type="color"
          className="absolute inset-0 cursor-pointer opacity-0"
          value={c.hex.toLowerCase()}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          onBlur={() => draft !== c.hex && update({ hex: draft })}
        />
      </label>
      <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto] gap-1">
        <input
          aria-label="Color name"
          className="min-w-0 bg-transparent text-[13px] font-medium outline-none focus:underline"
          defaultValue={c.name}
          key={c.name}
          onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && update({ name: e.target.value.trim() })}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        <select
          aria-label="Role"
          className="bg-transparent text-right text-[11.5px] text-ink-3 outline-none"
          value={c.role}
          onChange={(e) => update({ role: e.target.value })}
        >
          {ColorRole.options.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <input
          aria-label="Hex"
          className="w-20 bg-transparent font-mono text-[11.5px] text-ink-3 uppercase outline-none focus:text-ink"
          value={draft}
          {...bind}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => (/^#[0-9a-f]{6}$/i.test(draft) && draft.toUpperCase() !== c.hex ? update({ hex: draft }) : setDraft(c.hex))}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        <span className="text-right font-mono text-[10.5px] text-ink-3" title={`${c.name} as text on background`}>
          {c.role !== "background" ? `${ratio}:1 ${wcagLevel(ratio)}` : ""}
        </span>
      </div>
      <button
        type="button"
        aria-label={`Remove ${c.name}`}
        className="grid size-7 place-items-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink"
        onClick={() => void apply([{ type: "removeColor", id }])}
      >
        ×
      </button>
    </li>
  );
}

function FontPicker({ label, role, font }: { label: string; role: "display" | "text"; font: Font }) {
  const { apply } = useStore();
  const { draft, setDraft, bind } = useDraft(font.family);
  const listId = `fonts-${role}`;
  const commit = (family: string) => {
    if (!family.trim() || family === font.family) return;
    const cat = findCatalogFont(family);
    const next: Font = {
      ...font,
      family: cat?.family ?? family.trim(),
      source: "google",
      weights: cat ? cat.weights.filter((w) => w >= 300 && w <= 700) : [400],
      italic: false,
      fallback: cat?.fallback ?? font.fallback,
    };
    void apply([{ type: "setTypography", [role]: next }]);
  };
  return (
    <Field label={label} hint={font.usage || undefined}>
      {(id) => (
        <div className="flex items-center gap-2">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-sunken text-[18px]"
            style={{ fontFamily: `"${font.family}", ${font.fallback}` }}
            aria-hidden
          >
            Aa
          </span>
          <input
            id={id}
            list={listId}
            className="field"
            value={draft}
            {...bind}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
          <datalist id={listId}>
            {FONT_CATALOG.map((f) => (
              <option key={f.family} value={f.family}>
                {f.category} · {f.mood.slice(0, 2).join(", ")}
              </option>
            ))}
          </datalist>
        </div>
      )}
    </Field>
  );
}

function LogoMarkField() {
  const { brand, apply, toast } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const svg = brand.logo.markSvg;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-medium text-ink-2">Logomark</span>
      <div className="flex items-center gap-3">
        <div className="grid size-16 place-items-center rounded-xl bg-sunken">
          {svg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={svgDataUri(svg)} alt="Current logomark" className="size-9" />
          ) : (
            <span className="text-[11px] text-ink-3">None</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <button type="button" className="btn btn-outline" onClick={() => input.current?.click()}>
            Upload SVG
          </button>
          {svg && (
            <button
              type="button"
              className="text-left text-[12px] text-ink-3 hover:text-ink"
              onClick={() => void apply([{ type: "setLogo", patch: { markSvg: null } }])}
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept=".svg,image/svg+xml"
          className="sr-only"
          tabIndex={-1}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (f.size > 200_000) return toast("SVG is too large (max 200 KB).", "error");
            void apply([{ type: "setLogo", patch: { markSvg: await f.text() } }]);
          }}
        />
      </div>
      <p className="text-[11.5px] text-ink-3">Use fill=&quot;currentColor&quot; so the mark recolors on light and dark.</p>
    </div>
  );
}

/* ───────────────────────────── Activity ───────────────────────────── */

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "now";
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
};

function ActivityPanel() {
  const { activity, undo } = useStore();
  return (
    <Section
      title="Activity"
      action={
        <button type="button" className="btn btn-outline h-7! text-[12px]!" onClick={() => void undo()}>
          Undo last
        </button>
      }
    >
      <ol className="relative flex flex-col">
        {activity.map((a: ActivityEntry) => (
          <li key={`${a.rev}-${a.at}`} className="flex gap-3 border-l border-line py-2 pl-4">
            <span
              className={`-ml-[21px] mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-surface ${a.actor === "agent" ? "bg-signal" : a.actor === "designer" ? "bg-ink" : "bg-ink-3"}`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-snug">{a.summary}</p>
              <p className="mt-0.5 font-mono text-[10.5px] text-ink-3">
                {a.actor} · rev {a.rev} · {ago(a.at)}
              </p>
            </div>
          </li>
        ))}
        {!activity.length && <li className="text-ink-3">No activity yet.</li>}
      </ol>
    </Section>
  );
}
