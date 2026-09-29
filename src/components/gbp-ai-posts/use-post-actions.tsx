import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { aiPostsActions, type AiGbpPost } from "@/lib/gbp/ai-posts";
import { AI_POSTS_PATH } from "./post-ui";
import { RescheduleDialog } from "./reschedule-dialog";

/**
 * Every post action in one place, so the upcoming list, calendar and detail
 * view behave identically. Render `dialogs` once wherever the hook is used.
 */
export function usePostActions(post: AiGbpPost | null, { onDeleted }: { onDeleted?: () => void } = {}) {
  const navigate = useNavigate();
  const [rescheduling, setRescheduling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const view = () => post && navigate(`${AI_POSTS_PATH}/${post.id}`);
  const edit = () => post && navigate(`${AI_POSTS_PATH}/create?edit=${post.id}`);
  const duplicate = () => {
    if (!post) return;
    const copy = aiPostsActions.duplicate(post.id);
    if (!copy) {
      toast.error("Post could not be duplicated");
      return;
    }
    toast.success("Post duplicated", {
      description: "The copy was saved as a draft.",
      action: { label: "Open", onClick: () => navigate(`${AI_POSTS_PATH}/${copy.id}`) },
    });
  };
  const approve = () => {
    if (!post) return;
    const status = aiPostsActions.approve(post.id);
    toast.success(status === "scheduled" ? "Post approved and scheduled" : "Post approved and published", {
      description:
        status === "scheduled" && post.scheduledAt
          ? `Goes live ${format(new Date(post.scheduledAt), "MMM d 'at' h:mm a")}.`
          : "Its scheduled time had passed, so it was published now.",
    });
  };
  const reject = () => {
    if (!post) return;
    aiPostsActions.reject(post.id);
    toast.success("Post rejected", { description: "It was moved back to drafts for changes." });
  };
  const retry = () => {
    if (!post) return;
    aiPostsActions.retry(post.id);
    toast.success("Post published", { description: `${post.title} is now live on Google.` });
  };

  const dialogs: ReactNode = post ? (
    <>
      <RescheduleDialog post={post} open={rescheduling} onOpenChange={setRescheduling} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this post?"
        description={
          <>
            “{post.title}” will be removed
            {post.status === "published" ? " from this dashboard. It stays live on Google until removed there" : " and won't be published"}
            . This action cannot be undone.
          </>
        }
        confirmLabel="Delete post"
        onConfirm={() => {
          aiPostsActions.remove(post.id);
          setDeleting(false);
          toast.success("Post deleted");
          onDeleted?.();
        }}
      />
    </>
  ) : null;

  return {
    view,
    edit,
    duplicate,
    approve,
    reject,
    retry,
    reschedule: () => setRescheduling(true),
    remove: () => setDeleting(true),
    dialogs,
  };
}
