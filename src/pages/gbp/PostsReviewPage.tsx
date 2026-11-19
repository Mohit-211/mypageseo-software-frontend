import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, CheckCheck, ChevronLeft, ChevronRight, ClipboardCheck, LoaderCircle, MapPin, Plus } from "lucide-react";
import type { ReviewQueuePost } from "@/api";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/layout/shared/feedback/states";
import { ReviewQueueCard } from "@/components/posts/review-queue-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCanEdit } from "@/hooks/use-access";
import { useNow } from "@/hooks/use-now";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { useToastPostError } from "@/lib/posts/post-toasts";
import {
  BULK_APPROVE_MAX,
  REVIEW_QUEUE_PAGE_SIZE,
  approvableNow,
  approvedText,
  notApprovedText,
  useApproveQueuedPosts,
  useReviewQueue,
} from "@/lib/posts/review-queue";
import { postErrorText } from "@/lib/posts/use-posts";
import { byText, sortRows } from "@/lib/sort";
import { setParam, useSearchUpdater } from "@/lib/url-state";

const ALL = "all";

/**
 * "Posts to review" (`/gbp/posts/review`, Phase 25c; the AI review digest links here with `?organization=<id>`,
 * which the app handles globally): the AI posts waiting for a person across the locations the user sees, soonest
 * first, for owners, members and client users alike. Each post shows why it waits, when its review lapses, what the
 * checks flagged and its picture; whoever may approve it (`can_approve`) approves it here, one at a time or several
 * at once (`POST /posts/approve`, one result per post). Others see who it waits for. `?location=<id>` narrows it to
 * one location (the series cards link here that way); `?page=` pages it.
 */
