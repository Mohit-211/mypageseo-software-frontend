
import { AppShell } from "@/components/mypageseo/app-shell";
import { NotFoundScreen } from "@/components/mypageseo/not-found";



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
