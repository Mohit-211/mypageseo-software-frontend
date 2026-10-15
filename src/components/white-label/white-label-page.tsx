import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, ImageUp, Link2, LoaderCircle, Save, Trash2 } from "lucide-react";
import {
  deleteBrandingLogo,
  getBranding,
  getBrandingLogo,
  isApiError,
  updateBranding,
  uploadBrandingLogo,
  type Branding,
  type BrandingInput,
} from "@/api";
import { PageHeader, Panel } from "@/components/layout/shared/data-display";
import { ComingSoon } from "@/components/layout/shared/feedback/coming-soon";
import { ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { SettingsNav } from "@/components/settings/settings-nav";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAccess } from "@/hooks/use-access";
import { BRANDING_KEY } from "@/lib/white-label/client-links";
import { HEX, WEBSITE_URL, readLogoFile, usePrivateLogoUrl } from "@/lib/white-label/branding";
import { ColorField } from "./branding-fields";

type Form = Required<{ [K in keyof BrandingInput]: NonNullable<BrandingInput[K]> }>;

function toForm(branding: Branding): Form {
  return {
    agency_name: branding.agency_name ?? "",
    website_url: branding.website_url ?? "",
    primary_color: branding.primary_color ?? "#1d4ed8",
    secondary_color: branding.secondary_color ?? "#0f766e",
    footer_text: branding.footer_text ?? "",
    contact_text: branding.contact_text ?? "",
    hide_mypageseo: branding.hide_mypageseo,
    email_sender_name: branding.email_sender_name ?? "",
    email_reply_to: branding.email_reply_to ?? "",
  };
}

/**
 * White-label settings (agency): the branding on reports, share pages, report emails and client links
 * (`/organization/branding`). The owner edits; other members see it read-only.
 */
export function WhiteLabelPage() {
  const access = useAccess();
  const canManage = access.can("white_label.manage");
  const branding = useQuery({ queryKey: BRANDING_KEY, queryFn: ({ signal }) => getBranding(signal) });

  return (
    <>
      <PageHeader
        title="White-label settings"
        description="Your agency's own name, website, logo and colours on client reports, client links and report emails. They can differ from your organization details."
      />
      <SettingsNav active="white-label" isAgency className="mt-4" />
      {branding.isPending ? (
        <PageSkeleton />
      ) : branding.isError ? (
        <ErrorState description="Branding couldn't be loaded." onRetry={() => void branding.refetch()} />
      ) : (
        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            <BrandingForm branding={branding.data} canManage={canManage} />
            <Panel
              title="Client links"
              description="One link per location for your client: a page on a neutral domain with your branding and the reports you choose. It updates after every refresh, and your client can open earlier versions. MyPageSEO isn't mentioned on it."
            >
              <p className="mb-3 text-sm text-muted-foreground">Create a location's link from its Reports page. Changes here show on every link at once, older versions included.</p>
              <Button asChild variant="outline" size="sm"><Link to="/reports/client-links"><Link2 aria-hidden /> Client links <ArrowRight aria-hidden /></Link></Button>
            </Panel>
            <Panel title="Client reports" description="Every report you create or schedule uses this branding. Reports already generated keep the branding they were made with.">
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm"><Link to="/reports">Reports <ArrowRight aria-hidden /></Link></Button>
                <Button asChild variant="outline" size="sm"><Link to="/reports/scheduled">Scheduled reports <ArrowRight aria-hidden /></Link></Button>
              </div>
            </Panel>
            <ComingSoon
              title="Custom domain"
              description="Share links will be able to use your own domain (for example reports.youragency.com). Until then client links use a neutral domain with your branding on the page."
            />
          </div>
          <BrandPreview branding={branding.data} />
        </div>
      )}
    </>
  );
}

