
import { AppShell } from "@/components/layout/shared/app-shell";
import { NotFoundScreen } from "@/components/layout/shared/feedback/not-found";



function NotFoundRoute() {
  return (
    <AppShell>
      <div className="py-6">
        <NotFoundScreen />
      </div>
    </AppShell>
  );
}

export default NotFoundRoute;
