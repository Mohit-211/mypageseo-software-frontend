/**
 * Dialogs for a send of one review that the checks or Google held back (Phase 25a):
 * - `SendAnywayDialog` (409 `confirm_warnings_required`): the warnings, then "Send anyway" (the same
 *   send with `confirm_warnings: true`) or "Go back and edit".
 * - `GoogleReplyDialog` (409 `reply_changed_on_google`): Google already has a reply the app didn't
 *   show. "Replace it with my draft" (send again), "Delete my draft", or "Keep both for now".
 *
 * Both open from a send that is still finishing, so nothing on the page had focus to go back to:
 * `returnFocus` puts it where it belongs however they close (the card's Send button, or the card),
 * and says false when there's nowhere left (the card has gone): the page's own handling then applies.
 */
import { useRef } from "react";
import { CornerDownRight, PenLine, Send, Trash2 } from "lucide-react";
import type { GoogleReply } from "@/api";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/datetime";
import type { DisplayCheck } from "@/lib/reviews/draft-view";
import { DraftFindings } from "./draft-checks";

export function SendAnywayDialog({
  open,
  onOpenChange,
  findings,
  onSendAnyway,
  onEdit,
  focusEditor,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The warnings the send answered with. */
  findings: readonly DisplayCheck[];
  onSendAnyway: () => void;
  /** "Go back and edit": opens the editor. */
  onEdit: () => void;
  /** Puts the focus in the editor as the dialog closes after "Go back and edit" (instead of back on Send). */
  focusEditor?: () => void;
  /** Puts focus back as the dialog closes any other way (Escape, "Send anyway"); false: nowhere to put it. */
  returnFocus?: () => boolean;
}) {
  // Which button closed the dialog, so focus goes to the editor rather than back to Send.
  const editing = useRef(false);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          const toEditor = editing.current && focusEditor;
          editing.current = false;
          if (toEditor) {
            event.preventDefault();
            focusEditor();
          } else if (returnFocus?.()) event.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Send anyway?</AlertDialogTitle>
          <AlertDialogDescription>
            The checks found {findings.length === 1 ? "something" : "a few things"} to look at before this reply goes to Google. Send it as it is, or change it first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <DraftFindings checks={findings} className="rounded-lg border border-warning/30 bg-warning-surface/60 p-3" />
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              editing.current = true;
              onEdit();
            }}
          >
            <PenLine aria-hidden className="size-4" />
            Go back and edit
          </AlertDialogCancel>
          <AlertDialogAction onClick={onSendAnyway}>
            <Send aria-hidden className="size-4" />
            Send anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function GoogleReplyDialog({
  open,
  onOpenChange,
  googleReply,
  draftText,
  onReplace,
  onDelete,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Google's reply as the send found it (`google_reply`). */
  googleReply: GoogleReply | null;
  /** The draft that wasn't sent. */
  draftText: string;
  /** "Replace it with my draft": send the draft again (it replaces the reply now shown). */
  onReplace: () => void;
  /** "Delete my draft": keep Google's reply. */
  onDelete: () => void;
  /** Puts focus back as the dialog closes, whichever way; false: nowhere to put it. */
  returnFocus?: () => boolean;
}) {
  const when = googleReply?.update_time ? formatDateTime(googleReply.update_time, "") : "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl"
        onCloseAutoFocus={(event) => {
          if (returnFocus?.()) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Google already has a reply</DialogTitle>
          <DialogDescription>
            This review has a reply on Google that wasn't shown here: it was added or changed on Google. Your draft wasn't sent. Choose which reply to keep.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 gap-3">
          <section aria-label="The reply on Google" className="min-w-0 rounded-lg border-l-[3px] border-primary/60 bg-surface-strong px-3.5 py-2.5">
            <p className="flex flex-wrap items-center gap-x-1.5 text-xs font-semibold text-foreground">
              <CornerDownRight aria-hidden className="size-3.5 text-primary" />
              On Google now
              {when ? <span className="font-normal text-muted-foreground">· {when}</span> : null}
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
              {googleReply?.comment?.trim() || "Google didn't send the reply's text. Refresh the reviews to see it."}
            </p>
          </section>
          <section aria-label="Your draft" className="min-w-0 rounded-lg border border-border bg-card px-3.5 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <PenLine aria-hidden className="size-3.5 text-muted-foreground" />
              Your draft (not sent)
            </p>
            <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
              {draftText}
            </p>
          </section>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Keep both for now
          </Button>
          <Button
            variant="outline"
            className="text-critical hover:text-critical"
            onClick={() => {
              onOpenChange(false);
              onDelete();
            }}
          >
            <Trash2 aria-hidden /> Delete my draft
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onReplace();
            }}
          >
            <Send aria-hidden /> Replace it with my draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
