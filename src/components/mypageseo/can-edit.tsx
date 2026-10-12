import type { ReactNode } from "react";
import { useCanEdit } from "@/hooks/use-access";

/** Renders the children only for users who can write (hides them for a read-only client_user). */
export function CanEdit({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return <>{useCanEdit() ? children : fallback}</>;
}
