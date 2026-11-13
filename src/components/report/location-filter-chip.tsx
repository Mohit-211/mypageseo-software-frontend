import { MapPin, X } from "lucide-react";

/** "Location: Maple Leaf Dental ✕": the page is narrowed to one location (`?location=`); ✕ shows every location again. */
export function LocationFilterChip({ name, onClear }: { name: string; onClear: () => void }) {
  return (
    <span className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-lg border border-primary/25 bg-brand-tint pl-3 pr-1 text-sm text-foreground">
      <MapPin aria-hidden className="size-4 shrink-0 text-primary" />
      <span className="truncate">
        <span className="text-muted-foreground">Location: </span>
        <span className="font-medium">{name}</span>
      </span>
      <button
        type="button"
        aria-label="Show every location"
        onClick={onClear}
        className="relative grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-primary outline-hidden after:absolute after:-inset-1 after:content-[''] hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X aria-hidden className="size-4" />
      </button>
    </span>
  );
}
