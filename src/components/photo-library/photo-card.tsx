import { useId, useState } from "react";
import { CheckCircle2, CircleAlert, Clock3, FolderMinus, Loader2, MoreHorizontal, Pencil, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { ClearablePhotoFlag, PostMediaDetails } from "@/api";
import { CharCount, FieldFoot } from "@/components/ai-settings/settings-parts";
import { ConfirmDialog, FormAlert } from "@/components/layout/shared/form-fields";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CAPTION_MAX,
  FLAG_COPY,
  activeFlags,
  canJoinLibrary,
  isClearable,
  photoChangeErrorText,
  photoKindText,
  photoStatus,
  usageText,
} from "@/lib/photo-library/library";
import { useLibraryMutations } from "@/lib/photo-library/use-library";
import { cn } from "@/lib/utils";

const STATUS_ICON = { success: CheckCircle2, warning: CircleAlert, info: Clock3, neutral: Clock3 } as const;

/** A card on wider screens; on phones a row with a thumbnail, so a list of photos stays short. */
const CARD = "flex min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card sm:flex-col";
const PICTURE = "relative aspect-[4/3] w-28 shrink-0 self-start overflow-hidden bg-muted max-sm:m-3 max-sm:rounded-lg sm:w-full";
const BODY = "flex min-w-0 flex-1 flex-col gap-2 p-3 max-sm:pl-0";

/**
 * One photo of the library: the picture, where it stands for automatic posts (being checked, ready, kept out and
 * why, not picked for its quality), "Use anyway" for a stock-like or watermark flag the owner knows better about
 * (and Undo), its description (the AI's or the owner's; it decides which posts it fits), how often posts used it,
 * and for owners and members "Edit description" and "Take out of the library".
 */
