import { Outlet, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { NotFoundScreen } from '@/components/layout/shared/feedback/not-found';
import { AppErrorState } from '@/components/layout/shared/feedback/failure-states';

/** Root layout. Providers live in main.tsx. */
export function AppRoot() {
	return <Outlet />;
}

/** Unknown URLs (router "*" route). Was __root.tsx notFoundComponent. */
export function RootNotFound() {
	return <NotFoundScreen standalone />;
}

/** Root error boundary. Was __root.tsx errorComponent. */
export function RootErrorBoundary() {
	const routeError = useRouteError();

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
