import { createContext } from "react";
import type { WorkspaceValue } from "./workspace";

/**
 * Kept in its own module so editing workspace.tsx (or anything it imports)
 * does not recreate the context during HMR and orphan the mounted provider.
 */
export const WorkspaceContext = createContext<WorkspaceValue | null>(null);
