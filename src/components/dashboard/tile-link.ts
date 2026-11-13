/**
 * A small text link in a KPI tile's footer ("Connect Google", "Draft replies", "2 posts didn't
 * publish"). The tile's footer sits above the tile's own stretched link, so these stay clickable;
 * the ::after pads each one out to a 40px-tall target without moving the layout.
 */
export const TILE_FOOTER_LINK =
  "relative inline-flex cursor-pointer items-center gap-1 rounded-sm font-semibold text-primary underline-offset-4 outline-hidden after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[''] hover:text-primary-hover hover:underline focus-visible:ring-2 focus-visible:ring-ring";
