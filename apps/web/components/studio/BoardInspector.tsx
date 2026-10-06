"use client";

import { BOARD_COLUMNS, boardRows, TILE_KINDS, TILES, TileTone, type Page, type Tile, type TileKind } from "@guidelines/core";
import { useId } from "react";
import { SlotField } from "./Inspector";
import { Section, Segmented, TextInput } from "./fields";
import { useStore } from "./store";

/**
 * Board pages: the tile list, an "add tile" control, and an editor for the
 * selected tile (kind, surface, grid placement and its own slots).
 */
export function BoardTiles({ page, tileId, onSelectTile }: { page: Page; tileId?: string; onSelectTile: (id: string | null) => void }) {
  const { apply } = useStore();
  const tiles = page.tiles ?? [];
  const tile = tiles.find((t) => t.id === tileId);
  const addId = useId();
  return (
    <>
      <Section
        title={`Tiles · ${tiles.length}`}
        action={
          <label className="relative">
            <span className="sr-only">Add a tile</span>
            <select
              id={addId}
              className="btn btn-outline h-7! appearance-none pr-3! text-[12px]!"
              value=""
              onChange={(e) => {
                const kind = e.target.value as TileKind;
                if (kind) void apply([{ type: "addTiles", pageId: page.id, tiles: [{ kind }] }]);
              }}
            >
              <option value="">+ Add tile</option>
              {TILE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {TILES[k].name}
                </option>
              ))}
            </select>
          </label>
        }
      >
        <ol className="-mx-2 flex flex-col" aria-label="Tiles on this board">
          {tiles.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                aria-current={t.id === tileId ? "true" : undefined}
                onClick={() => onSelectTile(t.id === tileId ? null : t.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition ${t.id === tileId ? "bg-sunken" : "hover:bg-sunken/60"}`}
              >
                <TileGlyph tile={t} rows={boardRows(page.slots)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{t.label || TILES[t.kind].name}</span>
                  <span className="block font-mono text-[10.5px] text-ink-3">
                    {t.id} · {t.tone}
                  </span>
                </span>
                <span className="font-mono text-[10.5px] text-ink-3">
                  {t.w}×{t.h}
                </span>
              </button>
            </li>
          ))}
          {!tiles.length && <li className="px-2 text-[12px] text-ink-3">No tiles yet.</li>}
        </ol>
      </Section>
      {tile && <TileEditor key={tile.id} page={page} tile={tile} onDone={() => onSelectTile(null)} />}
    </>
  );
}

/** A tiny map of where the tile sits on the 12-column board. */
function TileGlyph({ tile, rows }: { tile: Tile; rows: number }) {
  return (
    <svg viewBox={`0 0 ${BOARD_COLUMNS} ${rows}`} className="h-6 w-9 shrink-0 rounded-[3px] bg-sunken" preserveAspectRatio="none" aria-hidden>
      <rect x={tile.x} y={tile.y} width={tile.w} height={tile.h} className={tile.tone === "dark" ? "fill-ink" : "fill-ink-3"} />
    </svg>
  );
}

function TileEditor({ page, tile, onDone }: { page: Page; tile: Tile; onDone: () => void }) {
  const { apply } = useStore();
  const spec = TILES[tile.kind];
  const rows = boardRows(page.slots);
  const patch = (p: Partial<Pick<Tile, "kind" | "x" | "y" | "w" | "h" | "tone" | "label">>) =>
    void apply([{ type: "updateTile", pageId: page.id, id: tile.id, patch: p }]);
  const setSlot = (key: string, value: string | null) => void apply([{ type: "updateTile", pageId: page.id, id: tile.id, slots: { [key]: value } }]);
  const tone = tile.tone === "dark" ? "dark" : "light";

  const num = (key: "x" | "y" | "w" | "h", label: string, min: number, max: number) => (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-ink-3">{label}</span>
      <input
        key={tile[key]}
        type="number"
        className="field font-mono"
        min={min}
        max={max}
        defaultValue={tile[key]}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isInteger(v) && v >= min && v <= max && v !== tile[key]) patch({ [key]: v });
        }}
      />
    </label>
  );

  return (
    <>
      <Section
        title={`${spec.name} tile`}
        action={
          <button type="button" className="text-[12px] text-ink-3 hover:text-ink" onClick={onDone}>
            Done
          </button>
        }
      >
        <p className="-mt-2 text-[11.5px] text-ink-3">{spec.description}</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`kind-${tile.id}`} className="text-[12px] font-medium text-ink-2">
            Kind
          </label>
          <select id={`kind-${tile.id}`} className="field" value={tile.kind} onChange={(e) => patch({ kind: e.target.value as TileKind })}>
            {TILE_KINDS.map((k) => (
              <option key={k} value={k}>
                {TILES[k].name}
              </option>
            ))}
          </select>
        </div>
        <Segmented
          label="Surface"
          value={tile.tone}
          options={TileTone.options.filter((t) => spec.tones.includes(t))}
          onChange={(v) => patch({ tone: v as Tile["tone"] })}
        />
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[12px] font-medium text-ink-2">Placement · 12 columns × {rows} rows</legend>
          <div className="grid grid-cols-4 gap-2">
            {num("x", "Column", 0, BOARD_COLUMNS - 1)}
            {num("y", "Row", 0, rows - 1)}
            {num("w", "Width", 1, BOARD_COLUMNS)}
            {num("h", "Height", 1, rows)}
          </div>
        </fieldset>
        <TextInput label="Label" value={tile.label} hint="Shown above the tile on gallery boards." onCommit={(label) => patch({ label: label.trim() })} />
      </Section>
      <Section title="Tile content">
        {spec.slots.map((s) => (
          <SlotField
            key={s.key}
            spec={s}
            value={tile.slots[s.key] ?? ""}
            target={{ pageId: page.id, tileId: tile.id }}
            tone={tone}
            onChange={(v) => setSlot(s.key, v)}
          />
        ))}
      </Section>
      <Section title="Tile actions">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() =>
              void apply([
                {
                  type: "addTiles",
                  pageId: page.id,
                  tiles: [{ kind: tile.kind, w: tile.w, h: tile.h, tone: tile.tone, label: tile.label, slots: tile.slots }],
                },
              ])
            }
          >
            Duplicate
          </button>
          <button
            type="button"
            className="btn btn-outline text-red-600!"
            onClick={() => {
              void apply([{ type: "removeTile", pageId: page.id, id: tile.id }]);
              onDone();
            }}
          >
            Delete tile
          </button>
        </div>
      </Section>
    </>
  );
}
