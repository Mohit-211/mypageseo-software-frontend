import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
	buildSearchIndex,
	flattenGroups,
	readRecentSearchIds,
	rememberSearchId,
	searchIndex,
	searchSuggestions,
	type SearchGroup,
	type SearchResult,
} from '@/lib/mypageseo/global-search';
import { useWorkspace } from '@/lib/mypageseo/workspace';
import { cn } from '@/lib/utils';

const PLACEHOLDER = 'Search locations, keywords, reports';

/** Global search and quick navigation for the application header. */
export function GlobalSearch() {
	const navigate = useNavigate();
	const {
		organization,
		activeClient,
		setActiveClientId,
		setActiveLocationId,
	} = useWorkspace();
	const accountType =
		organization?.accountType === 'agency' ? 'agency' : 'business';

	const [query, setQuery] = useState('');
	const [desktopOpen, setDesktopOpen] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);
	// SPA: read recents synchronously (was a post-hydration effect under SSR).
	const [recentIds, setRecentIds] = useState<string[]>(readRecentSearchIds);
	const containerRef = useRef<HTMLDivElement>(null);
	const mobileInputRef = useRef<HTMLInputElement>(null);

	const entries = useMemo(
		() =>
			buildSearchIndex({
				accountType,
				activeClientId: activeClient?.id ?? null,
			}),
		[accountType, activeClient?.id],
	);

	const groups: SearchGroup[] = useMemo(
		() =>
			query.trim()
				? searchIndex(entries, query)
				: searchSuggestions(entries, recentIds),
		[entries, query, recentIds],
	);
	const flat = useMemo(() => flattenGroups(groups), [groups]);

	useEffect(() => setActiveIndex(0), [query, desktopOpen, mobileOpen]);

	// Close the desktop dropdown when focus or a click leaves the search area.
	useEffect(() => {
		if (!desktopOpen) return;
		function onPointerDown(event: MouseEvent) {
			if (!containerRef.current?.contains(event.target as Node))
				setDesktopOpen(false);
		}
		document.addEventListener('mousedown', onPointerDown);
		return () => document.removeEventListener('mousedown', onPointerDown);
	}, [desktopOpen]);

	useEffect(() => {
		if (mobileOpen) mobileInputRef.current?.focus();
	}, [mobileOpen]);

	function close() {
		setDesktopOpen(false);
		setMobileOpen(false);
	}

	function select(result: SearchResult) {
		setRecentIds(rememberSearchId(result.id));
		if (result.locationId) setActiveLocationId(result.locationId);
		close();
		setQuery('');

		const target = result.target;
		switch (target.kind) {
			case 'location':
				void navigate(`/locations/${target.locationId}`);
				return;
			case 'keywords':
				void navigate(
					`/locations/${target.locationId}/rankings/keywords`,
				);
				return;
			case 'competitor':
				void navigate(
					`/locations/${target.locationId}/competitors/${target.competitorId}`,
				);
				return;
			case 'citation':
				void navigate(
					`/locations/${target.locationId}/citations/${target.citationId}`,
				);
				return;
			case 'report':
				void navigate(`/reports/${target.reportId}`);
				return;
			case 'client':
				setActiveClientId(target.clientId);
				void navigate(`/clients/${target.clientId}`);
				return;
			case 'page':
				void navigate(target.to);
		}
	}

	function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
			return;
		}
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			if (!flat.length) return;
			const step = event.key === 'ArrowDown' ? 1 : -1;
			setActiveIndex(
				(current) => (current + step + flat.length) % flat.length,
			);
			return;
		}
		if (event.key === 'Enter') {
			const result = flat[activeIndex];
			if (result) {
				event.preventDefault();
				select(result);
			}
		}
	}

	const panel = (
		<ResultsPanel
			groups={groups}
			flat={flat}
			activeIndex={activeIndex}
			query={query}
			onHover={setActiveIndex}
			onSelect={select}
		/>
	);

	return (
		<>
			{/* Desktop: field with an anchored dropdown. */}
			<div ref={containerRef} className="relative hidden md:block">
				<Search
					className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden
				/>
				<input
					type="text"
					role="combobox"
					aria-expanded={desktopOpen}
					aria-controls="global-search-results"
					aria-autocomplete="list"
					{...(desktopOpen && flat.length
						? {
								'aria-activedescendant': `global-search-option-${activeIndex}`,
							}
						: {})}
					aria-label="Search"
					autoComplete="off"
					placeholder={PLACEHOLDER}
					value={query}
					onFocus={() => setDesktopOpen(true)}
					onChange={(event) => {
						setQuery(event.target.value);
						setDesktopOpen(true);
					}}
					onKeyDown={onKeyDown}
					className="h-9 w-56 rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40 xl:w-72"
				/>
				{desktopOpen ? (
					<div className="absolute right-0 top-11 z-50 w-[28rem] overflow-hidden rounded-md border border-border bg-surface shadow-lg xl:w-[32rem]">
						{panel}
						<SearchFooter />
					</div>
				) : null}
			</div>

			{/* Mobile: near full-screen search. */}
			<Button
				variant="ghost"
				size="icon"
				className="md:hidden"
				aria-label="Search"
				onClick={() => setMobileOpen(true)}
			>
				<Search className="size-4.5" />
			</Button>

			{mobileOpen ? (
				<div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden">
					<div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
						<Search
							className="size-4 shrink-0 text-muted-foreground"
							aria-hidden
						/>
						<input
							ref={mobileInputRef}
							type="text"
							aria-label="Search"
							autoComplete="off"
							placeholder={PLACEHOLDER}
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							onKeyDown={onKeyDown}
							className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
						/>
						<Button
							variant="ghost"
							size="icon"
							aria-label="Close search"
							onClick={close}
						>
							<X className="size-4.5" />
						</Button>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto">
						{panel}
					</div>
				</div>
			) : null}
		</>
	);
}

