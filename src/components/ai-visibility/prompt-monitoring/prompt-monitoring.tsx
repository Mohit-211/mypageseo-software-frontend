import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/layout/shared/data-display";
import { ActiveFilterChips, TableCard, TablePagination, type SortOrder } from "@/components/layout/shared/data-table";
import { NoResultsEmpty } from "@/components/layout/shared/feedback/empty-states";
import { FilterBarSkeleton, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import {
  AI_PLATFORM_LABEL,
  aiVisibilityActions,
  type AiPlatform,
  type AiVisibilityDataset,
  type PromptInput,
  type TrackedPrompt,
} from "@/lib/ai-visibility/ai-visibility";
import { AddPromptModal } from "../add-prompt-modal";
import { NoPromptsEmpty } from "../empty-states";
import { PromptDetail } from "./prompt-detail";
import { activeFilterChips, matchesPromptFilters, DEFAULT_PROMPT_FILTERS, type PromptFilterState } from "./prompt-filter-model";
import { PromptFilters } from "./prompt-filters";
import { PromptTable, type PromptRow, type PromptRowHandlers, type PromptSortKey } from "./prompt-table";

const PAGE_SIZE = 10;

function sortValue(row: PromptRow, key: PromptSortKey): number {
  switch (key) {
    case "visibility":
      return row.check.visibility ?? -1;
    // Unmentioned results sort after every numbered position.
    case "position":
      return row.check.position ?? Number.MAX_SAFE_INTEGER;
    case "checkedAt":
      return row.check.checkedAt ? new Date(row.check.checkedAt).getTime() : 0;
  }
}

export function PromptMonitoring({
  dataset,
  businessName,
  filters,
  onFiltersChange,
}: {
  dataset: AiVisibilityDataset;
  businessName: string;
  filters: PromptFilterState;
  onFiltersChange: (filters: PromptFilterState) => void;
}) {
  const [sort, setSort] = useState<PromptSortKey | null>("checkedAt");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; prompt: TrackedPrompt | null; key: number }>({ open: false, prompt: null, key: 0 });
  const [deleting, setDeleting] = useState<TrackedPrompt | null>(null);

  const promptsById = useMemo(() => new Map(dataset.prompts.map((p) => [p.id, p])), [dataset.prompts]);

  const rows = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const matched: PromptRow[] = [];
    for (const check of dataset.checks) {
      const prompt = promptsById.get(check.promptId);
      if (!prompt) continue;
      if (query && !prompt.prompt.toLowerCase().includes(query)) continue;
      if (!matchesPromptFilters(check, prompt.topic, filters)) continue;
      matched.push({ check, prompt });
    }
    if (sort) {
      const dir = order === "asc" ? 1 : -1;
      matched.sort((a, b) => (sortValue(a, sort) - sortValue(b, sort)) * dir || a.prompt.prompt.localeCompare(b.prompt.prompt));
    }
    return matched;
  }, [dataset.checks, promptsById, filters, sort, order]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const detailCheck = detailId ? dataset.checks.find((c) => c.id === detailId) ?? null : null;
  const detailPrompt = detailCheck ? promptsById.get(detailCheck.promptId) ?? null : null;
  const detailSiblings = detailCheck ? dataset.checks.filter((c) => c.promptId === detailCheck.promptId) : [];

  const openEditor = (prompt: TrackedPrompt | null) => setEditor((e) => ({ open: true, prompt, key: e.key + 1 }));

  const rerun = async (promptId: string, platform?: AiPlatform) => {
    const prompt = promptsById.get(promptId);
    const where = platform ? AI_PLATFORM_LABEL[platform] : "all platforms";
    const done = aiVisibilityActions.rerunPrompt(promptId, platform);
    toast.info("Prompt re-run started", { description: `Checking “${prompt?.prompt}” on ${where}.` });
    await done;
    toast.success("Prompt checked", { description: `Latest results for ${where} are ready.` });
  };

  const handlers: PromptRowHandlers = {
    onView: (row) => setDetailId(row.check.id),
    onRerun: (row) => void rerun(row.prompt.id, row.check.platform),
    onEdit: (row) => openEditor(row.prompt),
    onDelete: (row) => setDeleting(row.prompt),
  };

  const submitPrompt = (input: PromptInput) => {
    if (editor.prompt) {
      aiVisibilityActions.updatePrompt(editor.prompt.id, input);
      toast.success("Prompt updated", { description: "Your changes were saved." });
    } else {
      aiVisibilityActions.addPrompt(input);
      toast.success("Prompt added", {
        description: `Checking it on ${input.platforms.length} platform${input.platforms.length === 1 ? "" : "s"} now.`,
      });
    }
  };

  const changeFilters = (next: PromptFilterState) => {
    onFiltersChange(next);
    setPage(1);
  };

  const hasPrompts = dataset.prompts.length > 0;

  return (
    <section id="tracked-ai-prompts" aria-label="Tracked AI Prompts"className="scroll-mt-20">
      <SectionHeader
        title="Tracked AI Prompts"
        description="See how AI assistants respond to questions related to your business."
        {...(hasPrompts
          ? {
              actions: (
                <Button size="sm" onClick={() => openEditor(null)}>
                  <Plus aria-hidden /> Add Prompt
                </Button>
              ),
            }
          : {})}
      />

      {!hasPrompts ? (
        <NoPromptsEmpty onAdd={() => openEditor(null)} />
      ) : (
        <TableCard>
          <PromptFilters filters={filters} onChange={changeFilters} onReset={() => changeFilters(DEFAULT_PROMPT_FILTERS)} />
          <ActiveFilterChips filters={activeFilterChips(filters)} />
          {rows.length === 0 ? (
            <div className="p-4">
              <NoResultsEmpty label="prompts" onClear={() => changeFilters(DEFAULT_PROMPT_FILTERS)} />
            </div>
          ) : (
            <>
              <PromptTable
                rows={visible}
                sort={sort}
                order={order}
                onSort={(key) => {
                  if (sort === key) setOrder((o) => (o === "asc" ? "desc" : "asc"));
                  else {
                    setSort(key);
                    setOrder(key === "position" ? "asc" : "desc");
                  }
                }}
                handlers={handlers}
              />
              <TablePagination
                page={safePage}
                pageCount={pageCount}
                totalItems={rows.length}
                pageSize={PAGE_SIZE}
                itemLabel="results"
                onPageChange={setPage}
              />
            </>
          )}
        </TableCard>
      )}

      <PromptDetail
        prompt={detailPrompt}
        check={detailCheck}
        siblings={detailSiblings}
        businessName={businessName}
        onSelectPlatform={(platform) => detailCheck && setDetailId(`${detailCheck.promptId}_${platform}`)}
        onRunAgain={() => detailCheck && void rerun(detailCheck.promptId, detailCheck.platform)}
        onClose={() => setDetailId(null)}
      />

      <AddPromptModal
        key={editor.key}
        open={editor.open}
        onOpenChange={(open) => setEditor((e) => ({ ...e, open }))}
        prompt={editor.prompt}
        existingPrompts={dataset.prompts}
        onSubmit={submitPrompt}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete prompt?"
        description={
          deleting
            ? `“${deleting.prompt}” will stop being tracked on all ${deleting.platforms.length} platforms and its results will be removed. This can't be undone.`
            : ""
        }
        confirmLabel="Delete Prompt"
        onConfirm={() => {
          if (!deleting) return;
          if (detailPrompt?.id === deleting.id) setDetailId(null);
          aiVisibilityActions.deletePrompt(deleting.id);
          toast.success("Prompt deleted", { description: `“${deleting.prompt}” is no longer tracked.` });
          setDeleting(null);
        }}
      />
    </section>
  );
}

export function PromptMonitoringSkeleton() {
  return (
    <div className="space-y-3">
      <FilterBarSkeleton fields={4} />
      <TableSkeleton rows={6} columns={7} />
    </div>
  );
}
