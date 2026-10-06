import { z } from "zod";
import { buildScale } from "./color";
import { DEFAULT_SECTIONS, LAYOUTS } from "./layouts";
import {
  Asset,
  Brand,
  BOARD_COLUMNS,
  BoardItem,
  BoardItemKind,
  ColorRole,
  Font,
  Hex,
  Icon,
  LayoutId,
  Logo,
  Meta,
  TileKind,
  TileTone,
  TypeStyle,
  type Brand as BrandT,
  type Page,
  type Tile,
} from "./schema";
import { sanitizeSvg } from "./svg";
import { BOARD_TEMPLATES, boardRows, findSpot, TILES } from "./tiles";

/**
 * Every change to a brand — from the agent or the designer — is expressed as
 * one of these ops and applied by `applyOps`. Pure: never mutates its input.
 */

/**
 * `schema.partial()` without field defaults. In zod 4, defaults still fire
 * inside `.partial()`, so a patch like `{ tagline }` would otherwise reset every
 * other defaulted field (story, voice, wordmark…) to empty.
 */
function patchOf<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  const shape = Object.fromEntries(Object.entries(schema.shape).map(([k, v]) => [k, v instanceof z.ZodDefault ? v.unwrap() : v]));
  return z.object(shape as T).partial();
}

const ColorInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  hex: Hex,
  role: ColorRole,
  usage: z.string().optional(),
  traits: z.array(z.string()).optional(),
});

const TileInput = z.object({
  id: z.string().optional(),
  kind: TileKind,
  x: z.number().int().min(0).optional(),
  y: z.number().int().min(0).optional(),
  w: z.number().int().min(1).optional(),
  h: z.number().int().min(1).optional(),
  tone: TileTone.optional(),
  label: z.string().optional(),
  slots: z.record(z.string(), z.string()).optional(),
});
export type TileInput = z.infer<typeof TileInput>;

const BoardItemInput = BoardItem.extend({
  id: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  w: z.number().positive().optional(),
  h: z.number().positive().optional(),
  z: z.number().int().optional(),
  kind: BoardItemKind,
});

export const Op = z.discriminatedUnion("type", [
  z.object({ type: z.literal("updateMeta"), patch: patchOf(Meta) }),
  z.object({ type: z.literal("setColors"), colors: z.array(ColorInput).min(1), replace: z.boolean().default(true) }),
  z.object({ type: z.literal("updateColor"), id: z.string(), patch: ColorInput.partial() }),
  z.object({ type: z.literal("removeColor"), id: z.string() }),
  z.object({
    type: z.literal("setTypography"),
    display: Font.optional(),
    text: Font.optional(),
    mono: Font.nullable().optional(),
    scale: z.array(TypeStyle).optional(),
  }),
  z.object({
    type: z.literal("setLogo"),
    patch: patchOf(Logo).extend({ markSvg: z.string().nullable().optional(), font: Font.nullable().optional() }),
  }),
  z.object({ type: z.literal("setImageryStyle"), style: z.string() }),
  z.object({ type: z.literal("addAsset"), asset: Asset }),
  z.object({ type: z.literal("updateAsset"), id: z.string(), patch: patchOf(Asset).omit({ id: true, file: true }) }),
  z.object({ type: z.literal("removeAsset"), id: z.string() }),
  z.object({
    type: z.literal("setIcons"),
    icons: z.array(Icon.partial({ id: true })),
    replace: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("addPage"),
    layout: LayoutId,
    slots: z.record(z.string(), z.string()).default({}),
    id: z.string().optional(),
    index: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("updatePage"),
    id: z.string(),
    layout: LayoutId.optional(),
    slots: z.record(z.string(), z.string().nullable()).default({}),
  }),
  z.object({ type: z.literal("removePage"), id: z.string() }),
  z.object({
    type: z.literal("addBoard"),
    /** A BOARD_TEMPLATES id, or "blank". */
    template: z.string().default("overview"),
    id: z.string().optional(),
    index: z.number().int().min(0).optional(),
    title: z.string().optional(),
  }),
  z.object({ type: z.literal("addTiles"), pageId: z.string(), tiles: z.array(TileInput).min(1) }),
  z.object({
    type: z.literal("updateTile"),
    pageId: z.string(),
    id: z.string(),
    patch: TileInput.omit({ id: true, slots: true }).partial().default({}),
    slots: z.record(z.string(), z.string().nullable()).default({}),
  }),
  z.object({ type: z.literal("removeTile"), pageId: z.string(), id: z.string() }),
  z.object({ type: z.literal("setTiles"), pageId: z.string(), tiles: z.array(TileInput) }),
  z.object({ type: z.literal("reorderPages"), ids: z.array(z.string()) }),
  z.object({ type: z.literal("scaffoldPages") }),
  z.object({ type: z.literal("boardAdd"), items: z.array(BoardItemInput).min(1) }),
  z.object({ type: z.literal("boardUpdate"), id: z.string(), patch: patchOf(BoardItem).omit({ id: true }) }),
  z.object({ type: z.literal("boardRemove"), id: z.string() }),
  z.object({
    type: z.literal("boardArrange"),
    columns: z.number().int().min(1).max(8).default(4),
    width: z.number().positive().default(1600),
    gap: z.number().min(0).default(16),
  }),
]);
export type Op = z.infer<typeof Op>;
export type OpInput = z.input<typeof Op>;

