import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, ExternalLink, ImageUp, Link2, LoaderCircle, Power, RefreshCw, Save, Trash2 } from "lucide-react";
import {
  deleteWhiteLabelLinkLogo,
  getBranding,
  getWhiteLabelLink,
  getWhiteLabelLinkLogo,
  revokeWhiteLabelLink,
  rotateWhiteLabelLink,
  saveWhiteLabelLink,
  uploadWhiteLabelLinkLogo,
  type Branding,
  type WhiteLabelLinkInput,
  type WhiteLabelLinkState,
  type WhiteLabelReportType,
} from "@/api";
import { Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { ErrorState, SectionSkeleton } from "@/components/layout/shared/feedback/states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccess, useCanEdit } from "@/hooks/use-access";
import { formatDate, formatDateTime } from "@/lib/datetime";
import {
  BRANDING_KEY,
  CLIENT_LINK_REPORTS,
  WHITE_LABEL_LINKS_KEY,
  clientLinkErrorText,
  clientLinkUnavailableText,
  isClientLinksUnavailable,
  whiteLabelLinkKey,
} from "@/lib/white-label/client-links";
import { HEX, WEBSITE_URL, readLogoFile, usePrivateLogoUrl } from "@/lib/white-label/branding";
import { ColorField } from "./branding-fields";

const DESCRIPTION =
  "A page for your client on a neutral domain, with your branding and the reports you choose. It updates after every monthly or manual refresh, and your client can open earlier versions from it. MyPageSEO isn't mentioned on it.";

/**
 * The location's white-label client link (Phase 23, agency owner and members). Hidden for business
 * organizations, client users and plans without white-label.
 */
export function ClientLinkPanel({ locationId }: { locationId: string }) {
  const access = useAccess();
  const enabled = access.accountType === "agency" && access.can("clients.view");
  const state = useQuery({
    queryKey: whiteLabelLinkKey(locationId),
    queryFn: ({ signal }) => getWhiteLabelLink(locationId, signal),
    enabled,
    retry: (count, error) => !isClientLinksUnavailable(error) && count < 2,
  });

  if (!enabled || isClientLinksUnavailable(state.error)) return null;

  return (
    <Panel
      title="Client link"
      description={DESCRIPTION}
      actions={state.data?.link ? <StatusBadge tone="success">Active</StatusBadge> : undefined}
    >
      {state.isPending ? (
        <SectionSkeleton lines={4} />
      ) : state.isError ? (
        <ErrorState description="The client link couldn't be loaded." onRetry={() => void state.refetch()} />
      ) : (
        // A new URL (rotated, or a link created again) starts the form afresh.
        <ClientLinkBody key={state.data.link?.url ?? "none"} locationId={locationId} state={state.data} />
      )}
    </Panel>
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

function ClientLinkBody({ locationId, state }: { locationId: string; state: WhiteLabelLinkState }) {
  const queryClient = useQueryClient();
  const canEdit = useCanEdit();
  const branding = useQuery({ queryKey: BRANDING_KEY, queryFn: ({ signal }) => getBranding(signal) });
  const link = state.link;
  const initial = toForm(state);
  const [form, setForm] = useState<Form>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const apply = (next: WhiteLabelLinkState) => {
    queryClient.setQueryData(whiteLabelLinkKey(locationId), next);
    void queryClient.invalidateQueries({ queryKey: WHITE_LABEL_LINKS_KEY });
  };

  const toggleReport = (type: WhiteLabelReportType, on: boolean) =>
    set("reports", CLIENT_LINK_REPORTS.map((entry) => entry.value).filter((value) => (value === type ? on : form.reports.includes(value))));

  const save = async () => {
    if (form.reports.length === 0) return setError("Choose at least one report.");
    if (form.override) {
      if (form.website_url && (!WEBSITE_URL.test(form.website_url) || form.website_url.length > 300)) return setError("The website must start with http:// or https://.");
      if ((form.primary_color && !HEX.test(form.primary_color)) || (form.secondary_color && !HEX.test(form.secondary_color))) {
        return setError("Colours must look like #1d4ed8, or be empty to use your white-label settings.");
      }
    }
    const input: WhiteLabelLinkInput = { reports: form.reports };
    if (form.override) {
      input.branding_override = { name: form.name.trim(), website_url: form.website_url.trim(), primary_color: form.primary_color, secondary_color: form.secondary_color };
    } else if (link?.branding_override) {
      input.branding_override = null;
    }
    setSaving(true);
    setError(null);
    try {
      apply(await saveWhiteLabelLink(locationId, input));
      toast.success(link ? "Client link saved." : "Client link created. Copy it and send it to your client.");
    } catch (err) {
      setError(clientLinkErrorText(err, link ? "The client link couldn't be saved. Try again." : "The client link couldn't be created. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {link ? <LinkSummary locationId={locationId} state={state} canEdit={canEdit} onChange={apply} /> : null}

      {!link && !canEdit ? (
        <p className="text-sm text-muted-foreground">No client link yet.</p>
      ) : (
        <fieldset disabled={!canEdit || saving} className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Reports on the page</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CLIENT_LINK_REPORTS.map((entry) => {
                const type = state.types.find((item) => item.type === entry.value);
                const checked = form.reports.includes(entry.value);
                const unavailable = type?.available === false;
                return (
                  <label
                    key={entry.value}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-2.5 has-[:checked]:border-primary has-[:checked]:bg-brand-tint ${unavailable && !checked ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <Checkbox className="mt-0.5" checked={checked} disabled={unavailable && !checked} onCheckedChange={(value) => toggleReport(entry.value, value === true)} />
                    <span>
                      <span className="block text-sm font-medium text-foreground">{entry.label}</span>
                      {unavailable ? (
                        <span className="block text-xs text-muted-foreground">
                          {clientLinkUnavailableText(type.reason)}
                          {checked ? " Hidden on the page until it has data." : ""}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
            {state.types.every((entry) => entry.available === null) ? (
              <p className="text-xs text-muted-foreground">Reports without data are left off the page until they have some.</p>
            ) : null}
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Checkbox checked={form.override} onCheckedChange={(value) => set("override", value === true)} />
              Use different branding for this client
            </label>
            {form.override ? (
              <div className="space-y-3 rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Empty fields use your white-label settings.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="link-name">Name</Label>
                    <Input id="link-name" maxLength={150} placeholder={branding.data?.name ?? undefined} value={form.name} onChange={(event) => set("name", event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="link-website">Website URL</Label>
                    <Input id="link-website" type="url" placeholder={branding.data?.website_url ?? "https://youragency.com"} value={form.website_url} onChange={(event) => set("website_url", event.target.value)} />
                  </div>
                  <ColorField id="link-primary" label="Primary colour" value={form.primary_color} placeholder={branding.data?.primary_color ?? undefined} onChange={(value) => set("primary_color", value)} />
                  <ColorField id="link-secondary" label="Secondary colour" value={form.secondary_color} placeholder={branding.data?.secondary_color ?? undefined} onChange={(value) => set("secondary_color", value)} />
                </div>
                {link ? (
                  <OverrideLogoField locationId={locationId} state={state} canEdit={canEdit} onChange={apply} />
                ) : (
                  <p className="text-xs text-muted-foreground">You can add a logo for this client once the link is created.</p>
                )}
              </div>
            ) : link?.branding_override ? (
              <p className="text-xs text-muted-foreground">Saving removes this client's own name, website, colours and logo; the page then uses your white-label settings.</p>
            ) : null}
          </div>

          {error ? <p role="alert" className="text-sm text-critical">{error}</p> : null}
          {canEdit ? (
            <Button disabled={saving || (link ? !dirty : form.reports.length === 0)} onClick={() => void save()}>
              {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : link ? <Save aria-hidden /> : <Link2 aria-hidden />}
              {link ? "Save" : "Create client link"}
            </Button>
          ) : null}
        </fieldset>
      )}

      {state.editions.length > 0 ? <Editions state={state} /> : null}
      <BrandingNote branding={branding.data} />
    </div>
  );
}

/** The URL with copy and open, its views, and the rotate / turn off actions. */
function LinkSummary({
  locationId,
  state,
  canEdit,
  onChange,
}: {
  locationId: string;
  state: WhiteLabelLinkState;
  canEdit: boolean;
  onChange: (next: WhiteLabelLinkState) => void;
}) {
  const queryClient = useQueryClient();
  const link = state.link!;
  const [confirm, setConfirm] = useState<"rotate" | "revoke" | null>(null);
  const [busy, setBusy] = useState(false);

  const rotate = async () => {
    setBusy(true);
    try {
      onChange(await rotateWhiteLabelLink(locationId));
      toast.success("New URL ready. The old one no longer works.");
    } catch (err) {
      toast.error(clientLinkErrorText(err, "The URL couldn't be replaced. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    try {
      await revokeWhiteLabelLink(locationId);
      await queryClient.invalidateQueries({ queryKey: whiteLabelLinkKey(locationId) });
      void queryClient.invalidateQueries({ queryKey: WHITE_LABEL_LINKS_KEY });
      toast.success("Client link turned off.");
    } catch (err) {
      toast.error(clientLinkErrorText(err, "The link couldn't be turned off. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input readOnly value={link.url} aria-label="Client link" onFocus={(event) => event.currentTarget.select()} />
        <Button variant="outline" aria-label="Copy link" onClick={() => void navigator.clipboard.writeText(link.url).then(() => toast.success("Link copied"))}>
          <Copy aria-hidden />
        </Button>
        <Button asChild variant="outline" aria-label="Open the client page">
          <a href={link.url} target="_blank" rel="noreferrer noopener"><ExternalLink aria-hidden /></a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {link.views} view{link.views === 1 ? "" : "s"}
        {link.last_viewed_at ? ` · last viewed ${formatDateTime(link.last_viewed_at)}` : " · not opened yet"}
        {` · created ${formatDate(link.created_at)}`}
        {link.rotated_at ? ` · URL replaced ${formatDate(link.rotated_at)}` : ""}
      </p>
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm("rotate")}>
            <RefreshCw aria-hidden /> Rotate URL
          </Button>
          <Button size="sm" variant="ghost" className="text-critical" disabled={busy} onClick={() => setConfirm("revoke")}>
            <Power aria-hidden /> Turn off
          </Button>
        </div>
      ) : null}

      <AlertDialog open={confirm !== null} onOpenChange={(open) => (open ? undefined : setConfirm(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "rotate" ? "Replace the URL?" : "Turn off the client link?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "rotate"
                ? "The current URL stops working at once. Send the new one to your client."
                : "The URL stops working at once. Earlier versions are kept and come back if you create a link again (with a new URL)."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirm === "revoke" ? "bg-critical text-white hover:bg-critical/90" : undefined}
              onClick={() => void (confirm === "rotate" ? rotate() : revoke())}
            >
              {confirm === "rotate" ? "Replace URL" : "Turn off"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function OverrideLogoField({
  locationId,
  state,
  canEdit,
  onChange,
}: {
  locationId: string;
  state: WhiteLabelLinkState;
  canEdit: boolean;
  onChange: (next: WhiteLabelLinkState) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
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
    <div className="space-y-1.5">
      <Label>Logo</Label>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-14 w-32 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-background">
          {url ? <img src={url} alt="This client's logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">Settings logo</span>}
        </div>
        {canEdit ? (
          <>
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file);
              }}
            />
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <ImageUp aria-hidden />} {logo ? "Replace" : "Upload"}
            </Button>
            {logo ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-critical"
                disabled={busy}
                onClick={() => run(() => deleteWhiteLabelLinkLogo(locationId), "Logo removed.", "The logo couldn't be removed.")}
              >
                <Trash2 aria-hidden /> Remove
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">PNG or JPEG, up to 512 KB. Saved right away.</p>
    </div>
  );
}

const TRIGGER_LABEL: Record<WhiteLabelLinkState["editions"][number]["trigger"], string> = {
  link_created: "Link created",
  refresh: "Refresh",
};

/** Every version of the page, newest first; the client sees the same list under "Earlier reports". */
function Editions({ state }: { state: WhiteLabelLinkState }) {
  const url = state.link?.url ?? null;
  return (
    <div className="space-y-2 border-t border-border pt-4">
      <p className="text-sm font-medium text-foreground">Versions</p>
      <p className="text-xs text-muted-foreground">A new version is made after every monthly or manual refresh. Earlier ones stay available for 24 months.</p>
      <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
        {state.editions.map((edition, index) => (
          <li key={edition.key} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span>
              {formatDateTime(edition.generated_at)}
              <span className="ml-2 text-xs text-muted-foreground">{TRIGGER_LABEL[edition.trigger] ?? edition.trigger}</span>
              {index === 0 ? <StatusBadge tone="brand" className="ml-2">Latest</StatusBadge> : null}
            </span>
            {url ? (
              <a href={index === 0 ? url : `${url}?e=${encodeURIComponent(edition.key)}`} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Open <ExternalLink aria-hidden className="size-3" />
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BrandingNote({ branding }: { branding: Branding | undefined }) {
  if (!branding) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Branding comes from your <Link to="/settings/white-label" className="font-medium text-primary hover:underline">white-label settings</Link>
      {branding.website_url ? null : " (add your website there so your client can reach you)"}. Changes show on the page at once, earlier versions included.
    </p>
  );
}
