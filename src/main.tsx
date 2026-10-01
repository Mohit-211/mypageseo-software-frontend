import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import { router } from './app/router';
import { queryClient } from './app/query-client';
import { WorkspaceProvider } from '@/lib/mypageseo/workspace';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './styles.css';

// Same provider order as the old __root.tsx RootComponent. Providers sit
// outside RouterProvider so the root error boundary can use them too.
createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<WorkspaceProvider>
				<TooltipProvider delayDuration={150}>
					<RouterProvider router={router} />
					<Toaster />
				</TooltipProvider>
			</WorkspaceProvider>
		</QueryClientProvider>
	</StrictMode>,
);