export class OpError extends Error {}

let counter = 0;
export function makeId(prefix: string): string {
  counter = (counter + 1) % 1296;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${rand}${counter.toString(36)}`;
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "item"
  );
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  taken.add(id);
  return id;
}

export function describeOp(op: Op): string {
  switch (op.type) {
    case "updateMeta":
      return `Updated brand ${Object.keys(op.patch).join(", ")}`;
    case "setColors":
      return `${op.replace ? "Set" : "Added"} ${op.colors.length} color${op.colors.length === 1 ? "" : "s"}`;
    case "updateColor":
      return `Edited color ${op.id}`;
    case "removeColor":
      return `Removed color ${op.id}`;
    case "setTypography":
      return `Updated typography (${[op.display && "display", op.text && "text", op.mono !== undefined && "mono", op.scale && "scale"].filter(Boolean).join(", ")})`;
    case "setLogo":
      return `Updated logo ${Object.keys(op.patch).join(", ")}`;
    case "setImageryStyle":
      return "Updated imagery direction";
    case "addAsset":
      return `Added asset ${op.asset.id}`;
    case "updateAsset":
      return `Edited asset ${op.id}`;
    case "removeAsset":
      return `Removed asset ${op.id}`;
    case "setIcons":
      return `${op.replace ? "Set" : "Added"} ${op.icons.length} icons`;
    case "addPage":
      return `Added ${LAYOUTS[op.layout].name} page`;
    case "updatePage":
      return `Edited page ${op.id}`;
    case "removePage":
      return `Removed page ${op.id}`;
    case "addBoard":
      return `Added ${BOARD_TEMPLATES[op.template]?.name ?? "blank"} board`;
    case "addTiles":
      return `Added ${op.tiles.map((t) => TILES[t.kind].name.toLowerCase()).join(", ")} tile${op.tiles.length === 1 ? "" : "s"}`;
    case "updateTile":
      return `Edited ${op.id} tile`;
    case "removeTile":
      return `Removed ${op.id} tile`;
    case "setTiles":
      return `Rebuilt board ${op.pageId}`;
    case "reorderPages":
      return "Reordered pages";
    case "scaffoldPages":
      return "Scaffolded default sections";
    case "boardAdd":
      return `Added ${op.items.length} moodboard item${op.items.length === 1 ? "" : "s"}`;
    case "boardUpdate":
      return "Moved moodboard item";
    case "boardRemove":
      return "Removed moodboard item";
    case "boardArrange":
      return "Auto-arranged moodboard";
  }
}

function applyOne(b: BrandT, op: Op): BrandT {
  switch (op.type) {
    case "updateMeta":
      return { ...b, meta: { ...b.meta, ...stripUndefined(op.patch) } };

    case "setColors": {
      const base = op.replace ? [] : b.colors;
      const taken = new Set(base.map((c) => c.id));
      const added = op.colors.map((c) => ({
        id: c.id && !taken.has(c.id) ? (taken.add(c.id), c.id) : uniqueId(slugify(c.name), taken),
        name: c.name,
        hex: c.hex,
        role: c.role,
        usage: c.usage ?? "",
        traits: c.traits ?? [],
        scale: buildScale(c.hex),
      }));
      return { ...b, colors: [...base, ...added] };
    }

    case "updateColor": {
      const idx = b.colors.findIndex((c) => c.id === op.id);
      if (idx < 0) throw new OpError(`No color with id "${op.id}".`);
      const prev = b.colors[idx]!;
      const next = { ...prev, ...stripUndefined(op.patch), id: prev.id };
      if (op.patch.hex) next.scale = buildScale(op.patch.hex);
      const colors = [...b.colors];
      colors[idx] = next;
      return { ...b, colors };
    }

    case "removeColor":
      ensure(
        b.colors.some((c) => c.id === op.id),
        `No color with id "${op.id}".`,
      );
      return {
        ...b,
        colors: b.colors.filter((c) => c.id !== op.id),
        board: { items: b.board.items.filter((i) => !(i.kind === "swatch" && i.ref === op.id)) },
      };

    case "setTypography": {
      const t = { ...b.typography };
      if (op.display) t.display = op.display;
      if (op.text) t.text = op.text;
      if (op.mono === null) delete t.mono;
      else if (op.mono) t.mono = op.mono;
      if (op.scale) t.scale = op.scale;
      return { ...b, typography: t };
    }

    case "setLogo": {
      const { markSvg, font, ...rest } = stripUndefined(op.patch);
      const logo = { ...b.logo, ...rest };
      if (markSvg === null) delete logo.markSvg;
      else if (markSvg !== undefined) logo.markSvg = sanitizeSvg(markSvg);
      if (font === null) delete logo.font;
      else if (font !== undefined) logo.font = font;
      return { ...b, logo };
    }

    case "setImageryStyle":
      return { ...b, imagery: { ...b.imagery, style: op.style } };

    case "addAsset": {
      ensure(!b.imagery.assets.some((a) => a.id === op.asset.id), `Asset id "${op.asset.id}" already exists.`);
      ensure(!op.asset.file.includes("..") && !op.asset.file.startsWith("/"), "Asset file must be a relative path inside the brand folder.");
      return { ...b, imagery: { ...b.imagery, assets: [...b.imagery.assets, op.asset] } };
    }

    case "updateAsset": {
      ensure(
        b.imagery.assets.some((a) => a.id === op.id),
        `No asset with id "${op.id}".`,
      );
      return {
        ...b,
        imagery: {
          ...b.imagery,
          assets: b.imagery.assets.map((a) => (a.id === op.id ? { ...a, ...stripUndefined(op.patch) } : a)),
        },
      };
    }

    case "removeAsset": {
      ensure(
        b.imagery.assets.some((a) => a.id === op.id),
        `No asset with id "${op.id}".`,
      );
      const without = (slots: Record<string, string>) =>
        Object.fromEntries(
          Object.entries(slots).map(([k, v]) => [
            k,
            v
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s !== op.id)
              .join(","),
          ]),
        );
      const pages = b.pages.map((p) => ({
        ...p,
        slots: without(p.slots),
        ...(p.tiles ? { tiles: p.tiles.map((t) => ({ ...t, slots: without(t.slots) })) } : {}),
      }));
      return {
        ...b,
        imagery: { ...b.imagery, assets: b.imagery.assets.filter((a) => a.id !== op.id) },
        pages,
        board: { items: b.board.items.filter((i) => !(i.kind === "image" && i.ref === op.id)) },
      };
    }

    case "setIcons": {
      const base = op.replace ? [] : b.icons;
      const taken = new Set(base.map((i) => i.id));
      const icons = op.icons.map((i) => ({
        id: i.id && !taken.has(i.id) ? (taken.add(i.id), i.id) : uniqueId(slugify(i.name ?? "icon"), taken),
        name: i.name ?? "Icon",
        svg: sanitizeSvg(i.svg ?? ""),
      }));
      return { ...b, icons: [...base, ...icons] };
    }

    case "addPage": {
      const taken = new Set(b.pages.map((p) => p.id));
      const id = op.id ? uniqueId(slugify(op.id), taken) : uniqueId(makeId("p"), taken);
      const page = { id, layout: op.layout, slots: { ...op.slots } };
      const pages = [...b.pages];
      pages.splice(op.index ?? pages.length, 0, page);
      return { ...b, pages };
    }

    case "updatePage": {
      const idx = b.pages.findIndex((p) => p.id === op.id);
      if (idx < 0) throw new OpError(`No page with id "${op.id}".`);
      const prev = b.pages[idx]!;
      const slots = { ...prev.slots };
      for (const [k, v] of Object.entries(op.slots)) {
        if (v === null) delete slots[k];
        else slots[k] = v;
      }
      const pages = [...b.pages];
      pages[idx] = { ...prev, layout: op.layout ?? prev.layout, slots };
      return { ...b, pages };
    }

    case "removePage":
      ensure(
        b.pages.some((p) => p.id === op.id),
        `No page with id "${op.id}".`,
      );
      return { ...b, pages: b.pages.filter((p) => p.id !== op.id) };

    case "reorderPages": {
      const byId = new Map(b.pages.map((p) => [p.id, p]));
      for (const id of op.ids) ensure(byId.has(id), `No page with id "${id}".`);
      const listed = new Set(op.ids);
      const ordered = [...op.ids.map((id) => byId.get(id)!), ...b.pages.filter((p) => !listed.has(p.id))];
      return { ...b, pages: ordered };
    }

    case "addBoard": {
      const taken = new Set(b.pages.map((p) => p.id));
      let draft: { slots: Record<string, string>; tiles: TileInput[] };
      if (op.template === "blank") {
        draft = { slots: { title: "Board", aspect: "3:2", rows: "12", frame: "rules" }, tiles: [] };
      } else {
        const tpl = BOARD_TEMPLATES[op.template];
        ensure(!!tpl, `No board template "${op.template}". Templates: ${Object.keys(BOARD_TEMPLATES).join(", ")}, blank.`);
        draft = tpl.build(b);
      }
      const id = uniqueId(slugify(op.id ?? (op.template === "blank" ? "board" : `board-${op.template}`)), taken);
      const slots = { ...draft.slots, ...(op.title ? { title: op.title } : {}) };
      const page: Page = { id, layout: "board", slots, tiles: placeTiles([], draft.tiles, boardRows(slots)) };
      const pages = [...b.pages];
      pages.splice(op.index ?? pages.length, 0, page);
      return { ...b, pages };
    }

    case "addTiles": {
      const { page, pages, idx } = boardPage(b, op.pageId);
      pages[idx] = { ...page, tiles: placeTiles(page.tiles ?? [], op.tiles, boardRows(page.slots)) };
      return { ...b, pages };
    }

    case "setTiles": {
      const { page, pages, idx } = boardPage(b, op.pageId);
      pages[idx] = { ...page, tiles: placeTiles([], op.tiles, boardRows(page.slots)) };
      return { ...b, pages };
    }

    case "updateTile": {
      const { page, pages, idx } = boardPage(b, op.pageId);
      const tiles = [...(page.tiles ?? [])];
      const ti = tiles.findIndex((t) => t.id === op.id);
      ensure(ti >= 0, `No tile "${op.id}" on page "${op.pageId}". Tiles: ${tiles.map((t) => t.id).join(", ") || "none"}.`);
      const prev = tiles[ti]!;
      const slots = { ...prev.slots };
      for (const [k, v] of Object.entries(op.slots)) {
        if (v === null) delete slots[k];
        else slots[k] = v;
      }
      const next: Tile = { ...prev, ...stripUndefined(op.patch), id: prev.id, slots };
      checkPlacement(next, boardRows(page.slots));
      tiles[ti] = next;
      pages[idx] = { ...page, tiles };
      return { ...b, pages };
    }

    case "removeTile": {
      const { page, pages, idx } = boardPage(b, op.pageId);
      ensure(
        (page.tiles ?? []).some((t) => t.id === op.id),
        `No tile "${op.id}" on page "${op.pageId}".`,
      );
      pages[idx] = { ...page, tiles: (page.tiles ?? []).filter((t) => t.id !== op.id) };
      return { ...b, pages };
    }

    case "scaffoldPages": {
      let next = b;
      for (const s of DEFAULT_SECTIONS) {
        next = applyOne(next, { type: "addPage", layout: s.layout, slots: s.slots });
      }
      // The one-page overview board goes right after the cover.
      return applyOne(next, { type: "addBoard", template: "overview", index: Math.min(1, next.pages.length) });
    }

    case "boardAdd": {
      const taken = new Set(b.board.items.map((i) => i.id));
      const maxZ = b.board.items.reduce((m, i) => Math.max(m, i.z), 0);
      const bottom = b.board.items.reduce((m, i) => Math.max(m, i.y + i.h), 0);
      let cursorX = 0;
      const items = op.items.map((raw, n) => {
        const w = raw.w ?? 320;
        const h = raw.h ?? (raw.kind === "note" ? 160 : 240);
        const item = {
          id: raw.id && !taken.has(raw.id) ? (taken.add(raw.id), raw.id) : uniqueId(makeId("bi"), taken),
          kind: raw.kind,
          ref: raw.ref,
          text: raw.text ?? "",
          x: raw.x ?? cursorX,
          y: raw.y ?? (bottom ? bottom + 16 : 0),
          w,
          h,
          z: raw.z ?? maxZ + n + 1,
        };
        cursorX += w + 16;
        return item;
      });
      for (const item of items) validateBoardRef(b, item.kind, item.ref);
      return { ...b, board: { items: [...b.board.items, ...items] } };
    }

    case "boardUpdate": {
      ensure(
        b.board.items.some((i) => i.id === op.id),
        `No board item with id "${op.id}".`,
      );
      return {
        ...b,
        board: { items: b.board.items.map((i) => (i.id === op.id ? { ...i, ...stripUndefined(op.patch) } : i)) },
      };
    }

    case "boardRemove":
      ensure(
        b.board.items.some((i) => i.id === op.id),
        `No board item with id "${op.id}".`,
      );
      return { ...b, board: { items: b.board.items.filter((i) => i.id !== op.id) } };

    case "boardArrange":
      return { ...b, board: { items: masonry(b.board.items, op.columns, op.width, op.gap) } };
  }
}

function boardPage(b: BrandT, pageId: string) {
  const idx = b.pages.findIndex((p) => p.id === pageId);
  ensure(idx >= 0, `No page with id "${pageId}".`);
  const page = b.pages[idx]!;
  ensure(page.layout === "board", `Page "${pageId}" is a ${page.layout} page; tiles live on board pages (add one with addBoard).`);
  return { page, pages: [...b.pages], idx };
}

function checkPlacement(t: { id: string; x: number; y: number; w: number; h: number }, rows: number) {
  ensure(t.x + t.w <= BOARD_COLUMNS, `Tile "${t.id}" spans columns ${t.x}–${t.x + t.w}; the board has ${BOARD_COLUMNS} (x + w ≤ ${BOARD_COLUMNS}).`);
  ensure(
    t.y + t.h <= rows,
    `Tile "${t.id}" spans rows ${t.y}–${t.y + t.h}; the board has ${rows} rows (y + h ≤ ${rows}). Raise the board's rows slot or move the tile.`,
  );
}

