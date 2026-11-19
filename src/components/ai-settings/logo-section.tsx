import { useId, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { ImageOff, ImagePlus, Loader2, Pencil, Stamp, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { LocationLogo, LocationLogoInput, LocationLogoView, LogoCandidate } from "@/api";
import { EmptyState, ErrorState, SectionSkeleton } from "@/components/layout/shared/feedback/states";
import { ConfirmDialog, FormAlert } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useAccess } from "@/hooks/use-access";
import { isNotAvailableYet } from "@/lib/ai-settings/errors";
import {
  LOGO_ACCEPT,
  candidateSourceText,
  formatBytes,
  logoConfirmedText,
  logoErrorText,
  logoFileProblem,
  readFileAsDataUrl,
  shortUrl,
} from "@/lib/ai-settings/logo";
import { useLocationLogo, useLogoMutations } from "@/lib/ai-settings/use-logo";
import { useViewerUserId } from "@/lib/posts/ai-runs";
import { cn } from "@/lib/utils";

/** A see-through logo shows on a light checkerboard, so its own edges are visible. */
const CHECKERBOARD =
  "bg-[length:16px_16px] bg-[position:0_0,8px_8px] bg-[image:linear-gradient(45deg,var(--color-muted)_25%,transparent_25%,transparent_75%,var(--color-muted)_75%),linear-gradient(45deg,var(--color-muted)_25%,transparent_25%,transparent_75%,var(--color-muted)_75%)]";

/**
 * "Your logo" (`#logo`, Phase 25c): the location's own logo, which code places on its post pictures (in a quiet
 * corner, or in the band of a designed graphic). Shown from its private `data_url`, with where it came from, who
 * confirmed it is the business's own (`attested_by_name`) and its colours. Owners and members add, replace or
 * remove it; a client user sees it.
 */
export function LogoSection({ locationId, canEdit, isAgency }: { locationId: string; canEdit: boolean; isAgency: boolean }) {
  const query = useLocationLogo(locationId);
  const { remove } = useLogoMutations(locationId);
  const isClientUser = useAccess().role === "client_user";
  const [dialog, setDialog] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const view = query.data;
  if (!view) {
    if (!query.isError) return <SectionSkeleton lines={3} className="border-0 p-0 shadow-none" />;
    if (isNotAvailableYet(query.error)) {
      return <EmptyState variant="unavailable" tone="ai" compact title="Your logo isn't available yet" description="You can add your logo here once it's switched on." />;
    }
    return <ErrorState compact className="shadow-none" description="Your logo couldn't be loaded. Nothing was changed." onRetry={() => void query.refetch()} />;
  }

  const found = view.candidates.length;
  return (
    <>
      {view.logo ? (
        <CurrentLogo
          logo={view.logo}
          isClientUser={isClientUser}
          actions={
            canEdit ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setDialog(true)}>
                  <Pencil aria-hidden /> Replace
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-critical hover:bg-critical-surface hover:text-critical"
                  onClick={() => setConfirmRemove(true)}
                >
                  <Trash2 aria-hidden /> Remove
                </Button>
              </div>
            ) : null
          }
        />
      ) : (
        <EmptyState
          icon={Stamp}
          tone="ai"
          compact
          title="No logo yet"
          description={
            canEdit
              ? `Add your logo and it goes on your post pictures.${found ? ` We found ${found === 1 ? "a possible logo" : `${found} possible logos`} on your website.` : ""}`
              : "Your agency adds the logo that goes on post pictures."
          }
          action={
            canEdit ? (
              <Button type="button" variant="outline" onClick={() => setDialog(true)}>
                <ImagePlus aria-hidden /> Add your logo
              </Button>
            ) : undefined
          }
        />
      )}

      {dialog ? <LogoDialog locationId={locationId} view={view} isAgency={isAgency} onClose={() => setDialog(false)} /> : null}

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove your logo?"
        description="New post pictures go out without a logo until you add one again. Pictures made already keep theirs."
        confirmLabel="Remove"
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              setConfirmRemove(false);
              toast.success("Logo removed. New post pictures go out without one.");
            },
            onError: (err) => toast.error(logoErrorText(err)),
          })
        }
      />
    </>
  );
}

