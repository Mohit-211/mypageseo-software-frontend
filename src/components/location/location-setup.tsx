import { AlertCircle, Building2, Check, Link2, LoaderCircle, MapPin, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type GoogleConnectionState = "disconnected" | "connecting" | "connected" | "error";

export type GoogleBusinessProfile = {
  id: string;
  businessName: string;
  address?: string;
  area?: string;
  category?: string;
  alreadyConnected: boolean;
};

export function GoogleBusinessConnection({
  state,
  onConnect,
  onRetry,
}: {
  state: GoogleConnectionState;
  onConnect: () => void;
  onRetry: () => void;
}) {
  if (state === "connecting") {
    return (
      <section className="rounded-lg border border-border bg-surface p-5 shadow-card" aria-live="polite">
        <div className="flex items-start gap-3">
          <LoaderCircle className="mt-0.5 size-5 animate-spin text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">Connecting to Google</h2>
            <p className="mt-1 text-sm text-muted-foreground">Waiting for the account connection to complete…</p>
            <div className="mt-5 space-y-3" aria-hidden>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (state === "error") {
    return (
      <Alert className="border-critical/25 bg-critical-surface/40">
        <AlertCircle aria-hidden />
        <AlertTitle>Google account could not be connected</AlertTitle>
        <AlertDescription>
          <p>We couldn't start the Google sign-in. No account changes were made.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Try again</Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (state === "connected") return null;

  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-primary">
            <Building2 className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Connect Google Business Profile</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Sign in with the Google account that manages the business. You’ll choose a profile before anything is added.
            </p>
          </div>
        </div>
        <Button className="shrink-0 sm:self-center" onClick={onConnect}>
          <Link2 aria-hidden /> Connect Google account
        </Button>
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          Mypageseo uses the connection to read and analyze the selected profile. Additional setup follows after connection.
        </p>
      </div>
    </section>
  );
}

export function BusinessProfileSelector({
  profiles,
  query,
  selectedId,
  loading = false,
  onQueryChange,
  onSelect,
}: {
  profiles: GoogleBusinessProfile[];
  query: string;
  selectedId?: string;
  loading?: boolean;
  onQueryChange: (query: string) => void;
  onSelect: (profile: GoogleBusinessProfile) => void;
}) {
  const needle = query.trim().toLowerCase();
  const filtered = profiles.filter((profile) =>
    `${profile.businessName} ${profile.address ?? ""} ${profile.area ?? ""} ${profile.category ?? ""}`
      .toLowerCase()
      .includes(needle),
  );

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">Choose a business profile</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Select the Google Business Profile to manage in Mypageseo.</p>
      </div>
      <div className="p-4 sm:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Search business profiles" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search by business name, address or category" className="pl-9" />
        </div>
        {loading ? (
          <div role="status" aria-live="polite" className="mt-4 space-y-2" aria-label="Loading business profiles">
            <Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-4 border border-dashed border-border px-5 py-8 text-center">
            <p className="text-sm font-medium text-foreground">No eligible profiles found</p>
            <p className="mt-1 text-sm text-muted-foreground">Check that this Google account manages a Business Profile, or try another account.</p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-border overflow-hidden rounded-md border border-border">
            {filtered.map((profile) => {
              const selected = profile.id === selectedId;
              return (
                <button
                  key={profile.id}
                  type="button"
                  disabled={profile.alreadyConnected}
                  onClick={() => onSelect(profile)}
                  className={cn(
                    "flex min-h-20 w-full items-start gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed",
                    selected ? "bg-accent" : "bg-surface hover:bg-secondary",
                    profile.alreadyConnected && "opacity-65",
                  )}
                >
                  <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border", selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground")}>
                    {selected ? <Check className="size-4" aria-hidden /> : <MapPin className="size-4" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">{profile.businessName}</span>
                    {profile.address || profile.area ? <span className="mt-0.5 block text-xs text-muted-foreground">{[profile.address, profile.area].filter(Boolean).join(" · ")}</span> : null}
                    {profile.category ? <span className="mt-1 block text-xs text-muted-foreground">{profile.category}</span> : null}
                  </span>
                  {profile.alreadyConnected ? <span className="shrink-0 text-xs font-medium text-critical">Already connected</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export function LocationConfirmation({ profile }: { profile: GoogleBusinessProfile }) {
  return (
    <section className="rounded-lg border border-border bg-surface shadow-card">
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">Confirm location</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Check that this is the profile you intend to add.</p>
      </div>
      <dl className="grid gap-4 p-4 text-sm sm:grid-cols-2 sm:p-5">
        <div><dt className="text-xs text-muted-foreground">Business</dt><dd className="mt-1 font-medium text-foreground">{profile.businessName}</dd></div>
        {profile.category ? <div><dt className="text-xs text-muted-foreground">Category</dt><dd className="mt-1 text-foreground">{profile.category}</dd></div> : null}
        {profile.address || profile.area ? <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Location</dt><dd className="mt-1 text-foreground">{[profile.address, profile.area].filter(Boolean).join(", ")}</dd></div> : null}
      </dl>
    </section>
  );
}