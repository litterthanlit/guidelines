# Guidelines

**A brand-guidelines studio you build with an AI agent over MCP.**

The agent interviews you, then drafts the whole system: palette, type, logomark, imagery, page copy and **brand boards** — one-page bento compositions of the identity (logo, hero, palette, type, process, poster, web page) drawn with **procedural, on-palette artwork**. You watch every page update live in the studio, and you can edit anything by hand at any time. The agent sees your edits too. When it's right, export design tokens.

```
Claude Code / Desktop / Cursor ──stdio──▶ MCP server ──▶ brands/<slug>/brand.json + assets/
                                                                │ file watcher
                  Designer ──browser──▶ Next.js studio ◀──SSE──┘   (designer edits write the same file)
```

## Quick start

```bash
pnpm install
pnpm dev                       # studio at http://localhost:3000
```

Connect your agent (the command is also on the studio home page, with your path filled in):

```bash
claude mcp add guidelines -- node /absolute/path/to/guidelines/packages/mcp/bin/guidelines-mcp.mjs
```

<details><summary>Claude Desktop / Cursor JSON</summary>

```json
{
  "mcpServers": {
    "guidelines": {
      "command": "node",
      "args": ["/absolute/path/to/guidelines/packages/mcp/bin/guidelines-mcp.mjs"],
      "env": { "FAL_KEY": "optional — enables photographic imagery" }
    }
  }
}
```

</details>

Then ask your agent to run the **`brand_kickoff`** prompt, or just say _"let's make brand guidelines for …"_.

The repo ships with two example brands so you can explore the studio right away:

- **Hypher** (`brands/hypher`) — a bold, grainy identity system shown on three boards: _Overview_ (light editorial), _System_ (dark) and _Index_ (labeled gallery sheet).
- **Meridian** (`brands/meridian`) — a calm, serif guideline deck with an overview board in its own quieter register.

## What's inside

| Package          | Role                                                                                                                                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`  | The single source of truth: Zod brand schema, a pure **op language** (`applyOps`), OKLCH color scales, WCAG + APCA contrast, palette and type-pairing proposals, **board tiles and templates**, the **procedural art engine**, SVG sanitizer, token exporters, brand audit, and the file store. |
| `packages/mcp`   | stdio MCP server whose tools wrap core ops. Includes the image-generation adapter and Playwright page renderer.                                                                                                                                                                                 |
| `apps/web`       | Next.js 16 studio: page editor, moodboard, tokens and a present mode. Live-synced through a file watcher and Server-Sent Events.                                                                                                                                                                |
| `brands/<slug>/` | Your brand projects: `brand.json`, `assets/`, `history/` (undo snapshots), `activity.jsonl`, `exports/`. Git-friendly.                                                                                                                                                                          |

### MCP surface

- **Read:** `list_brands` · `get_brand` (compact summary + `rev`) · `get_page` · `list_layouts` · `list_tiles` (tile kinds, art styles, board templates) · `list_fonts` · `render_preview` (a PNG of any page or board, so the agent can _see_ its work)
- **Create and edit:** `create_brand` · `update_meta` · `set_palette` (generates 50–950 OKLCH scales and takes color _traits_; **refuses body text below WCAG AA** unless forced) · `update_color` · `set_typography` · `set_logo` (mark, wordmark typeface, weight, tracking) · `set_icons` · `set_imagery_style` · `add_page` / `update_page` / `remove_page` / `reorder_pages` · `apply_ops` (atomic batch) · `undo`
- **Brand boards:** `add_board` (template: `overview`, `system`, `index` or `blank`) · `add_tile` · `update_tile` · `remove_tile`
- **Generate:** `propose_palettes` · `propose_type_pairings` · `generate_image` · `add_image_from_url` · `board_add` · `board_arrange`
- **Review and export:** `audit_brand` · `export_tokens` (`css`, `tailwind` v4 `@theme`, `w3c-json` (DTCG), `figma-variables-json`)
- **Prompts:** `brand_kickoff` · `review_guidelines`
- **Resources:** `brand://{slug}` · `brand://{slug}/tokens.css`

### Image generation

`generate_image` picks a provider automatically:

| Env                         | Provider                                                                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FAL_KEY`                   | fal.ai Flux (`FAL_MODEL`, default `fal-ai/flux/dev`)                                                                                                            |
| `OPENAI_API_KEY`            | OpenAI images (`OPENAI_IMAGE_MODEL`, default `gpt-image-1`)                                                                                                     |
| _(none)_                    | Offline procedural artwork in the brand palette (see below); the style comes from `art` or from the prompt ("burst", "swirl", "flow", "orb", "grid", "streak"…) |
| `GUIDELINES_IMAGE_PROVIDER` | Force `fal`, `openai` or `gradient`                                                                                                                             |

The brand's art direction and palette are added to every prompt, so imagery stays coherent across pages.

### Procedural artwork

Thirteen deterministic, seeded SVG styles, drawn from the brand's palette _roles_ (background, text, primary, secondary, accent), so they recolor live when the palette changes:

| Style                            | Use it for                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `burst` · `converge` · `diverge` | Grain-sprayed ray fields around a dark core with an accent spark — heroes, “capture → resume” stories    |
| `swirl`                          | Sweeping ribbons around a vortex — side panels and posters                                               |
| `flow` · `strata`                | Fine line art: lines funnelling through a channel; stacked isometric planes — systems, pipelines, memory |
| `stripes` · `prism` · `star`     | Geometric emblems: striped polygon, faceted radial gradient, starburst — illustration cards              |
| `orb` · `grid`                   | A glowing planetary rim; a hairline grid with glowing cells — logo backdrops, patterns                   |
| `haze` · `bands`                 | Soft blurred orbs; horizontal motion bands — calm, atmospheric brands                                    |

A spec is a short string that fits any slot: `"burst:3"` (style and seed). Grain is a displacement-map spray, so soft color breaks up like risograph ink while line art stays crisp at 1 device pixel. Pages and tiles render artwork live in the browser; `generate_image` without an API key saves the same artwork as an SVG asset.

### Other environment variables

| Env                   | Default                 | Purpose                                     |
| --------------------- | ----------------------- | ------------------------------------------- |
| `GUIDELINES_DIR`      | `<repo>/brands`         | Where brand projects live                   |
| `GUIDELINES_APP_URL`  | `http://localhost:3000` | Studio URL for `render_preview` and links   |
| `GUIDELINES_CHROMIUM` | Playwright's            | Chrome/Chromium binary for `render_preview` |

