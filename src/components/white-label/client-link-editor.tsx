import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  History,
  Link2,
  LoaderCircle,
  MessageSquareText,
  Palette,
  Power,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import {
  deleteWhiteLabelLinkLogo,
  getBranding,
  getWhiteLabelLink,
  getWhiteLabelLinkLogo,
  isApiError,
  revokeWhiteLabelLink,
  rotateWhiteLabelLink,
  saveWhiteLabelLink,
  uploadWhiteLabelLinkLogo,
  type Branding,
  type WhiteLabelLinkInput,
  type WhiteLabelLinkState,
  type WhiteLabelReportType,
} from "@/api";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { ConfirmDialog, FormTextField } from "@/components/layout/shared/form-fields";
import { EmptyState, ErrorState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useCanEdit } from "@/hooks/use-access";
import { useNow } from "@/hooks/use-now";
import { formatDate, formatDateTime, formatRelative } from "@/lib/datetime";
import { HEX, WEBSITE_URL, readLogoFile, usePrivateLogoUrl } from "@/lib/white-label/branding";
import {
  BRANDING_KEY,
  CLIENT_LINK_REPORTS,
  WHITE_LABEL_LINKS_KEY,
  clientLinkErrorText,
  clientLinkMessage,
  clientLinkUnavailableText,
  isClientLinksUnavailable,
  isNeutralLink,
  whiteLabelLinkKey,
} from "@/lib/white-label/client-links";
import { useWriteBlock } from "@/lib/white-label/write-block";
import { cn } from "@/lib/utils";
import { ColorField, LogoField } from "./branding-fields";

/** What the drawer knows about the location before its link loads (from the table row). */
export type ClientLinkTarget = {
  id: string;
  name: string;
  area: string;
  clientName: string | null;
};

/**
 * One location's client link, for the drawer: the URL to copy, what the client sees, the
 * branding for this client, the versions, and replacing or turning the link off. Creates the
 * link when there is none (agency owner and members).
 */
export function ClientLinkEditor({ target, onEditBrand }: { target: ClientLinkTarget; onEditBrand: () => void }) {
  const state = useQuery({
    queryKey: whiteLabelLinkKey(target.id),
    queryFn: ({ signal }) => getWhiteLabelLink(target.id, signal),
    retry: (count, error) => !isClientLinksUnavailable(error) && !(isApiError(error) && error.status === 404) && count < 2,
  });
  const live = Boolean(state.data?.link);

  return (
    <>
      <div className="shrink-0 border-b border-border px-5 pb-4 pt-5 pr-12 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client link</p>
        <SheetTitle className="mt-1 truncate tracking-tight">{target.name}</SheetTitle>
        <SheetDescription className="sr-only">
          Create, copy or change the live client page for {target.name}.
        </SheetDescription>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {state.isPending ? (
            <Skeleton className="h-5 w-16 rounded-full" />
          ) : live ? (
            <StatusBadge tone="success" dot>
              Live
            </StatusBadge>
          ) : state.data ? (
            <StatusBadge tone="neutral">No link yet</StatusBadge>
          ) : null}
          {target.area ? <span className="truncate">{target.area}</span> : null}
          {target.clientName ? (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{target.clientName}</span>
            </>
          ) : null}
        </div>
      </div>

      {state.isPending ? (
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6" role="status" aria-label="Loading the client link">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-4 w-40" />
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-lg" />
            ))}
          </div>
        </div>
      ) : state.isError ? (
        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-6">
          {isClientLinksUnavailable(state.error) ? (
            <EmptyState
              compact
              icon={Link2}
              tone="brand"
              title="Client links aren't available"
              description={clientLinkErrorText(state.error, "This account can't use client links.")}
            />
          ) : isApiError(state.error) && state.error.status === 404 ? (
            <EmptyState compact icon={Link2} title="Location not found" description="It may have been removed, or it isn't one of your locations." />
          ) : (
            <ErrorState compact description="The client link couldn't be loaded." onRetry={() => void state.refetch()} />
          )}
        </div>
      ) : (
        // A new URL (rotated, or a link created) starts the form afresh.
        <ClientLinkBody key={state.data.link?.url ?? "none"} target={target} state={state.data} onEditBrand={onEditBrand} />
      )}
    </>
  );
}