function SearchFooter() {
	return (
		<div className="flex items-center gap-3 border-t border-border bg-surface-strong px-3 py-1.5 text-[11px] text-muted-foreground">
			<span>↑↓ to move</span>
			<span>Enter to open</span>
			<span>Esc to close</span>
		</div>
	);
}

function ResultsPanel({
	groups,
	flat,
	activeIndex,
	query,
	onHover,
	onSelect,
}: {
	groups: SearchGroup[];
	flat: SearchResult[];
	activeIndex: number;
	query: string;
	onHover: (index: number) => void;
	onSelect: (result: SearchResult) => void;
}) {
	if (!groups.length) {
		return (
			<div className="px-3 py-6 text-sm">
				<p className="font-medium text-foreground">
					{query.trim()
						? `No matches for “${query.trim()}”`
						: 'Nothing to suggest yet'}
				</p>
				<p className="mt-1 text-muted-foreground">
					{query.trim()
						? 'Search by location, city, keyword, competitor, directory, report or section name.'
						: 'Locations, keywords, reports and sections appear here once they exist in this workspace.'}
				</p>
			</div>
		);
	}

	let cursor = -1;
	return (
		<ul
			id="global-search-results"
			role="listbox"
			className="max-h-[70vh] overflow-y-auto py-1 md:max-h-[26rem]"
		>
			{groups.map((group, groupIndex) => (
				<li
					key={`${group.id}-${group.label}-${groupIndex}`}
					role="presentation"
				>
					<p
						id={`global-search-group-${groupIndex}`}
						className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
					>
						{group.label}
					</p>
					<ul
						role="group"
						aria-labelledby={`global-search-group-${groupIndex}`}
					>
						{group.results.map((result) => {
							cursor += 1;
							const index = cursor;
							const active = index === activeIndex;
							return (
								<li key={result.id} role="presentation">
									<button
										type="button"
										id={`global-search-option-${index}`}
										role="option"
										aria-selected={active}
										onMouseEnter={() => onHover(index)}
										onClick={() => onSelect(result)}
										className={cn(
											'flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm',
											active
												? 'bg-secondary'
												: 'hover:bg-secondary/60',
										)}
									>
										<span className="min-w-0 flex-1 truncate font-medium text-foreground">
											{result.title}
										</span>
										{result.context ? (
											<span className="hidden max-w-[45%] shrink-0 truncate text-xs text-muted-foreground sm:inline">
												{result.context}
											</span>
										) : null}
										{result.meta ? (
											<span className="shrink-0 text-xs capitalize text-muted-foreground">
												{result.meta}
											</span>
										) : null}
									</button>
								</li>
							);
						})}
					</ul>
				</li>
			))}
		</ul>
	);
}
