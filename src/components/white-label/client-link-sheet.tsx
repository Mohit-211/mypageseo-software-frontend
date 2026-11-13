import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ClientLinkEditor, type ClientLinkTarget } from "./client-link-editor";

/**
 * The client link drawer (right side, full width on phones). The page keeps it in the URL
 * (`?link=<locationId>`), so it can be linked to and Back closes it. `onClosed` runs once the
 * closing animation is over, so the content doesn't vanish while it slides out.
 */
export function ClientLinkSheet({
  target,
  open,
  onClose,
  onClosed,
  onEditBrand,
}: {
  target: ClientLinkTarget | null;
  open: boolean;
  onClose: () => void;
  onClosed: (event: Event) => void;
  onEditBrand: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl" onCloseAutoFocus={onClosed}>
        {target ? <ClientLinkEditor key={target.id} target={target} onEditBrand={onEditBrand} /> : null}
      </SheetContent>
    </Sheet>
  );
}
