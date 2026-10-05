import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, isValid, parseISO } from "date-fns";
import { toast } from "sonner";
import { Eye, FileText, Loader2, Send } from "lucide-react";
import { PageHeader, Panel } from "@/components/layout/shared/data-display";
import { EmptyState, SectionSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { aiPostsActions, type AiGbpPost } from "@/lib/gbp/ai-posts";
import type { LocationSummary } from "@/lib/mypageseo/workspace";
import { AI_POSTS_PATH, BackToPostsLink } from "../post-ui";
import { useWorkspaceAiPosts } from "../use-workspace-ai-posts";
import { AIContentGenerator } from "./ai-content-generator";
import { AIImageGenerator } from "./ai-image-generator";
import { ApprovalSettings } from "./approval-settings";
import {
  emptyCreatePostForm,
  FORM_TOAST,
  formFromPost,
  scheduledDate,
  toPostInput,
  validateForDraft,
  validateForPublish,
  type CreatePostErrors,
  type CreatePostForm as CreatePostFormValues,
} from "./form-model";
import { PostBasicInfo } from "./post-basic-info";
import { PostPreview } from "./post-preview";
import { ScheduleSettings } from "./schedule-settings";

/** Create (or edit, with `?edit=<id>`) an AI GBP post. */
export function CreatePost() {
  const [params] = useSearchParams();
  const { status, allPosts, locations, activeLocation } = useWorkspaceAiPosts();
  const editId = params.get("edit");
  const editing = editId ? (allPosts.find((p) => p.id === editId) ?? null) : null;

  const header = (
    <>
      <div className="mb-4">
        <BackToPostsLink />
      </div>
      <PageHeader
        title={editId ? "Edit AI GBP Post" : "Create AI GBP Post"}
        description="Generate the copy and image with AI, preview it as it appears on Google, then schedule it."
      />
    </>
  );

  if (status === "loading") {
    return (
      <div className="space-y-6">
        {header}
        <div role="status" aria-label="Loading" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <SectionSkeleton lines={4} />
            <SectionSkeleton lines={5} />
          </div>
          <SectionSkeleton lines={8} />
        </div>
      </div>
    );
  }

  if (editId && !editing) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          title="Post not found"
          description="This post may have been deleted. Go back to your posts to pick another one."
          action={<BackToPostsLink />}
        />
      </div>
    );
  }

  const dateParam = params.get("date");
  const presetDate = dateParam ? parseISO(dateParam) : null;
  const presetProfile = params.get("profile");
  const defaultLocation =
    locations.find((l) => l.id === presetProfile) ??
    locations.find((l) => l.id === activeLocation?.id) ??
    (locations.length === 1 ? locations[0] : undefined);

  const initial = editing
    ? formFromPost(editing)
    : emptyCreatePostForm({
        locationId: defaultLocation?.id ?? "",
        date: presetDate && isValid(presetDate) ? presetDate : null,
      });

  return (
    <div className="space-y-6">
      {header}
      <CreatePostForm key={editId ?? "new"} initial={initial} editing={editing} locations={locations} />
    </div>
  );
}

function CreatePostForm({
  initial,
  editing,
  locations,
}: {
  initial: CreatePostFormValues;
  editing: AiGbpPost | null;
  locations: LocationSummary[];
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<CreatePostErrors>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);

  const location = locations.find((l) => l.id === form.locationId) ?? null;
  const when = form.publishMode === "now" ? null : scheduledDate(form);
  const dateLabel = when ? format(when, "MMM d, yyyy") : "Just now";

  const onChange = (patch: Partial<CreatePostFormValues>) => {
    setForm((current) => ({ ...current, ...patch }));
    // Clear errors for the fields being edited.
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as keyof CreatePostErrors];
      if ("time" in patch) delete next.date;
      if ("publishMode" in patch) delete next.date;
      return next;
    });
  };

  const save = (intent: "draft" | "submit") => {
    const found = intent === "draft" ? validateForDraft(form) : validateForPublish(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error(intent === "draft" ? "Draft couldn't be saved" : "Check the highlighted fields", {
        ...FORM_TOAST,
        description: Object.values(found)[0],
      });
      return;
    }
    setSaving(intent);
    // Simulated save latency so the pending state is visible.
    window.setTimeout(() => {
      const input = toPostInput(form, location?.businessName ?? "", intent);
      let id = editing?.id;
      if (editing) aiPostsActions.update(editing.id, input);
      else id = aiPostsActions.create(input).id;
      setSaving(null);

      const title =
        input.status === "draft"
          ? "Draft saved"
          : input.status === "pending_approval"
            ? "Sent for approval"
            : input.status === "published"
              ? "Post published"
              : "Post scheduled";
      const description =
        input.status === "scheduled" && when
          ? `Goes live ${format(when, "EEE, MMM d 'at' h:mm a")}.`
          : input.status === "pending_approval"
            ? "It will publish once it's approved."
            : input.status === "published"
              ? `Live on ${location?.businessName ?? "Google"}.`
              : undefined;
      toast.success(title, { description });
      navigate(editing ? `${AI_POSTS_PATH}/${id}` : AI_POSTS_PATH);
    }, 500);
  };

  const openPreview = () => {
    if (!form.content.trim()) {
      toast.error("Nothing to preview yet", { ...FORM_TOAST, description: "Generate the post text with AI or write it first." });
      setErrors((e) => ({ ...e, content: "Generate the post text with AI or write it yourself." }));
      return;
    }
    setPreviewOpen(true);
  };

  const submitLabel = form.requireApproval ? "Submit for Approval" : form.publishMode === "now" ? "Publish Now" : "Schedule Post";

  const preview = (
    <PostPreview
      businessName={location?.businessName ?? null}
      title={form.title}
      content={form.content}
      imageUrl={form.imageUrl}
      cta={form.cta}
      type={form.type}
      dateLabel={dateLabel}
    />
  );

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <PostBasicInfo form={form} onChange={onChange} errors={errors} locations={locations} />
          <AIContentGenerator form={form} onChange={onChange} errors={errors} location={location} />
          <AIImageGenerator form={form} onChange={onChange} />
          <ScheduleSettings form={form} onChange={onChange} errors={errors} />
          <ApprovalSettings value={form.requireApproval} onChange={(requireApproval) => onChange({ requireApproval })} />
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-20 space-y-3">
            <Panel title="Live preview" description="How your post appears on Google">
              {preview}
            </Panel>
            <p className="px-1 text-xs text-muted-foreground">
              Final appearance may vary slightly across Google Search and Maps.
            </p>
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 -mb-5 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 md:-mx-6 md:-mb-6 md:px-6">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)} disabled={saving !== null}>
            Cancel
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => save("draft")} disabled={saving !== null}>
              {saving === "draft" ? <Loader2 className="animate-spin" aria-hidden /> : <FileText aria-hidden />}
              Save Draft
            </Button>
            <Button variant="outline" onClick={openPreview} disabled={saving !== null}>
              <Eye aria-hidden /> Generate Preview
            </Button>
            <Button onClick={() => save("submit")} disabled={saving !== null}>
              {saving === "submit" ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Post preview</DialogTitle>
            <DialogDescription>
              {location ? `${location.businessName} · ` : ""}
              {form.publishMode === "now"
                ? "Publishing now"
                : when
                  ? `Scheduled ${format(when, "EEE, MMM d 'at' h:mm a")}`
                  : "Not scheduled yet"}
            </DialogDescription>
          </DialogHeader>
          {preview}
        </DialogContent>
      </Dialog>
    </>
  );
}