## How the agent and designer stay in sync

- **One op language.** Every change, from the agent or from a click in the studio, is an `Op` applied by the same pure `applyOps` function. The studio applies ops optimistically on the client with the exact code the server runs.
- **Revisions.** Each write bumps `rev`, snapshots to `history/`, and logs to `activity.jsonl` with the actor (agent or designer). Writes are serialized with a lock file and land atomically.
- **Optimistic concurrency for the agent.** Agent tools accept `expectedRev`. If the designer edited in the meantime, the write is rejected and the agent re-reads instead of clobbering your work. Designer ops are field-level merges, so they're never rejected.
- **Live.** A chokidar watcher sees `brand.json` change and pushes an SSE event. The studio pulls the new revision, briefly highlights the pages that changed, and shows a toast naming the agent's change.

## Design notes

**Studio chrome stays neutral.** It uses off-white `#F4F4F2`, hairline borders and Geist Sans + Geist Mono. The single signal accent (`#FF4F1F`) is reserved for live and agent activity and for focus rings, so the brand being designed is the only thing with color on screen. Mono `[001]`-style labels give the studio an archival, editorial feel.

**Pages are editorial spreads.** A narrow text column (lockup, section title, body, folio) sits beside a large media field. This is the pattern of print brand books, and it reads well at every size. Every page is a 16:9 container that scales with **container-query units** (`--u = 1cqw`), so it looks identical as a thumbnail, in the editor, fullscreen and in renders. Below 560px wide, spreads reflow into a stacked mobile layout.

**Ten layouts:** cover, statement (glass card on a blurred palette gradient, or artwork), logomark (light/dark split with clear space), palette (tonal columns with contrast badges), type specimen (with live type scale), imagery grid, application mockups (billboard, street banner, UI card), iconography, do/don't, and the brand board. Each layout's slots are declared in `core/layouts.ts`, so the agent can introspect them with `list_layouts`.

**Brand boards are bento grids.** A board is a page with `tiles` on a 12-column grid (rows and aspect are per board). Nine tile kinds — logo, hero, art, palette, type, steps, poster, web, text — each have their own slots (`core/tiles.ts`) and a surface tone (light, dark, panel, brand, clear). Three frames cover the common presentation styles: hairline _rules_ between tiles, edge-to-edge _tiles_, and a labeled _gallery_ sheet. Tiles are size containers, so their internals fit their own box (`cqw`/`cqh`), while type stays on the board's `--u` scale so a composition scales as one. `--u` is registered with `@property` so it resolves once, on the slide, instead of drifting inside nested containers. Under 560px wide, tiles stack, each keeping its on-board shape. In the studio, click a tile to select it: the inspector shows its placement, surface and slots, with an artwork picker rendered in the brand's own colors.

**Typographic voice comes from the type scale.** Headlines take their weight and tracking from the largest Display style, so a scale entry of `700 / -0.045em` turns every headline into a tight grotesk without new settings. Labels use tracked mono caps. The wordmark can have its own typeface, weight and tracking, and logomarks keep their true aspect ratio, so wide marks lock up correctly.

**Accessibility.** Body-text contrast is enforced at `set_palette`, and every swatch shows WCAG/APCA figures. Slides use `aria-roledescription="slide"` with labels. Inline editing uses `role="textbox"`. Keyboard support covers everything: ↑/↓ or j/k between pages, P to present, Alt+↑/↓ to reorder, arrow keys to nudge board items, Delete to remove, and ⌘Z to undo. Focus rings are always visible. Everything honors `prefers-reduced-motion`. Logos and icons render only through `<img>` or CSS masks, never inline, as a second line of defense behind the SVG sanitizer.

## Development

```bash
pnpm test         # core + MCP unit/integration tests (vitest)
pnpm typecheck
pnpm format       # prettier

# With `pnpm dev` running:
pnpm --filter @guidelines/web smoke     # screenshots every page and view, fails on console errors
pnpm --filter @guidelines/mcp e2e       # real stdio MCP client ⇄ live studio round-trip in a headless browser
pnpm --filter @guidelines/mcp seed      # rebuild both example brands (seed:hypher for just Hypher)
```

## Roadmap

- PDF export (print stylesheet + Playwright `page.pdf`)
- Remote MCP over Streamable HTTP + auth for a hosted, multi-user studio
- Comments and approvals on pages
- More layouts: voice and tone, grid and spacing, motion, social templates
- Board tiles: drag to move/resize on the canvas, and per-tile export as PNG/SVG for social posts
