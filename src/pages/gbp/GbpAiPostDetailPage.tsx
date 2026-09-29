import { AppShell } from "@/components/layout/shared/app-shell";
import { PostDetails } from "@/components/gbp-ai-posts/post-details";
import { useRequiredParams } from "@/hooks/use-required-params";

function GbpAiPostDetailPage() {
  const { postId } = useRequiredParams("postId");
  return (
    <AppShell>
      <PostDetails postId={postId} />
    </AppShell>
  );
}

export default GbpAiPostDetailPage;
