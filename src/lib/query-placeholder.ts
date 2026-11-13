import type { QueryKey } from "@tanstack/react-query";

/**
 * `placeholderData` for a query of one location (key `["locations", locationId, …]`): while a new
 * run, group, range, filter or page loads, the previous answer stays on screen (`isPlaceholderData`),
 * but never one from another location. After a switch the page shows its loading state instead of
 * the last location's numbers under the new location's name.
 */
export function keepPreviousForLocation(locationId: string) {
  return <TData>(previous: TData | undefined, previousQuery: { queryKey: QueryKey } | undefined): TData | undefined =>
    previousQuery?.queryKey[1] === locationId ? previous : undefined;
}