export function LibraryPhotoCard({ locationId, photo, canEdit }: { locationId: string; photo: PostMediaDetails; canEdit: boolean }) {
  const { patch } = useLibraryMutations(locationId);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const status = photoStatus(photo);
  const StatusIcon = STATUS_ICON[status.tone];
  const flags = activeFlags(photo);
  const cleared = photo.screening?.cleared ?? [];
  const caption = photo.caption?.trim() || null;
  const busy = patch.isPending;

  const setCleared = (next: ClearablePhotoFlag[], success: string) =>
    patch.mutate(
      { mediaId: photo.media_id, change: { flags_cleared: next } },
      { onSuccess: () => toast.success(success), onError: (err) => toast.error(photoChangeErrorText(err).text) },
    );

  return (
    <li className={CARD}>
      <div className={PICTURE}>
        <img src={photo.url} alt={caption ?? "A photo in your library"} loading="lazy" className="size-full object-cover" />
      </div>
      <div className={BODY}>
        <div className="flex items-start justify-between gap-2">
          <StatusBadge tone={status.tone} size="sm" icon={status.tone === "info" ? undefined : StatusIcon} dot={status.tone === "info"}>
            {status.label}
          </StatusBadge>
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="-mr-1.5 -mt-1.5 size-9 shrink-0 text-muted-foreground" aria-label={`Actions for this photo${caption ? `: ${caption}` : ""}`} disabled={busy}>
                  {busy ? <Loader2 aria-hidden className="animate-spin" /> : <MoreHorizontal aria-hidden />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <Pencil aria-hidden /> Edit description
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setRemoving(true)} className="text-critical focus:bg-critical-surface focus:text-critical">
                  <FolderMinus aria-hidden /> Take out of the library
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        {status.detail ? <p className="text-xs text-muted-foreground">{status.detail}</p> : null}

        {flags.length > 0 ? (
          <ul className="space-y-1.5">
            {flags.map((flag) => (
              <li key={flag} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-md bg-warning-surface px-2 py-1 text-xs text-foreground">
                <span>{FLAG_COPY[flag]}</span>
                {canEdit && isClearable(flag) ? (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    disabled={busy}
                    onClick={() => setCleared([...cleared.filter((item) => item !== flag), flag], "Marked OK. Automatic posts may use it now.")}
                    className="relative h-auto p-0 text-xs font-semibold after:absolute after:-inset-x-1.5 after:-inset-y-3 after:content-['']"
                  >
                    Use anyway
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {cleared.length > 0 ? (
          <ul className="space-y-1">
            {cleared.map((flag) => (
              <li key={flag} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>You marked it OK: {FLAG_COPY[flag].toLowerCase()}</span>
                {canEdit ? (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    disabled={busy}
                    onClick={() => setCleared(cleared.filter((item) => item !== flag), "Undone. Automatic posts leave it out again.")}
                    className="relative h-auto gap-1 p-0 text-xs font-medium after:absolute after:-inset-x-1.5 after:-inset-y-3 after:content-[''] [&_svg]:size-3.5"
                  >
                    <Undo2 aria-hidden /> Undo
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto space-y-1 pt-1">
          <p className={cn("break-words text-sm", caption ? "text-foreground" : "text-muted-foreground")}>
            {caption ?? (photo.screening?.state === "pending" ? "Being described…" : "No description yet")}
          </p>
          <p className="text-xs text-muted-foreground">
            {photo.caption_source === "user" ? "Your description" : caption ? "Described by AI" : null}
            {caption ? " · " : ""}
            {usageText(photo)}
          </p>
        </div>
      </div>

      {editing ? <CaptionDialog locationId={locationId} photo={photo} onClose={() => setEditing(false)} /> : null}
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title="Take this photo out of your library?"
        description="AI posts stop picking it. It stays with your other photos (and is deleted after 30 days if no post uses it), and you can add it back."
        confirmLabel="Take it out"
        pending={busy}
        onConfirm={() =>
          patch.mutate(
            { mediaId: photo.media_id, change: { library: false } },
            {
              onSuccess: () => {
                setRemoving(false);
                toast.success("Taken out of your library. It's under Other photos.");
              },
              onError: (err) => toast.error(photoChangeErrorText(err).text),
            },
          )
        }
      />
    </li>
  );
}

/** A photo outside the library (uploaded in the post editor, or a post's picture), with "Add to library" when it may join. */
export function OtherPhotoCard({ locationId, photo, canEdit, libraryFull }: { locationId: string; photo: PostMediaDetails; canEdit: boolean; libraryFull: boolean }) {
  const { patch } = useLibraryMutations(locationId);
  const joinable = canJoinLibrary(photo);
  return (
    <li className={CARD}>
      <div className={PICTURE}>
        <img src={photo.url} alt={photo.caption?.trim() || photoKindText(photo)} loading="lazy" className="size-full object-cover" />
      </div>
      <div className={BODY}>
        <p className="text-xs font-medium text-foreground">{photoKindText(photo)}</p>
        <p className="text-xs text-muted-foreground">{usageText(photo)}</p>
        {canEdit ? (
          joinable ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-auto self-start"
              disabled={patch.isPending || libraryFull}
              onClick={() =>
                patch.mutate(
                  { mediaId: photo.media_id, change: { library: true } },
                  {
                    onSuccess: () => toast.success("Added to your library. It's described and checked in the next few minutes."),
                    onError: (err) => toast.error(photoChangeErrorText(err).text),
                  },
                )
              }
            >
              {patch.isPending ? <Loader2 aria-hidden className="animate-spin" /> : <Plus aria-hidden />} Add to library
            </Button>
          ) : (
            <p className="mt-auto text-xs text-muted-foreground">Only photos you upload can join the library.</p>
          )
        ) : null}
      </div>
    </li>
  );
}

/** Writes the photo's description (1–200 characters), or goes back to the AI's. It decides which posts the photo fits. */
function CaptionDialog({ locationId, photo, onClose }: { locationId: string; photo: PostMediaDetails; onClose: () => void }) {
  const { patch } = useLibraryMutations(locationId);
  const id = useId();
  const [text, setText] = useState(photo.caption ?? "");
  const [error, setError] = useState<string | null>(null);
  const trimmed = text.trim();
  const tooLong = trimmed.length > CAPTION_MAX;
  const saving = patch.isPending;

  const save = (caption: string | null, success: string) =>
    patch.mutate(
      { mediaId: photo.media_id, change: { caption } },
      {
        onSuccess: () => {
          toast.success(success);
          onClose();
        },
        onError: (err) => setError(photoChangeErrorText(err).text),
      },
    );

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Describe this photo</DialogTitle>
          <DialogDescription>Say what it shows. The AI picks it for posts about the same thing.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!trimmed || tooLong || saving) return;
            save(trimmed, "Description saved.");
          }}
        >
          <img src={photo.url} alt="" className="aspect-[4/3] w-full max-w-xs rounded-lg border border-border object-cover" />
          <div>
            <Label htmlFor={id}>Description</Label>
            <Textarea
              id={id}
              className="mt-1.5 min-h-20"
              rows={3}
              value={text}
              disabled={saving}
              placeholder="e.g. Our crew fitting a new water heater in a basement"
              aria-invalid={tooLong ? true : undefined}
              aria-describedby={`${id}-message`}
              onChange={(event) => {
                setText(event.target.value);
                setError(null);
              }}
            />
            <FieldFoot
              id={`${id}-message`}
              error={tooLong ? `Keep it to ${CAPTION_MAX} characters.` : null}
              hint="What, where and who (no names needed)."
              count={<CharCount count={trimmed.length} max={CAPTION_MAX} />}
            />
          </div>
          {error ? <FormAlert>{error}</FormAlert> : null}
          <DialogFooter className="gap-2 sm:justify-between">
            {photo.caption_source === "user" ? (
              <Button type="button" variant="ghost" disabled={saving} onClick={() => save(null, "Back to the AI's description.")}>
                Use the AI's description
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!trimmed || tooLong || saving} aria-busy={saving || undefined}>
                {saving ? <Loader2 aria-hidden className="animate-spin" /> : null}
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
