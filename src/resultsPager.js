/** One results page is four rows of the current grid. */
export const RESULTS_PAGE_ROWS = 4;

/** Page numbers visible at once, matching the Figma strip (12900:16548). */
export const PAGER_WINDOW = 5;

export function resultsPageSize(columns) {
  return Math.max(1, columns) * RESULTS_PAGE_ROWS;
}

/**
 * Page numbers to show. At most `limit`, with `current` centered when the
 * search has more pages than fit in the strip.
 */
export function pagerWindow(current, total, limit = PAGER_WINDOW) {
  const pages = Math.max(0, Math.floor(total));
  const size = Math.min(Math.max(0, limit), pages);
  if (!size) return [];
  const safe = Math.min(Math.max(1, current), pages);
  const start = Math.max(1, Math.min(safe - Math.floor((size - 1) / 2), pages - size + 1));
  return Array.from({length:size}, (_, index) => start + index);
}
