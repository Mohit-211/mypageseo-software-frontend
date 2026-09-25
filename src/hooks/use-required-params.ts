import { useParams } from "react-router-dom";

/**
 * Typed route params — replacement for TanStack's `Route.useParams()`.
 * React Router types every param as `string | undefined`; the route tree
 * guarantees these exist on the pages that use them, so assert once here.
 *
 *   const { locationId } = useRequiredParams("locationId");
 */
export function useRequiredParams<K extends string>(...keys: K[]): Record<K, string> {
  const params = useParams();
  const out = {} as Record<K, string>;
  for (const key of keys) {
    const value = params[key];
    if (value === undefined) throw new Error(`Missing route param "${key}"`);
    out[key] = value;
  }
  return out;
}
