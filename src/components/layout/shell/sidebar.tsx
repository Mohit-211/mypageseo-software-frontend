import { cn } from "@/lib/utils";
import { Brand } from "./brand";
import { OrgMenu } from "./org-menu";
import { SidebarNav } from "./sidebar-nav";

/**
 * The sidebar: brand band, the menu (with the location switcher) and the organization card.
 * The same component is the desktop column and the mobile drawer's content.
 */
export function Sidebar({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const navigate = onNavigate ? { onNavigate } : {};
  return (
    <aside aria-label="Sidebar" className={cn("flex flex-col bg-gradient-to-b from-sidebar to-sidebar-deep text-sidebar-foreground", className)}>
      <Brand {...navigate} />
      <SidebarNav {...navigate} />
      <OrgMenu {...navigate} />
    </aside>
  );
}
