import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, MapPin } from "lucide-react";
import { getPlaceSuggestions, isApiError, type PlaceSuggestion } from "@/api";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Suggestions start after this many characters, once typing has paused this long. */
const MIN_CHARS = 3;
const DEBOUNCE_MS = 250;

function newSession() {
  return crypto.randomUUID();
}

/**
 * City / region / ZIP picker over `GET places/autocomplete`. One session token is
 * sent with every keystroke and with the pick (`onPick`), so Google bills them as
 * one session; a new token starts after each pick.
 */
export function PlaceAutocomplete({
  id,
  locationId,
  value,
  onChange,
  onPick,
  disabled,
  invalid,
}: {
  id: string;
  locationId: string;
  value: string;
  onChange: (value: string) => void;
  onPick: (suggestion: PlaceSuggestion, session: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const listId = useId();
  const session = useRef(newSession());
  const [debounced, setDebounced] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value]);

  const enabled = debounced.length >= MIN_CHARS && !disabled;
  const suggestions = useQuery({
    queryKey: ["places", "autocomplete", locationId, debounced],
    queryFn: ({ signal }) => getPlaceSuggestions(debounced, session.current, { locationId, signal }),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const list = enabled ? (suggestions.data?.suggestions ?? []) : [];
  const showList = open && enabled && (list.length > 0 || suggestions.isFetching || suggestions.isError || suggestions.isSuccess);

  const pick = (suggestion: PlaceSuggestion) => {
    const token = session.current;
    session.current = newSession();
    setOpen(false);
    onChange(suggestion.description);
    onPick(suggestion, token);
  };

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && list[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid}
        autoComplete="off"
        value={value}
        maxLength={100}
        placeholder="Start typing a city or ZIP, e.g. Tampa"
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        // Let a click on a suggestion land before the list closes.
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (!showList || list.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => (index + 1) % list.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => (index - 1 + list.length) % list.length);
          } else if (event.key === "Enter") {
            event.preventDefault();
            const suggestion = list[active];
            if (suggestion) pick(suggestion);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          {suggestions.isFetching && list.length === 0 ? (
            <p className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground">
              <LoaderCircle aria-hidden className="size-4 animate-spin" /> Searching…
            </p>
          ) : suggestions.isError ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">
              {isApiError(suggestions.error) && suggestions.error.reason === "rate_limited"
                ? "Too many searches for now. Type the full city and state, then save."
                : "Suggestions aren't available. Type the full city and state, then save."}
            </p>
          ) : list.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">No matches. Try the city with its state, or a ZIP code.</p>
          ) : (
            <>
              <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
                {list.map((suggestion, index) => (
                  <li
                    key={suggestion.place_id}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => pick(suggestion)}
                    className={cn("flex cursor-pointer items-start gap-2 px-3 py-2 text-sm", index === active && "bg-secondary")}
                  >
                    <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block font-medium text-foreground">{suggestion.main_text}</span>
                      {suggestion.secondary_text ? <span className="block text-xs text-muted-foreground">{suggestion.secondary_text}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
              {suggestions.data?.attribution ? (
                <p className="border-t border-border px-3 py-1 text-right text-[10px] text-muted-foreground">{suggestions.data.attribution.text}</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