function CurrentLogo({ logo, isClientUser, actions }: { logo: LocationLogo; isClientUser: boolean; actions: ReactNode }) {
  const viewerId = useViewerUserId();
  const source =
    logo.copied_from !== null && logo.copied_from !== undefined
      ? "Copied from another of your locations"
      : logo.source === "website"
        ? `From your website${logo.source_url ? ` (${shortUrl(logo.source_url)})` : ""}`
        : "Uploaded";
  const confirmed = logoConfirmedText(logo, { userId: viewerId, clientUser: isClientUser });
  const size = [logo.width && logo.height ? `${logo.width} × ${logo.height} px` : null, formatBytes(logo.bytes) || null].filter(Boolean).join(" · ");
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className={cn("flex h-32 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border p-3 sm:w-56", logo.transparent ? CHECKERBOARD : "bg-card")}>
        <img src={logo.data_url} alt="Your logo" className="max-h-full max-w-full object-contain" />
      </div>
      <div className="min-w-0 flex-1 space-y-2 text-sm">
        <p className="font-medium text-foreground">{source}</p>
        {confirmed ? <p className="text-muted-foreground">{confirmed}</p> : null}
        {logo.palette?.length ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Its colours, used by designed graphics:</span>
            {logo.palette.slice(0, 6).map((color) => (
              <span key={color} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 font-mono text-foreground">
                <span aria-hidden className="size-3 rounded-full ring-1 ring-inset ring-border-strong" style={{ backgroundColor: color }} />
                {color}
              </span>
            ))}
          </div>
        ) : null}
        {size ? <p className="text-xs text-muted-foreground">{size}</p> : null}
        {actions}
      </div>
    </div>
  );
}

type Picked = { name: string; dataUrl: string; size: number };

/**
 * Adds or replaces the logo: an upload (PNG, JPEG or WebP up to 512 KB) or one found on the business's website,
 * the required confirmation that it is the business's own, and "Use for all my locations" for a Business owner.
 * The AI check takes up to about a minute; nothing is saved when it refuses the logo or can't run.
 */
