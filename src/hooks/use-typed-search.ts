import { useCallback, useMemo, useState } from "react";
import { useSearchParams, type NavigateOptions } from "react-router-dom";
import type { z } from "zod";

/**
 * Typed search params — replacement for TanStack Router's `validateSearch`
 * + `Route.useSearch()` + `navigate({ search })`.
 *
 * Usage (define the schema at module level so its reference is stable):
 *
 *   const searchSchema = z.object({ q: z.string().optional(), page: z.coerce.number().optional() });
 *   const [search, setSearch] = useTypedSearch(searchSchema);
 *
 *   setSearch((prev) => ({ ...prev, q: "x", page: 1 }));   // merge
 *   setSearch({ sort, order, page: 1 });                    // replace all
 *   setSearch((prev) => ({ ...prev, q }), { replace: true }); // no history entry
 *
 * Porting rule: `navigate({ search: X })` -> `setSearch(X)`. Same semantics:
 * the value (or updater result) becomes the complete new search.
 *
 * Invalid params fall back to `fallback` (default `{}`), matching the old
 * `parsed.success ? parsed.data : {}` pattern. Values are serialized with
 * String(); undefined, null and "" are dropped from the URL. Arrays become
 * repeated keys. Nested objects are not supported.
 */

export type SearchUpdate<T> = T | ((previous: T) => T);

function readParams<S extends z.ZodType>(
  schema: S,
  params: URLSearchParams,
  fallback: z.output<S>,
): z.output<S> {
  const raw: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    raw[key] = all.length > 1 ? all : (all[0] ?? "");
  }
  const result = schema.safeParse(raw);
  return result.success ? result.data : fallback;
}

function writeParams(next: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item === undefined || item === null || item === "") continue;
      if (typeof item === "object") continue; // nested objects unsupported
      params.append(key, String(item));
    }
  }
  return params;
}

export function useTypedSearch<S extends z.ZodType>(schema: S, fallback?: z.output<S>) {
  type Search = z.output<S>;

  // Fallbacks are static per route; freeze the first value so an inline
  // literal doesn't invalidate memoization every render.
  const [fallbackValue] = useState<Search>(() => (fallback ?? {}) as Search);
  const [params, setParams] = useSearchParams();

  const search = useMemo(
    () => readParams(schema, params, fallbackValue),
    [schema, params, fallbackValue],
  );

  const setSearch = useCallback(
    (update: SearchUpdate<Search>, options?: NavigateOptions) => {
      setParams((previousParams) => {
        const previous = readParams(schema, previousParams, fallbackValue);
        const next =
          typeof update === "function" ? (update as (p: Search) => Search)(previous) : update;
        return writeParams(next as Record<string, unknown>);
      }, options);
    },
    [schema, setParams, fallbackValue],
  );

  return [search, setSearch] as const;
}
