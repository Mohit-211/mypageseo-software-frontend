import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useFocusReturn } from "@/components/ui/focus-return";
import { Sidebar } from "./sidebar";

/**
 * Small screens: the sidebar as a drawer from the left (location switcher included). It is a
 * modal dialog (focus stays inside, Escape and the backdrop close it); the layout closes it on
 * every navigation. Closed without leaving the page, focus goes back to the menu button; after a
 * link to another page, the page's own focus handling takes over.
 */
export function MobileNav({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const focusReturn = useFocusReturn({});
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/50 lg:hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          {...focusReturn}
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-3rem))] flex-col shadow-elevated outline-none lg:hidden data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left motion-reduce:animate-none"
        >
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <Sidebar className="h-full" onNavigate={() => onOpenChange(false)} />
          <DialogPrimitive.Close
            aria-label="Close navigation"
            className="absolute right-2 top-2.5 grid size-9 place-items-center rounded-md text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden className="size-5" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
