import { useEffect } from "react";
import { useLocation, useNavigate, useRouteError } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AppErrorState } from "@/components/layout/shared/feedback/failure-states";
import { NotFoundScreen } from "@/components/layout/shared/feedback/not-found";
import { PageSkeleton } from "@/components/layout/shared/feedback/states";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { isHistoryState, keepScrollEntry } from "@/lib/url-state";
import { canReloadForStaleChunk, isNotFoundResponse, isStaleChunkError, reloadForStaleChunk, toRouteError } from "./route-errors";

/**
 * Error boundary for every signed-in page. It sits inside the app shell (on a pathless route
 * under the shell layout), so a page that crashes or whose code can't load keeps the sidebar
 * and header on screen and the rest of the app one click away.
 */
export function PageErrorBoundary() {
  const routeError = useRouteError();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const reload = canReloadForStaleChunk(routeError);
  const notFound = isNotFoundResponse(routeError);
  useDocumentTitle([reload ? null : notFound ? "Page not found" : "Something went wrong"]);

  useEffect(() => {
    if (reload) reloadForStaleChunk();
    else console.error(routeError);
  }, [reload, routeError]);

  useEffect(() => {
    // A page that throws while rendering never subscribes to its data, so an answer that made it
    // crash would stay cached (and crash it again) until it expires. The crashed page's queries
    // have no observers left; the shell's are still observed and stay.
    if (!reload && !notFound) queryClient.removeQueries({ type: "inactive" });
  }, [reload, notFound, routeError, queryClient]);

  if (reload) return <PageSkeleton />;
  if (notFound) return <NotFoundScreen />;

  return (
    <AppErrorState
      error={toRouteError(routeError)}
      className="mt-6"
      // A missing page file stays missing until the tab reloads. Anything else is tried again in
      // place: opening the same address again (a new location) resets this boundary and renders the
      // page, which loads its data afresh. Revalidating can't: no loader runs, so the boundary
      // never sees a change.
      onRetry={() => {
        if (isStaleChunkError(routeError)) {
          window.location.reload();
          return;
        }
        void navigate(
          { pathname: location.pathname, search: location.search, hash: location.hash },
          { replace: true, preventScrollReset: true, state: keepScrollEntry(location, isHistoryState(location.state) ? location.state : undefined) },
        );
      }}
    />
  );
}
