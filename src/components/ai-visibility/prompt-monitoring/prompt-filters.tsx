import { TableToolbar } from "@/components/layout/shared/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AI_PLATFORMS, AI_PLATFORM_LABEL, TOPICS, TOPIC_LABEL, type PlatformFilter, type TopicId } from "@/lib/ai-visibility/ai-visibility";
import {
  CHECKED_LABEL,
  MENTION_LABEL,
  POSITION_LABEL,
  VISIBILITY_LABEL,
  activeFilterChips,
  type PromptFilterState,
} from "./prompt-filter-model";

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger className="h-9 w-full bg-surface text-sm sm:w-auto sm:min-w-36" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(options) as T[]).map((key) => (
          <SelectItem key={key} value={key}>
            {options[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const PLATFORM_OPTIONS = {
  all: "All platforms",
  ...Object.fromEntries(AI_PLATFORMS.map((p) => [p, AI_PLATFORM_LABEL[p]])),
} as Record<PlatformFilter, string>;

const TOPIC_OPTIONS = {
  all: "All topics",
  ...Object.fromEntries(TOPICS.map((t) => [t, TOPIC_LABEL[t]])),
} as Record<TopicId | "all", string>;

export function PromptFilters({
  filters,
  onChange,
  onReset,
}: {
  filters: PromptFilterState;
  onChange: (filters: PromptFilterState) => void;
  onReset: () => void;
}) {
  const set = <K extends keyof PromptFilterState>(key: K, value: PromptFilterState[K]) => onChange({ ...filters, [key]: value });
  const active = activeFilterChips(filters).length > 0 || filters.search.trim() !== "";

  return (
    <TableToolbar
      search={filters.search}
      onSearchChange={(v) => set("search", v)}
      searchPlaceholder="Search prompts"
      className="lg:flex-col lg:items-stretch"
      filtersActive={active}
      onReset={onReset}
    >
      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
        <FilterSelect label="Platform" value={filters.platform} options={PLATFORM_OPTIONS} onChange={(v) => set("platform", v)} />
        <FilterSelect label="Topic" value={filters.topic} options={TOPIC_OPTIONS} onChange={(v) => set("topic", v)} />
        <FilterSelect label="Business mentioned" value={filters.mention} options={MENTION_LABEL} onChange={(v) => set("mention", v)} />
        <FilterSelect label="Position" value={filters.position} options={POSITION_LABEL} onChange={(v) => set("position", v)} />
        <FilterSelect label="Visibility" value={filters.visibility} options={VISIBILITY_LABEL} onChange={(v) => set("visibility", v)} />
        <FilterSelect label="Last checked" value={filters.checked} options={CHECKED_LABEL} onChange={(v) => set("checked", v)} />
      </div>
    </TableToolbar>
  );
}