function LogoDialog({ locationId, view, isAgency, onClose }: { locationId: string; view: LocationLogoView; isAgency: boolean; onClose: () => void }) {
  const { set } = useLogoMutations(locationId);
  const fileInput = useRef<HTMLInputElement>(null);
  const attestId = useId();
  const allId = useId();
  const candidatesId = useId();
  const [mode, setMode] = useState<"website" | "upload">(view.candidates.length > 0 ? "website" : "upload");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<string | null>(view.candidates[0]?.url ?? null);
  const [attest, setAttest] = useState(false);
  const [applyAll, setApplyAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = set.isPending;

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // The same file can be picked again after a refusal.
    event.target.value = "";
    setError(null);
    if (!file) return;
    const problem = logoFileProblem(file);
    if (problem) {
      setPicked(null);
      setFileError(problem);
      return;
    }
    try {
      setPicked({ name: file.name, dataUrl: await readFileAsDataUrl(file), size: file.size });
      setFileError(null);
    } catch {
      setPicked(null);
      setFileError("This file couldn't be read. Try another one.");
    }
  };

  const chosen = mode === "upload" ? Boolean(picked) : Boolean(candidate);
  const submit = () => {
    if (saving || !chosen || !attest) return;
    const base: LocationLogoInput =
      mode === "upload" && picked ? { data: picked.dataUrl, attest: true } : { candidate_url: candidate ?? "", attest: true };
    const input: LocationLogoInput = applyAll && view.can_apply_to_organization ? { ...base, apply_to: "organization" } : base;
    setError(null);
    set.mutate(input, {
      onSuccess: (answer) => {
        const others = answer?.applied_to ?? 0;
        toast.success(
          input.apply_to && others > 0
            ? `Logo saved here and at ${others} other ${others === 1 ? "location" : "locations"}.`
            : "Logo saved. It goes on new post pictures.",
        );
        onClose();
      },
      onError: (err) => setError(logoErrorText(err)),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{view.logo ? "Replace your logo" : "Add your logo"}</DialogTitle>
          <DialogDescription>
            It goes on your post pictures in a quiet corner. A logo with a phone number, a web address, badges or many words can't be used.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {view.candidates.length > 0 ? (
            <SegmentedControl<"website" | "upload">
              aria-label="Where the logo comes from"
              value={mode}
              onValueChange={(value) => {
                setMode(value);
                setError(null);
              }}
              options={[
                { value: "website", label: "From your website" },
                { value: "upload", label: "Upload a file" },
              ]}
            />
          ) : null}

          {mode === "website" ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">Logos found on your website</legend>
              <RadioGroup
                id={candidatesId}
                value={candidate ?? ""}
                onValueChange={(value) => {
                  setCandidate(value);
                  setError(null);
                }}
                className="grid gap-2 sm:grid-cols-2"
              >
                {view.candidates.map((item, index) => (
                  <CandidateOption key={item.url} candidate={item} id={`${candidatesId}-${index}`} selected={candidate === item.url} />
                ))}
              </RadioGroup>
            </fieldset>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Your logo file</p>
              <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border-strong bg-card p-3 sm:flex-row sm:items-center">
                <div className={cn("flex h-24 w-full shrink-0 items-center justify-center overflow-hidden rounded-md border border-border p-2 sm:w-36", CHECKERBOARD)}>
                  {picked ? (
                    <img src={picked.dataUrl} alt="The logo you picked" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <ImagePlus aria-hidden className="size-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 space-y-1.5">
                  <input ref={fileInput} type="file" accept={LOGO_ACCEPT} hidden onChange={(event) => void onFile(event)} disabled={saving} />
                  <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => fileInput.current?.click()}>
                    <Upload aria-hidden /> {picked ? "Pick another file" : "Choose a file"}
                  </Button>
                  <p className="break-all text-xs text-muted-foreground">
                    {picked ? `${picked.name} · ${formatBytes(picked.size)}` : "PNG, JPEG or WebP, up to 512 KB. A square or stacked logo fits best."}
                  </p>
                  {fileError ? (
                    <p role="alert" className="text-xs font-medium text-critical">
                      {fileError}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2.5 rounded-lg border border-border bg-surface-strong px-3.5 py-3">
            <div className="flex items-start gap-3">
              <Checkbox id={attestId} checked={attest} disabled={saving} onCheckedChange={(value) => setAttest(value === true)} className="mt-0.5" />
              <label htmlFor={attestId} className="cursor-pointer text-sm font-medium text-foreground">
                {isAgency ? "This is the business's own logo, and it may be used on its posts." : "This is my business's own logo, and we may use it."}
              </label>
            </div>
            {view.can_apply_to_organization ? (
              <div className="flex items-start gap-3">
                <Checkbox id={allId} checked={applyAll} disabled={saving} onCheckedChange={(value) => setApplyAll(value === true)} className="mt-0.5" />
                <label htmlFor={allId} className="cursor-pointer text-sm text-foreground">
                  Use this logo for all my locations
                </label>
              </div>
            ) : null}
          </div>

          {saving ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden className="size-4 animate-spin" /> Checking your logo. This can take up to a minute.
            </p>
          ) : null}
          {error ? <FormAlert>{error}</FormAlert> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving || !chosen || !attest} aria-busy={saving || undefined} onClick={submit}>
            {saving ? <Loader2 aria-hidden className="animate-spin" /> : null}
            {saving ? "Checking…" : "Check and save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A logo found on the website, as a choice; the picture is the site's own (its address shows when it can't load). */
function CandidateOption({ candidate, id, selected }: { candidate: LogoCandidate; id: string; selected: boolean }) {
  const [broken, setBroken] = useState(false);
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
        selected ? "border-primary bg-brand-tint/60" : "border-border-strong bg-card hover:bg-accent/60",
      )}
    >
      <RadioGroupItem id={id} value={candidate.url} className="mt-1" />
      <span className="min-w-0 flex-1">
        <span className={cn("flex h-16 w-full items-center justify-center overflow-hidden rounded-md border border-border p-1.5", CHECKERBOARD)}>
          {broken ? (
            <ImageOff aria-hidden className="size-5 text-muted-foreground" />
          ) : (
            <img
              src={candidate.url}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setBroken(true)}
              className="max-h-full max-w-full object-contain"
            />
          )}
        </span>
        <span className="mt-1.5 block text-xs font-medium text-foreground">{candidateSourceText(candidate)}</span>
        <span className="block break-all text-xs text-muted-foreground">{shortUrl(candidate.url)}</span>
      </span>
    </label>
  );
}
