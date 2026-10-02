"use client";

import type { Brand, LayoutId, Page } from "@guidelines/core";
import { LAYOUTS } from "@guidelines/core";
import { memo, type ComponentType } from "react";
import {
  ApplicationMockupLayout,
  CoverLayout,
  DoDontLayout,
  IconographyLayout,
  ImageryGridLayout,
  LogomarkLayout,
  PaletteLayout,
  StatementLayout,
  TypeSpecimenLayout,
} from "./layouts";
import { EditContext, SlideContext, type EditApi } from "./slots";

const RENDERERS: Record<LayoutId, ComponentType> = {
  cover: CoverLayout,
  statement: StatementLayout,
  logomark: LogomarkLayout,
  palette: PaletteLayout,
  "type-specimen": TypeSpecimenLayout,
  "imagery-grid": ImageryGridLayout,
  "application-mockup": ApplicationMockupLayout,
  "iconography-grid": IconographyLayout,
  "do-dont": DoDontLayout,
};

/**
 * One guideline page. Must be rendered inside <BrandTheme>. Pass `edit` to make
 * slots inline-editable; omit it for thumbnails, presenting and renders.
 */
export const Slide = memo(function Slide({
  brand,
  page,
  index,
  edit,
  className,
  responsive = true,
}: {
  brand: Brand;
  page: Page;
  index: number;
  edit?: EditApi | null;
  className?: string;
  /** Reflow into the stacked mobile layout on narrow widths. Off for thumbnails. */
  responsive?: boolean;
}) {
  const Renderer = RENDERERS[page.layout];
  return (
    <div className={`slide-shell ${responsive ? "" : "is-fixed"} ${className ?? ""}`}>
      <section
        className={`slide ${edit ? "is-editable" : ""}`}
        data-layout={page.layout}
        aria-roledescription="slide"
        aria-label={`Page ${index + 1}: ${page.slots.title || page.slots.headline || LAYOUTS[page.layout].name}`}
      >
        <SlideContext.Provider value={{ brand, page, index }}>
          <EditContext.Provider value={edit ?? null}>
            <Renderer />
          </EditContext.Provider>
        </SlideContext.Provider>
      </section>
    </div>
  );
});