function PostsReviewPage() {
  const workspace = useWorkspace();
  const canEdit = useCanEdit();
  const [params] = useSearchParams();
  const updateSearch = useSearchUpdater();
  const now = useNow();
  const approve = useApproveQueuedPosts();
  const toastError = useToastPostError();
  const locations = useMemo(() => sortRows(workspace.locations, byText((location) => location.businessName)), [workspace.locations]);
  const asked = params.get("location");
  // A location the user doesn't have (another organization's, a removed one) is ignored.
  const locationId = asked && (workspace.status !== "ready" || locations.some((location) => location.id === asked)) ? asked : null;
  const page = Math.max(1, Math.floor(Number(params.get("page")) || 1));
  const queue = useReviewQueue({ locationId, page, enabled: workspace.status === "ready" && locations.length > 0 });
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [notes, setNotes] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [approving, setApproving] = useState<ReadonlySet<string>>(() => new Set());

  const data = queue.data;
  const posts = data?.posts ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (data?.limit ?? REVIEW_QUEUE_PAGE_SIZE)));
  const busy = approving.size > 0;
  // The previous filter's or page's posts stay on screen while the next load: nothing can be approved meanwhile.
  const stale = queue.isPlaceholderData;
  // Approvable now: `can_approve`, and no hard finding still stands (the post card's rule, `approvableNow`).
  const selectable = posts.filter(approvableNow);
  const chosen = selectable.filter((post) => selected.has(post.post_id)).slice(0, BULK_APPROVE_MAX);
  const allChosen = selectable.length > 0 && chosen.length === Math.min(selectable.length, BULK_APPROVE_MAX);

  const reset = () => {
    setSelected(new Set());
    setNotes(new Map());
  };
  const showLocation = (value: string) => {
    reset();
    updateSearch((next) => {
      setParam(next, "location", value === ALL ? null : value);
      next.delete("page");
    });
  };
  const showPage = (value: number) => {
    reset();
    updateSearch((next) => setParam(next, "page", value > 1 ? String(value) : null), { push: true });
  };

  const run = async (targets: readonly ReviewQueuePost[]) => {
    if (targets.length === 0 || busy) return;
    setApproving(new Set(targets.map((post) => post.post_id)));
    try {
      const answer = await approve(targets);
      const byId = new Map(targets.map((post) => [post.post_id, post]));
      const failed = answer.results.filter((result) => !result.approved);
      // A refusal means something changed since the page loaded (a role, the location's approval mode), so the note
      // doesn't guess who approves now; the card says it from the post as read again (`waitsForText`).
      setNotes((current) => {
        const next = new Map(current);
        for (const result of answer.results) {
          if (result.approved) next.delete(result.post_id);
          else next.set(result.post_id, notApprovedText(result.reason));
        }
        return next;
      });
      setSelected((current) => new Set([...current].filter((id) => !answer.results.some((result) => result.approved && result.post_id === id))));
      const single = targets.length === 1 ? answer.results[0] : undefined;
      if (answer.approved > 0) {
        toast.success(answer.approved === 1 ? "Post approved" : `${answer.approved} posts approved`, {
          description: single?.approved
            ? approvedText(single, byId.get(single.post_id), Date.now())
            : failed.length > 0
              ? `${failed.length === 1 ? "1 post wasn't" : `${failed.length} posts weren't`} approved: see the note on ${failed.length === 1 ? "it" : "each"}.`
              : "Each goes out at its time.",
        });
      } else if (failed.length > 0) {
        toast.error(targets.length === 1 ? "The post wasn't approved" : "No post was approved", {
          description: targets.length === 1 ? notApprovedText(failed[0]?.reason) : "See the note on each post.",
        });
      }
    } catch (err) {
      toastError(err, targets.length === 1 ? "The post couldn't be approved. Try again." : "The posts couldn't be approved. Try again.");
    } finally {
      setApproving(new Set());
    }
  };

  const header = (
    <PageHeader
      icon={ClipboardCheck}
      tone="posts"
      showLocation={false}
      title="Posts to review"
      description="AI posts that wait for a person before they go to Google, across your locations. Read each one, then approve it."
      actions={
        <Button asChild variant="outline">
          <Link to="/gbp/posts">
            <CalendarDays aria-hidden /> Posts calendar
          </Link>
        </Button>
      }
    />
  );

  if (workspace.status === "loading") {
    return (
      <>
        {header}
        <ListSkeleton rows={3} />
      </>
    );
  }

  if (locations.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={MapPin}
          tone="locations"
          title="No locations yet"
          description="AI posts waiting for review show up here once a location is set up and its auto-posts or AI writer are in use."
          action={
            canEdit ? (
              <Button asChild>
                <Link to="/locations/add">
                  <Plus aria-hidden /> Add location
                </Link>
              </Button>
            ) : undefined
          }
        />
      </>
    );
  }

  const filterName = locationId ? (locations.find((location) => location.id === locationId)?.businessName ?? "this location") : null;

  return (
    <>
      {header}

      <section aria-label="Posts waiting for review" className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
          {locations.length > 1 ? (
            <Select value={locationId ?? ALL} onValueChange={showLocation} disabled={busy}>
              <SelectTrigger className="w-full sm:w-64" aria-label="Show posts for">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All locations</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.businessName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {queue.isPending || stale ? "Loading…" : total === 1 ? "1 post waits for review" : `${total} posts wait for review`}
          </p>
          {selectable.length > 0 ? (
            <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 sm:ml-auto sm:w-auto">
              <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm font-medium text-foreground">
                <Checkbox
                  checked={allChosen ? true : chosen.length > 0 ? "indeterminate" : false}
                  disabled={busy || stale}
                  onCheckedChange={(value) =>
                    setSelected(value === true ? new Set(selectable.slice(0, BULK_APPROVE_MAX).map((post) => post.post_id)) : new Set())
                  }
                />
                Select all I can approve
              </label>
              <Button disabled={chosen.length === 0 || busy || stale} aria-busy={busy || undefined} onClick={() => void run(chosen)}>
                {busy && approving.size > 1 ? <LoaderCircle aria-hidden className="animate-spin" /> : <CheckCheck aria-hidden />}
                {chosen.length > 0 ? `Approve ${chosen.length} selected` : "Approve selected"}
              </Button>
            </div>
          ) : null}
        </div>

        {queue.isPending ? (
          <ListSkeleton rows={3} />
        ) : queue.isError ? (
          <ErrorState description={postErrorText(queue.error, "The posts to review couldn't be loaded.").message} onRetry={() => void queue.refetch()} />
        ) : posts.length === 0 && total > 0 && page > 1 ? (
          <EmptyState
            variant="no-results"
            title="Nothing left on this page"
            description="The posts that were here have been reviewed. More wait on the first page."
            action={
              <Button variant="outline" onClick={() => showPage(1)}>
                Go to the first page
              </Button>
            }
          />
        ) : posts.length === 0 ? (
          <EmptyState
            variant="all-done"
            tone="posts"
            title={filterName ? `Nothing waits for review at ${filterName}` : "Nothing waits for review"}
            description="When AI writes a post that needs a person's OK before it goes to Google, it shows up here with what our checks found."
            action={
              filterName ? (
                <Button variant="outline" onClick={() => showLocation(ALL)}>
                  Show all locations
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link to="/gbp/posts">
                    <CalendarDays aria-hidden /> Open the posts calendar
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <ul className="space-y-4" aria-busy={stale || undefined}>
            {posts.map((post) => (
              <li key={post.post_id}>
                <ReviewQueueCard
                  post={post}
                  now={now}
                  selected={selected.has(post.post_id)}
                  onSelect={(value) =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (value) next.add(post.post_id);
                      else next.delete(post.post_id);
                      return next;
                    })
                  }
                  onApprove={() => void run([post])}
                  approving={approving.has(post.post_id)}
                  disabled={busy || stale}
                  note={notes.get(post.post_id) ?? null}
                />
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && !queue.isPending && !queue.isError ? (
          <nav aria-label="Pages" className="flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1 || stale} onClick={() => showPage(page - 1)}>
              <ChevronLeft aria-hidden /> Previous
            </Button>
            <p className="text-sm text-muted-foreground">
              Page {Math.min(page, pages)} of {pages}
            </p>
            <Button variant="outline" size="sm" disabled={page >= pages || stale} onClick={() => showPage(page + 1)}>
              Next <ChevronRight aria-hidden />
            </Button>
          </nav>
        ) : null}
      </section>
    </>
  );
}

export default PostsReviewPage;
