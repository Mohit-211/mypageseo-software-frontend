import { useEffect } from 'react';
import { Outlet, ScrollRestoration, useRouteError } from 'react-router-dom';
import { NotFoundScreen } from '@/components/layout/shared/feedback/not-found';
import { AppErrorState } from '@/components/layout/shared/feedback/failure-states';
import { GbpConnectDialogHost } from '@/components/gbp-connect/gbp-connect-dialog';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { scrollRestorationKey } from '@/lib/url-state';
import { HashScroll } from './hash-scroll';
import { NavigationProgress } from './navigation-progress';
import { useOrganizationFromLink } from './organization-link';
import { canReloadForStaleChunk, isNotFoundResponse, reloadForStaleChunk, toRouteError } from './route-errors';

/**
 * Root layout. Providers live in main.tsx. The GBP connect modal opens from any screen.
 *
 * Scroll positions are remembered per history entry (`scrollRestorationKey`): a link to a page,
 * from the sidebar or anywhere else, opens it at the top (or at its `#section`, which HashScroll
 * keeps in view while the page loads), and only Back and Forward put the reader back where they
 * were. A filter, sort or page change (`useSearchUpdater`) stays on its entry, so it never moves
 * the page: not to an old position, and not to the `#section` still in the address.
 *
 * A link's `?organization=` (emails, PayPal's return) switches the tab to that organization before
 * the page opens: until that is decided the loading screen shows instead (./organization-link.ts).
 */
export function AppRoot() {
	const waitingForOrganization = useOrganizationFromLink();
	return (
		<>
			<NavigationProgress />
			{waitingForOrganization ? <RootLoading /> : <Outlet />}
			<GbpConnectDialogHost />
			<ScrollRestoration getKey={scrollRestorationKey} />
			<HashScroll />
		</>
	);
}

/** Shown on the very first load while the page's code downloads (pages load on demand). */
export function RootLoading() {
	return (
		<div role="status" aria-label="Loading" className="flex min-h-screen items-center justify-center bg-background">
			<span className="size-8 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none" />
		</div>
	);
}

/**
 * The component of a route whose loader always redirects (`loader: () => replace(...)`, see
 * route-loaders.ts): it is never rendered, since the redirect happens before anything commits.
 * React Router expects a component on a leaf route, and this says so explicitly.
 */
export function Redirecting() {
	return null;
}

/** Unknown URLs (router "*" route). */
export function RootNotFound() {
	useDocumentTitle(['Page not found']);
	return <NotFoundScreen standalone />;
}

/**
 * Last-resort boundary for errors outside the signed-in shell (sign-in pages, the shell itself).
 * Page errors inside the app are caught by `PageErrorBoundary`, which keeps the shell on screen.
 */
export function RootErrorBoundary() {
	const routeError = useRouteError();
	const reload = canReloadForStaleChunk(routeError);
	const notFound = isNotFoundResponse(routeError);
	useDocumentTitle([reload ? null : notFound ? 'Page not found' : 'Something went wrong']);

	useEffect(() => {
		if (reload) reloadForStaleChunk();
		else console.error(routeError);
	}, [reload, routeError]);

	if (reload) return <RootLoading />;
	if (notFound) return <RootNotFound />;

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
			<AppErrorState
				error={toRouteError(routeError)}
				// Outside the shell nothing else is on screen, so a full reload is the reset.
				onRetry={() => window.location.reload()}
				showBack={false}
			/>
		</div>
	);
}
