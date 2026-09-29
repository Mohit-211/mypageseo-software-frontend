import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  AlertCircle,
  CalendarClock,
  Check,
  Copy,
  Pencil,
  Repeat,
  RotateCw,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { PageHeader, Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, SectionSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AI_POST_CTA_LABEL,
  AI_POST_TYPE_LABEL,
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_TONE,
  postActions,
  RECURRENCE_LABEL,
  WEEKDAY_SHORT,
} from "@/lib/gbp/ai-posts";
import { usePostActions } from "./use-post-actions";
import { AI_POSTS_PATH, AiIndicator, BackToPostsLink, PostStatusBadge, PostThumbnail } from "./post-ui";
import { useWorkspaceAiPosts } from "./use-workspace-ai-posts";

const DATE_TIME = "EEE, MMM d, yyyy 'at' h:mm a";

export function PostDetails({ postId }: { postId: string }) {
  const navigate = useNavigate();
  const { status, allPosts } = useWorkspaceAiPosts();
  const post = allPosts.find((p) => p.id === postId) ?? null;
  const actions = usePostActions(post, { onDeleted: () => navigate(AI_POSTS_PATH) });

  if (status === "loading") return <PostDetailsSkeleton />;

  if (!post) {
    return (
      <div className="space-y-6">
        <BackToPostsLink />
        <EmptyState
          title="Post not found"
          description="This post may have been deleted or belongs to a profile outside this workspace."
          action={<Button variant="outline" onClick={() => navigate(AI_POSTS_PATH)}>Back to AI GBP Posts</Button>}
        />
      </div>
    );
  }

  const allowed = postActions(post);
  const when = post.publishedAt ?? post.scheduledAt;

  return (
    <div className="space-y-6">
      <BackToPostsLink />
      <PageHeader
        title={post.title}
        description={`${post.businessName} · ${AI_POST_TYPE_LABEL[post.type]}`}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <PostStatusBadge status={post.status} />
            {post.aiGenerated ? <AiIndicator label="AI generated" /> : null}
          </div>
        }
        actions={
          <>
            {allowed.canEdit ? (
              <Button variant="outline" size="sm" onClick={actions.edit}><Pencil aria-hidden /> Edit</Button>
            ) : null}
            {allowed.canApprove ? (
              <Button variant="outline" size="sm" onClick={actions.approve}><Check aria-hidden /> Approve</Button>
            ) : null}
            {allowed.canReschedule ? (
              <Button variant="outline" size="sm" onClick={actions.reschedule}><CalendarClock aria-hidden /> Reschedule</Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={actions.duplicate}><Copy aria-hidden /> Duplicate</Button>
            <Button variant="accent-outline" size="sm" onClick={actions.remove}><Trash2 aria-hidden /> Delete</Button>
          </>
        }
      />

      {post.status === "pending_approval" ? (
        <div className="flex flex-col gap-4 rounded-lg border border-warning/40 bg-warning-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-warning text-white">
              <ShieldAlert className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-semibold text-warning-foreground">Approval Required</h2>
              <p className="mt-0.5 text-sm text-warning-foreground/85">
                Review the content below. Once approved, this post
                {post.scheduledAt ? ` goes live ${format(new Date(post.scheduledAt), "MMM d 'at' h:mm a")}` : " is published"}.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={actions.reject}><X aria-hidden /> Reject</Button>
            <Button onClick={actions.approve}><Check aria-hidden /> Approve &amp; Schedule</Button>
          </div>
        </div>
      ) : null}

      {post.status === "failed" ? (
        <div className="flex flex-col gap-3 rounded-lg border border-critical/25 bg-critical-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-critical" aria-hidden />
            <div>
              <h2 className="text-sm font-semibold text-critical">Publishing failed</h2>
              <p className="mt-0.5 text-sm text-foreground">{post.failureReason ?? "Google didn't return a reason."}</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={actions.edit}><Pencil aria-hidden /> Fix &amp; edit</Button>
            <Button variant="accent" onClick={actions.retry}><RotateCw aria-hidden /> Retry publish</Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Post content">
          <div className="space-y-4">
            <div className="relative">
              <PostThumbnail
                src={post.imageUrl}
                alt={`Image for ${post.title}`}
                className="aspect-[4/3] w-full max-w-2xl"
                iconClassName="size-8"
              />
              {post.imageSource === "ai" ? (
                <AiIndicator label="AI image" className="absolute left-2 top-2 bg-surface/95 shadow-card" />
              ) : null}
            </div>
            <p className="max-w-2xl whitespace-pre-line text-sm leading-relaxed text-foreground">{post.content}</p>
            {post.cta !== "none" ? (
              <p className="text-xs text-muted-foreground">
                Call to action: <span className="font-medium text-foreground">{AI_POST_CTA_LABEL[post.cta]}</span>
              </p>
            ) : null}
          </div>
        </Panel>

        <Panel title="Details">
          <dl className="divide-y divide-border text-sm">
            <DetailRow label="Business">{post.businessName}</DetailRow>
            <DetailRow label="Post type">{AI_POST_TYPE_LABEL[post.type]}</DetailRow>
            <DetailRow label={post.status === "published" ? "Published" : "Scheduled"}>
              {when ? format(new Date(when), DATE_TIME) : "Not scheduled"}
            </DetailRow>
            <DetailRow label="Publishing status"><PostStatusBadge status={post.status} /></DetailRow>
            <DetailRow label="Approval status">
              <StatusBadge tone={APPROVAL_STATUS_TONE[post.approvalStatus]}>{APPROVAL_STATUS_LABEL[post.approvalStatus]}</StatusBadge>
            </DetailRow>
            <DetailRow label="Repeats">
              {post.recurrence === "none" ? (
                "Does not repeat"
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Repeat className="size-3.5 text-muted-foreground" aria-hidden />
                  {RECURRENCE_LABEL[post.recurrence]}
                  {post.recurrenceDays.length ? ` · ${post.recurrenceDays.map((d) => WEEKDAY_SHORT[d]).join(", ")}` : ""}
                </span>
              )}
            </DetailRow>
            <DetailRow label="Topic">{post.topic || "—"}</DetailRow>
            <DetailRow label="Created">{format(new Date(post.createdAt), DATE_TIME)}</DetailRow>
          </dl>
        </Panel>
      </div>

      {actions.dialogs}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-foreground">{children}</dd>
    </div>
  );
}

function PostDetailsSkeleton() {
  return (
    <div role="status" aria-label="Loading post" className="space-y-6">
      <Skeleton className="h-4 w-40" />
      <div className="space-y-2 border-b border-border pb-4">
        <Skeleton className="h-7 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-1/3 max-w-xs" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg border border-border bg-surface p-4">
          <Skeleton className="aspect-[4/3] w-full max-w-2xl" />
          <Skeleton className="mt-4 h-3.5 w-full" />
          <Skeleton className="mt-2 h-3.5 w-4/5" />
        </div>
        <SectionSkeleton lines={7} />
      </div>
    </div>
  );
}