/** Give new tiles ids, default sizes and free spots, and validate placement. */
function placeTiles(existing: Tile[], inputs: TileInput[], rows: number): Tile[] {
  const taken = new Set(existing.map((t) => t.id));
  const out = [...existing];
  for (const raw of inputs) {
    const spec = TILES[raw.kind];
    const w = Math.min(BOARD_COLUMNS, raw.w ?? spec.size.w);
    const h = Math.min(rows, raw.h ?? spec.size.h);
    const id = raw.id && !taken.has(slugify(raw.id)) ? (taken.add(slugify(raw.id)), slugify(raw.id)) : uniqueId(raw.kind, taken);
    let { x, y } = raw;
    if (x === undefined || y === undefined) {
      const spot = findSpot(out, w, h, rows);
      ensure(!!spot, `No free ${w}×${h} space left for the ${raw.kind} tile — pass x/y, shrink it, or raise the board's rows.`);
      x ??= spot.x;
      y ??= spot.y;
    }
    const tile: Tile = { id, kind: raw.kind, x, y, w, h, tone: raw.tone ?? spec.tones[0] ?? "light", label: raw.label ?? "", slots: { ...raw.slots } };
    checkPlacement(tile, rows);
    out.push(tile);
  }
  return out;
}

function validateBoardRef(b: BrandT, kind: string, ref: string | undefined) {
  if (kind === "image") ensure(!!ref && b.imagery.assets.some((a) => a.id === ref), `Board image needs a valid asset id (got "${ref}").`);
  if (kind === "swatch") ensure(!!ref && b.colors.some((c) => c.id === ref), `Board swatch needs a valid color id (got "${ref}").`);
  if (kind === "type") ensure(!ref || ["display", "text", "mono"].includes(ref), `Board type ref must be display, text or mono.`);
}

