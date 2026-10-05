import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, LoaderCircle, Search, X } from "lucide-react";
import { searchAuditPlaces, type AuditPlaceSuggestion } from "@/api";
import { Input } from "@/components/ui/input";
import { auditErrorText } from "@/lib/staff/audit-format";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 300;

/**
 * Business search for the audit (Places Autocomplete, US / CA). Keystrokes are
 * debounced and share the caller's `session` token, which the start call ends.
 */
export function BusinessSearch({
  session,
  value,
  onChange,
}: {
  session: string;
  value: AuditPlaceSuggestion | null;
  onChange: (place: AuditPlaceSuggestion | null) => void;
}) {
  const listId = useId();
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(text.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text]);

  const search = useQuery({
    queryKey: ["staff", "audit-places", session, debounced],
    queryFn: ({ signal }) => searchAuditPlaces(debounced, session, signal),
    enabled: debounced.length >= 2 && !value,
    staleTime: 60_000,
    retry: false,
  });
  const suggestions = search.data?.suggestions ?? [];

  const pick = (place: AuditPlaceSuggestion) => {
    onChange(place);
    setOpen(false);
  };

  if (value) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-border bg-surface-strong px-3 py-2.5">
        <Building2 aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{value.main_text}</p>
          <p className="truncate text-xs text-muted-foreground">{value.secondary_text}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setOpen(true);
          }}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Change business"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    );
  }

  const showList = open && debounced.length >= 2;

  return (
    <div className="relative">
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Business"
        placeholder="Business name and city"
        className="h-10 pl-9 pr-9"
        value={text}
        maxLength={120}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (!showList || suggestions.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlight((index) => (index + 1) % suggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlight((index) => (index - 1 + suggestions.length) % suggestions.length);
          } else if (event.key === "Enter") {
            event.preventDefault();
            const place = suggestions[highlight];
            if (place) pick(place);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {search.isFetching ? (
        <LoaderCircle aria-hidden className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
      {showList ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-elevated">
          {search.isError ? (
            <p className="px-3 py-3 text-sm text-critical">{auditErrorText(search.error)}</p>
          ) : search.isPending || (search.isFetching && suggestions.length === 0) ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Searching…</p>
          ) : suggestions.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">No businesses found. Try the name with the city.</p>
          ) : (
            <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto py-1">
              {suggestions.map((place, index) => (
                <li
                  key={place.place_id}
                  role="option"
                  aria-selected={index === highlight}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(place)}
                  onMouseEnter={() => setHighlight(index)}
                  className={cn("cursor-pointer px-3 py-2", index === highlight && "bg-accent")}
                >
                  <p className="truncate text-sm font-medium text-foreground">{place.main_text}</p>
                  <p className="truncate text-xs text-muted-foreground">{place.secondary_text}</p>
                </li>
              ))}
            </ul>
          )}
          {search.data?.attribution ? (
            <p className="border-t border-border px-3 py-1.5 text-right text-[11px] text-muted-foreground">{search.data.attribution.text}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
