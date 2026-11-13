import { NotFoundScreen } from "@/components/layout/shared/feedback/not-found";
import { useDocumentTitle } from "@/hooks/use-document-title";

/** `/404` inside the app shell: the shared "page not found" card with the usual ways back. */
function NotFoundRoute() {
  // No PageHeader here, so name the tab (and the shell's page-change announcement) ourselves.
  useDocumentTitle(["Page not found"]);
  return (
    <div className="py-8">
      <NotFoundScreen />
    </div>
  );
}

export default NotFoundRoute;