/** Shortest-column masonry, preserving each item's aspect ratio. */
export function masonry<T extends { w: number; h: number; x: number; y: number; z: number }>(items: T[], columns: number, width: number, gap: number): T[] {
  const colW = (width - gap * (columns - 1)) / columns;
  const heights = new Array<number>(columns).fill(0);
  return [...items]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((item, i) => {
      let col = 0;
      for (let c = 1; c < columns; c++) if (heights[c]! < heights[col]!) col = c;
      const h = Math.round((item.h / item.w) * colW);
      const placed = { ...item, x: Math.round(col * (colW + gap)), y: Math.round(heights[col]!), w: Math.round(colW), h, z: i + 1 };
      heights[col] = heights[col]! + h + gap;
      return placed;
    });
}

function ensure(cond: boolean, message: string): asserts cond {
  if (!cond) throw new OpError(message);
}

function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

/** Validate and apply ops in order. Throws OpError / ZodError on bad input. */
export function applyOps(brand: BrandT, ops: OpInput[]): BrandT {
  let next = structuredClone(brand);
  for (const raw of ops) {
    const op = Op.parse(raw);
    next = applyOne(next, op);
  }
  return Brand.parse(next);
}

export function summarizeOps(ops: OpInput[]): string {
  return ops.map((o) => describeOp(Op.parse(o))).join("; ");
}