function BrandingForm({ branding, canManage }: { branding: Branding; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(() => toForm(branding));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(branding));

  const save = async () => {
    if (!HEX.test(form.primary_color) || !HEX.test(form.secondary_color)) {
      setError("Colours must look like #1d4ed8.");
      return;
    }
    if (form.website_url && (!WEBSITE_URL.test(form.website_url) || form.website_url.length > 300)) {
      setError("The website must start with http:// or https://.");
      return;
    }
    if (form.email_reply_to && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email_reply_to)) {
      setError("The reply-to address isn't a valid email.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      queryClient.setQueryData(BRANDING_KEY, await updateBranding(form));
      void queryClient.invalidateQueries({ queryKey: ["onboarding"] });
      toast.success("Branding saved. New reports use it.");
    } catch (err) {
      setError(isApiError(err) && err.reason === "owner_only" ? "Only the account owner can change branding." : isApiError(err) && err.status === 400 && err.message ? err.message : "Branding couldn't be saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Branding" description={canManage ? undefined : "Only the account owner can change branding."}>
      <fieldset disabled={!canManage || saving} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="brand-name">Agency name</Label>
            <Input id="brand-name" placeholder={branding.name ?? undefined} value={form.agency_name} onChange={(event) => set("agency_name", event.target.value)} />
            <p className="text-xs text-muted-foreground">Empty uses your organization's name.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-website">Website URL</Label>
            <Input id="brand-website" type="url" placeholder="https://youragency.com" value={form.website_url} onChange={(event) => set("website_url", event.target.value)} />
            <p className="text-xs text-muted-foreground">Linked from your client links.</p>
          </div>
          <ColorField id="brand-primary" label="Primary colour" value={form.primary_color} onChange={(value) => set("primary_color", value)} />
          <ColorField id="brand-secondary" label="Secondary colour" value={form.secondary_color} onChange={(value) => set("secondary_color", value)} />
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="brand-contact">Contact line</Label>
            <Input id="brand-contact" placeholder="hello@youragency.com · (416) 555-0199" value={form.contact_text} onChange={(event) => set("contact_text", event.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="brand-footer">Footer text</Label>
            <Textarea id="brand-footer" rows={2} value={form.footer_text} onChange={(event) => set("footer_text", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-sender">Email sender name</Label>
            <Input id="brand-sender" placeholder={`${form.agency_name || branding.name || "Your agency"} via MyPageSEO`} value={form.email_sender_name} onChange={(event) => set("email_sender_name", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-reply">Reply-to address</Label>
            <Input id="brand-reply" type="email" value={form.email_reply_to} onChange={(event) => set("email_reply_to", event.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={form.hide_mypageseo} onCheckedChange={(value) => set("hide_mypageseo", value === true)} /> Hide “MyPageSEO” on reports and share pages (client links never show it)
        </label>
        <LogoField branding={branding} canManage={canManage} />
        {error ? <p role="alert" className="text-sm text-critical">{error}</p> : null}
        {canManage ? (
          <Button disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : <Save aria-hidden />} Save branding
          </Button>
        ) : null}
      </fieldset>
    </Panel>
  );
}

/** The organization's logo as an object URL. */
function useLogoUrl(branding: Branding) {
  return usePrivateLogoUrl(BRANDING_KEY, branding.logo ? getBrandingLogo : null, [branding.logo?.bytes ?? null, branding.updated_at ?? null]);
}

function LogoField({ branding, canManage }: { branding: Branding; canManage: boolean }) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const url = useLogoUrl(branding);
  const [busy, setBusy] = useState(false);

  const upload = (file: File) => {
    readLogoFile(file).then(
      (dataUrl) => {
        setBusy(true);
        void uploadBrandingLogo(dataUrl)
          .then((result) => {
            queryClient.setQueryData(BRANDING_KEY, result);
            void queryClient.invalidateQueries({ queryKey: BRANDING_KEY });
            toast.success("Logo saved.");
          })
          .catch((err: unknown) => toast.error(isApiError(err) && err.reason === "logo_too_large" ? "The logo must be 512 KB or smaller." : isApiError(err) && err.reason === "logo_type" ? "Use a PNG or JPEG logo." : "The logo couldn't be saved."))
          .finally(() => setBusy(false));
      },
      (err: Error) => toast.error(err.message),
    );
  };

  const remove = () => {
    setBusy(true);
    void deleteBrandingLogo()
      .then(() => queryClient.invalidateQueries({ queryKey: BRANDING_KEY }))
      .then(() => toast.success("Logo removed."))
      .catch(() => toast.error("The logo couldn't be removed."))
      .finally(() => setBusy(false));
  };

  return (
    <div className="space-y-1.5">
      <Label>Logo</Label>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-14 w-32 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-background">
          {url ? <img src={url} alt="Your logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">No logo</span>}
        </div>
        {canManage ? (
          <>
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) upload(file);
              }}
            />
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <ImageUp aria-hidden />} {branding.logo ? "Replace" : "Upload"}
            </Button>
            {branding.logo ? (
              <Button type="button" size="sm" variant="ghost" className="text-critical" disabled={busy} onClick={remove}>
                <Trash2 aria-hidden /> Remove
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">PNG or JPEG, up to 512 KB.</p>
    </div>
  );
}

/** How the header and footer of a report look with the saved branding. */
function BrandPreview({ branding }: { branding: Branding }) {
  const url = useLogoUrl(branding);
  const primary = branding.primary_color ?? "#1d4ed8";
  const secondary = branding.secondary_color ?? "#0f766e";
  return (
    <Panel title="Preview" description="The saved branding on a report page.">
      <div className="overflow-hidden rounded-md border border-border bg-white text-slate-900">
        <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: primary }}>
          {url ? <img src={url} alt="" className="h-8 max-w-24 rounded bg-white/90 object-contain p-0.5" /> : null}
          <span className="text-sm font-semibold text-white">{branding.name || "Your agency"}</span>
        </div>
        <div className="space-y-2 p-4">
          <p className="text-sm font-semibold" style={{ color: primary }}>Rank Tracker Report</p>
          <div className="h-2 w-3/4 rounded bg-slate-200" />
          <div className="h-2 w-1/2 rounded bg-slate-200" />
          <div className="mt-3 inline-block rounded px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: secondary }}>Average rank 8.4</div>
        </div>
        <div className="border-t border-slate-200 px-4 py-2 text-[11px] text-slate-500">
          {branding.footer_text || branding.contact_text || "Footer text"}
          {branding.hide_mypageseo ? "" : " · Powered by MyPageSEO"}
        </div>
      </div>
    </Panel>
  );
}
