import { Outlet, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { NotFoundScreen } from '@/components/layout/shared/feedback/not-found';
import { AppErrorState } from '@/components/layout/shared/feedback/failure-states';
import { GbpConnectDialogHost } from '@/components/gbp-connect/gbp-connect-dialog';

/** Root layout. Providers live in main.tsx. The GBP connect modal opens from any screen. */
export function AppRoot() {
	return (
		<>
			<Outlet />
			<GbpConnectDialogHost />
		</>
	);
}

/** Shown on the first visit while the page's code downloads (pages load on demand). */
export function RootLoading() {
	return (
		<div role="status" aria-label="Loading" className="flex min-h-screen items-center justify-center bg-background">
			<span className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
		</div>
	);
}

/** Unknown URLs (router "*" route). Was __root.tsx notFoundComponent. */
export function RootNotFound() {
	return <NotFoundScreen standalone />;
}

/** Root error boundary. Was __root.tsx errorComponent. */
/** A page's code file from an older release is gone after a deploy. */
function isStaleChunkError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error ?? "");
	return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);
}

const RELOAD_KEY = "mypageseo.chunk-reload";

export function RootErrorBoundary() {
	const routeError = useRouteError();

	// After a release, reload once to pick up the new files instead of showing an error.
	if (isStaleChunkError(routeError)) {
		let reloaded: boolean;
		try {
			reloaded = sessionStorage.getItem(RELOAD_KEY) === window.location.pathname;
			if (!reloaded) sessionStorage.setItem(RELOAD_KEY, window.location.pathname);
		} catch {
			reloaded = false;
		}
		if (!reloaded) {
			window.location.reload();
			return <RootLoading />;
		}
	}

	if (isRouteErrorResponse(routeError) && routeError.status === 404) {
		return <RootNotFound />;
	}

	const error =
		routeError instanceof Error
			? routeError
			: new Error(
					isRouteErrorResponse(routeError)
						? `${routeError.status} ${routeError.statusText}`
						: String(routeError),
				);
	console.error(error);

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
			<AppErrorState
				error={error}
				// Old: router.invalidate() + reset(). No loaders yet, so a reload is the
				// equivalent full reset. Revisit once data loading moves to react-query.
				onRetry={() => window.location.reload()}
				showBack={false}
			/>
		</div>
	);
}