type Form = {
  reports: WhiteLabelReportType[];
  override: boolean;
  name: string;
  website_url: string;
  primary_color: string;
  secondary_color: string;
};

function toForm(state: WhiteLabelLinkState): Form {
  const override = state.link?.branding_override ?? null;
  return {
    // A new link starts with every report that can have data.
    reports: state.link ? state.link.reports : state.types.filter((entry) => entry.available !== false).map((entry) => entry.type),
    override: Boolean(override),
    name: override?.name ?? "",
    website_url: override?.website_url ?? "",
    primary_color: override?.primary_color ?? "",
    secondary_color: override?.secondary_color ?? "",
  };
}

function sameForm(a: Form, b: Form): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function ClientLinkBody({ target, state, onEditBrand }: { target: ClientLinkTarget; state: WhiteLabelLinkState; onEditBrand: () => void }) {
  const queryClient = useQueryClient();
  const canEdit = useCanEdit();
  const block = useWriteBlock();
  const branding = useQuery({ queryKey: BRANDING_KEY, queryFn: ({ signal }) => getBranding(signal) });
  const link = state.link;
  const initial = toForm(state);
  const [form, setForm] = useState<Form>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setError(null);
    setForm((current) => ({ ...current, [key]: value }));
  };
  const dirty = !sameForm(form, initial);
  const writable = canEdit && !block.blocked;

  const apply = (next: WhiteLabelLinkState) => {
    queryClient.setQueryData(whiteLabelLinkKey(target.id), next);
    void queryClient.invalidateQueries({ queryKey: WHITE_LABEL_LINKS_KEY });
  };

  const toggleReport = (type: WhiteLabelReportType, on: boolean) =>
    set("reports", CLIENT_LINK_REPORTS.map((entry) => entry.value).filter((value) => (value === type ? on : form.reports.includes(value))));

  const save = async () => {
    if (saving) return;
    if (form.reports.length === 0) return setError("Choose at least one report for the page.");
    if (form.override) {
      if (form.website_url && (!WEBSITE_URL.test(form.website_url) || form.website_url.length > 300)) return setError("The website must start with http:// or https://.");
      if ((form.primary_color && !HEX.test(form.primary_color)) || (form.secondary_color && !HEX.test(form.secondary_color))) {
        return setError("Colours must look like #1d4ed8, or be empty to use your main brand.");
      }
    }
    const input: WhiteLabelLinkInput = { reports: form.reports };
    if (form.override) {
      input.branding_override = {
        name: form.name.trim(),
        website_url: form.website_url.trim(),
        primary_color: form.primary_color.toLowerCase(),
        secondary_color: form.secondary_color.toLowerCase(),
      };
    } else if (link?.branding_override) {
      input.branding_override = null;
    }
    setSaving(true);
    setError(null);
    try {
      apply(await saveWhiteLabelLink(target.id, input));
      toast.success(link ? "Client link saved." : "Client link created. Copy it and send it to your client.");
    } catch (err) {
      setError(clientLinkErrorText(err, link ? "The client link couldn't be saved. Try again." : "The client link couldn't be created. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-5 sm:px-6">
        {link ? (
          <LinkCard target={target} state={state} />
        ) : (
          <div className="flex gap-3 rounded-xl border border-primary/20 bg-brand-tint/60 p-4">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-primary ring-1 ring-primary/20">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-foreground">A live page for {target.name}</p>
              <p className="mt-0.5 text-muted-foreground">
                Pick what it shows, then create the link. It carries your brand, updates itself after every refresh and keeps earlier versions, so you send it once.
              </p>
            </div>
          </div>
        )}

        <EditorSection title="What your client sees" description="The reports on the page. Ones without data stay hidden until they have some.">
          <fieldset disabled={!writable || saving} className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Reports on the page</legend>
            {CLIENT_LINK_REPORTS.map((entry) => {
              const type = state.types.find((item) => item.type === entry.value);
              const checked = form.reports.includes(entry.value);
              const unavailable = type?.available === false;
              const locked = unavailable && !checked;
              return (
                <label
                  key={entry.value}
                  className={cn(
                    "flex min-h-14 items-start gap-2.5 rounded-lg border p-3 transition-colors",
                    checked ? "border-primary bg-brand-tint ring-1 ring-primary/25" : "border-border bg-card",
                    locked ? "cursor-not-allowed bg-muted/60" : "cursor-pointer hover:border-primary/50",
                  )}
                >
                  <Checkbox className="mt-0.5" checked={checked} disabled={locked} onCheckedChange={(value) => toggleReport(entry.value, value === true)} />
                  <span className="min-w-0">
                    <span className={cn("block text-sm font-medium", locked ? "text-muted-foreground" : "text-foreground")}>{entry.label}</span>
                    {unavailable ? (
                      <span className="block text-xs text-muted-foreground">
                        {clientLinkUnavailableText(type.reason)}
                        {checked ? " Hidden until it has data." : ""}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </fieldset>
          {state.types.every((entry) => entry.available === null) ? (
            <p className="text-xs text-muted-foreground">Data is checked when the link is created; reports without any are left off the page.</p>
          ) : null}
        </EditorSection>

        <EditorSection
          title="Branding for this client"
          description="Uses your main brand unless you set something else here."
          action={
            <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={onEditBrand}>
              <Palette aria-hidden /> Edit your main brand
            </Button>
          }
        >
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-strong px-3.5 py-3">
            <label htmlFor={`override-${target.id}`} className="min-w-0 text-sm font-medium text-foreground">
              Use different branding for this client
            </label>
            <Switch id={`override-${target.id}`} disabled={!writable || saving} checked={form.override} onCheckedChange={(value) => set("override", value)} />
          </div>
          {form.override ? (
            <OverrideFields form={form} set={set} branding={branding.data} disabled={!writable || saving}>
              {link ? (
                <OverrideLogoField locationId={target.id} state={state} canEdit={canEdit} blocked={block.blocked} onChange={apply} />
              ) : (
                <p className="text-xs text-muted-foreground">You can add a logo for this client once the link is created.</p>
              )}
            </OverrideFields>
          ) : link?.branding_override ? (
            <p className="text-xs text-muted-foreground">Saving removes this client's own name, website, colours and logo; the page then uses your main brand.</p>
          ) : null}
        </EditorSection>

        {state.editions.length > 0 ? <Versions state={state} /> : null}
        {link && canEdit ? <DangerZone target={target} blockedReason={block.reason} onChange={apply} /> : null}
      </div>

      {canEdit ? (
        <div className="shrink-0 border-t border-border bg-card px-5 py-3 sm:px-6">
          {error ? (
            <p role="alert" className="mb-2 text-sm font-medium text-critical">
              {error}
            </p>
          ) : block.reason ? (
            <p className="mb-2 text-xs text-muted-foreground">
              {block.reason}
              {link ? " Turning the link off still works." : ""}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {link && dirty ? (
              <Button variant="ghost" disabled={saving} onClick={() => setForm(initial)}>
                Discard changes
              </Button>
            ) : null}
            <Button
              disabled={saving || !writable || (link ? !dirty : form.reports.length === 0)}
              aria-busy={saving || undefined}
              onClick={() => void save()}
              className={cn(!link && "w-full sm:w-auto")}
            >
              {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : link ? <Save aria-hidden /> : <Link2 aria-hidden />}
              {link ? "Save changes" : "Create client link"}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function EditorSection({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function OverrideFields({
  form,
  set,
  branding,
  disabled,
  children,
}: {
  form: Form;
  set: <K extends keyof Form>(key: K, value: Form[K]) => void;
  branding: Branding | undefined;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">Empty fields use your main brand.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormTextField
          id="link-name"
          label="Name"
          value={form.name}
          onChange={(value) => set("name", value)}
          maxLength={150}
          placeholder={branding?.name ?? undefined}
          disabled={disabled}
        />
        <FormTextField
          id="link-website"
          label="Website"
          type="url"
          value={form.website_url}
          onChange={(value) => set("website_url", value)}
          maxLength={300}
          placeholder={branding?.website_url ?? "https://youragency.com"}
          disabled={disabled}
        />
        <ColorField
          id="link-primary"
          label="Primary colour"
          value={form.primary_color}
          placeholder={branding?.primary_color ?? undefined}
          onChange={(value) => set("primary_color", value)}
          disabled={disabled}
        />
        <ColorField
          id="link-secondary"
          label="Secondary colour"
          value={form.secondary_color}
          placeholder={branding?.secondary_color ?? undefined}
          onChange={(value) => set("secondary_color", value)}
          disabled={disabled}
        />
      </div>
      {children}
    </div>
  );
}

/** The live URL, front and centre: copy it, open it, or copy a ready-made message. */
function LinkCard({ target, state }: { target: ClientLinkTarget; state: WhiteLabelLinkState }) {
  const link = state.link!;
  const now = useNow();
  const copy = (text: string, done: string) => {
    void navigator.clipboard.writeText(text).then(
      () => toast.success(done),
      () => toast.error("Couldn't copy. Select the link and copy it yourself."),
    );
  };
  return (
    <div className="rounded-xl border border-success/25 bg-success-surface/50 p-4">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground">
        <CheckCircle2 aria-hidden className="size-4 text-success" />
        <span className="font-semibold">Live</span>
        <span className="text-muted-foreground">
          · {link.views} visit{link.views === 1 ? "" : "s"}
          {link.last_viewed_at ? ` · last opened ${formatRelative(link.last_viewed_at, now)}` : " · not opened yet"}
        </span>
      </p>
      <div className="mt-3 flex min-w-0 items-center gap-2">
        <input
          readOnly
          value={link.url}
          aria-label={`Client link for ${target.name}`}
          onFocus={(event) => event.currentTarget.select()}
          className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 font-mono text-xs text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button onClick={() => copy(link.url, "Link copied")}>
          <Copy aria-hidden /> Copy link
        </Button>
        <Button asChild variant="outline" size="icon" aria-label="Open the client page in a new tab">
          <a href={link.url} target="_blank" rel="noreferrer noopener">
            <ExternalLink aria-hidden />
          </a>
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" className="bg-card" onClick={() => copy(clientLinkMessage(target.name, link.url), "Message copied. Paste it into your email to the client.")}>
          <MessageSquareText aria-hidden /> Copy a message for your client
        </Button>
        <p className="text-xs text-muted-foreground">
          Created {formatDate(link.created_at)}
          {link.rotated_at ? ` · URL replaced ${formatDate(link.rotated_at)}` : ""}
        </p>
      </div>
      {isNeutralLink(link.url) ? null : (
        <p className="mt-3 text-xs text-muted-foreground">Links move to a neutral address automatically once it's switched on. The page itself never mentions MyPageSEO.</p>
      )}
    </div>
  );
}

function OverrideLogoField({
  locationId,
  state,
  canEdit,
  blocked,
  onChange,
}: {
  locationId: string;
  state: WhiteLabelLinkState;
  canEdit: boolean;
  blocked: boolean;
  onChange: (next: WhiteLabelLinkState) => void;
}) {
  const logo = state.link?.branding_override?.logo ?? null;
  const url = usePrivateLogoUrl(
    whiteLabelLinkKey(locationId),
    logo ? (signal) => getWhiteLabelLinkLogo(locationId, signal) : null,
    [logo?.bytes ?? null, logo?.mime ?? null],
  );
  const [busy, setBusy] = useState(false);

  const run = (action: () => Promise<WhiteLabelLinkState>, done: string, failed: string) => {
    setBusy(true);
    void action()
      .then((next) => {
        onChange(next);
        toast.success(done);
      })
      .catch((err: unknown) => toast.error(clientLinkErrorText(err, failed)))
      .finally(() => setBusy(false));
  };

  const upload = (file: File) =>
    readLogoFile(file).then(
      (dataUrl) => run(() => uploadWhiteLabelLinkLogo(locationId, dataUrl), "Logo saved.", "The logo couldn't be saved."),
      (err: Error) => toast.error(err.message),
    );

  return (
    <LogoField
      label="Logo for this client"
      url={url}
      busy={busy}
      hasLogo={Boolean(logo)}
      emptyLabel="Main logo"
      // Uploading needs billing; removing doesn't.
      onFile={canEdit && !blocked ? (file) => void upload(file) : undefined}
      onRemove={canEdit ? () => run(() => deleteWhiteLabelLinkLogo(locationId), "Logo removed.", "The logo couldn't be removed.") : undefined}
      hint="PNG or JPEG, up to 512 KB. Saved right away. Without one, the page uses your main logo."
    />
  );
}

const TRIGGER_LABEL: Record<WhiteLabelLinkState["editions"][number]["trigger"], string> = {
  link_created: "Link created",
  refresh: "Monthly refresh",
};

/** Every version of the page, newest first; the client sees the same list under "Earlier reports". */
function Versions({ state }: { state: WhiteLabelLinkState }) {
  const url = state.link?.url ?? null;
  const editions = [...state.editions].sort((a, b) => Date.parse(b.generated_at) - Date.parse(a.generated_at));
  const [open, setOpen] = useState(editions.length <= 3);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className="space-y-3">
        <CollapsibleTrigger className="group flex w-full cursor-pointer items-start justify-between gap-3 rounded-md text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <History aria-hidden className="size-4 text-muted-foreground" /> Versions
              <StatusBadge tone="neutral" size="sm">
                {editions.length}
              </StatusBadge>
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">A new one after every refresh; each stays open to your client for 24 months.</span>
          </span>
          <ChevronDown aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {editions.map((edition, index) => (
              <li key={edition.key} className="flex items-center justify-between gap-3 bg-card px-3 py-2.5 text-sm">
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-foreground">{formatDateTime(edition.generated_at)}</span>
                  <span className="text-xs text-muted-foreground">{TRIGGER_LABEL[edition.trigger] ?? edition.trigger}</span>
                  {index === 0 ? (
                    <StatusBadge tone="brand" size="sm">
                      Latest
                    </StatusBadge>
                  ) : null}
                </span>
                {url ? (
                  <a
                    href={index === 0 ? url : `${url}?e=${encodeURIComponent(edition.key)}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex shrink-0 items-center gap-1 rounded-sm text-xs font-semibold text-primary outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Open <ExternalLink aria-hidden className="size-3" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

/** Replace the URL (the old one dies at once) or turn the page off. */
function DangerZone({ target, blockedReason, onChange }: { target: ClientLinkTarget; blockedReason: string | null; onChange: (next: WhiteLabelLinkState) => void }) {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<"rotate" | "revoke" | null>(null);
  const [busy, setBusy] = useState<"rotate" | "revoke" | null>(null);

  const rotate = async () => {
    setBusy("rotate");
    try {
      onChange(await rotateWhiteLabelLink(target.id));
      toast.success("New URL ready. The old one no longer works.");
    } catch (err) {
      toast.error(clientLinkErrorText(err, "The URL couldn't be replaced. Try again."));
    } finally {
      setBusy(null);
    }
  };

  const revoke = async () => {
    setBusy("revoke");
    try {
      await revokeWhiteLabelLink(target.id);
      await queryClient.invalidateQueries({ queryKey: whiteLabelLinkKey(target.id) });
      void queryClient.invalidateQueries({ queryKey: WHITE_LABEL_LINKS_KEY });
      toast.success("Client link turned off.");
    } catch (err) {
      toast.error(clientLinkErrorText(err, "The link couldn't be turned off. Try again."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Replace or turn off</h3>
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3">
          <p className="min-w-0 flex-[1_1_14rem] text-xs text-muted-foreground">
            <span className="block text-sm font-medium text-foreground">Replace the URL</span>
            The current URL stops working at once. Use it if the link reached the wrong people.
          </p>
          <Button variant="outline" size="sm" disabled={busy !== null || blockedReason !== null} title={blockedReason ?? undefined} onClick={() => setConfirm("rotate")}>
            {busy === "rotate" ? <LoaderCircle aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />} Replace URL
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3">
          <p className="min-w-0 flex-[1_1_14rem] text-xs text-muted-foreground">
            <span className="block text-sm font-medium text-foreground">Turn off the page</span>
            Versions are kept and come back if you create a link again (with a new URL).
          </p>
          <Button variant="accent-outline" size="sm" disabled={busy !== null} onClick={() => setConfirm("revoke")}>
            {busy === "revoke" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Power aria-hidden />} Turn off
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => (open ? undefined : setConfirm(null))}
        title={confirm === "rotate" ? "Replace the URL?" : "Turn off the client link?"}
        description={
          confirm === "rotate"
            ? `The current URL for ${target.name} stops working at once. Send the new one to your client.`
            : `The page for ${target.name} goes offline at once. Its versions are kept and come back if you create a link again (with a new URL).`
        }
        confirmLabel={confirm === "rotate" ? "Replace URL" : "Turn off"}
        destructive={confirm === "revoke"}
        onConfirm={() => {
          const action = confirm;
          setConfirm(null);
          void (action === "rotate" ? rotate() : revoke());
        }}
      />
    </section>
  );
}
