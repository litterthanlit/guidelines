/**
 * Conservative SVG sanitizer for agent- or designer-authored marks and icons.
 *
 * Defense in depth: the studio additionally renders SVG only through
 * `<img src="data:...">` or CSS masks, where scripts never execute.
 */

const MAX_SVG_BYTES = 200_000;

const FORBIDDEN_ELEMENTS = ["script", "foreignObject", "iframe", "embed", "object", "audio", "video", "animate", "set", "handler", "listener"];

export class SvgError extends Error {}

export function sanitizeSvg(input: string): string {
  let svg = input.trim();
  if (svg.length > MAX_SVG_BYTES) throw new SvgError(`SVG is too large (${svg.length} bytes, max ${MAX_SVG_BYTES}).`);

  // Drop XML prolog, doctype (entity expansion), and comments.
  svg = svg
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!ENTITY[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .trim();

  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) {
    throw new SvgError("Expected a single <svg>…</svg> element.");
  }

  for (const el of FORBIDDEN_ELEMENTS) {
    const paired = new RegExp(`<${el}\\b[\\s\\S]*?<\\/${el}\\s*>`, "gi");
    const single = new RegExp(`<${el}\\b[^>]*\\/?>`, "gi");
    svg = svg.replace(paired, "").replace(single, "");
  }

  svg = svg
    // Event handler attributes: onload=, onclick=, …
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    // javascript:/data: URLs in href / xlink:href / src
    .replace(/\s+(xlink:)?href\s*=\s*("|')\s*(javascript|data|vbscript):[^"']*\2/gi, "")
    .replace(/\s+src\s*=\s*("[^"]*"|'[^']*')/gi, "")
    // External references (http/https or protocol-relative) — keep only local #fragments.
    .replace(/\s+(xlink:)?href\s*=\s*("|')\s*(https?:)?\/\/[^"']*\2/gi, "")
    // CSS expressions / url(javascript:) in style attributes or blocks
    .replace(/url\(\s*['"]?\s*(javascript|https?|data):[^)]*\)/gi, "none")
    .replace(/@import[^;]*;?/gi, "");

  if (!/xmlns\s*=/.test(svg)) {
    svg = svg.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return svg;
}

/** Encode SVG as a data URI suitable for <img src> or CSS mask-image. */
export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
