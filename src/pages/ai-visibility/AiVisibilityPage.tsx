import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { ComingSoon } from "@/components/layout/shared/feedback/coming-soon";

function AiVisibilityPage() {
  return (
    <AppShell>
      <PageHeader title="AI Visibility" description="How AI assistants mention and recommend your business." />
      <ComingSoon
        className="mt-6"
        title="AI Visibility is on the way"
        description="We're building a way to see whether AI assistants recommend your business when people ask about your services. It isn't available yet."
      />
    </AppShell>
  );
}

export default AiVisibilityPage;
