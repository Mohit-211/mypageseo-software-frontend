import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/layout/shared/data-display";
import { ChartSkeleton, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import {
  aiVisibilityActions,
  percentChange,
  type AiVisibilityCompetitor,
  type AiVisibilityProfile,
  type VisibilitySummary,
} from "@/lib/ai-visibility/ai-visibility";
import { AddCompetitorModal } from "../add-competitor-modal";
import { NoAiCompetitorsEmpty } from "../empty-states";
import { CompetitorChart } from "./competitor-chart";
import { CompetitorTable, type ComparisonRow } from "./competitor-table";

export function CompetitorComparison({
  profile,
  summary,
  competitors,
}: {
  profile: AiVisibilityProfile;
  summary: VisibilitySummary;
  competitors: AiVisibilityCompetitor[];
}) {
  const [adding, setAdding] = useState({ open: false, key: 0 });
  const [removing, setRemoving] = useState<ComparisonRow | null>(null);

  const own: ComparisonRow = {
    id: "own",
    name: profile.businessName,
    website: null,
    isOwn: true,
    selected: true,
    visibility: summary.score,
    mentions: summary.mentions,
    change: summary.scoreChange,
    difference: null,
  };
  const rows: ComparisonRow[] = [
    own,
    ...competitors.map((c) => ({
      id: c.id,
      name: c.name,
      website: c.website,
      isOwn: false,
      selected: c.selected,
      visibility: c.visibility,
      mentions: c.mentions,
      change: percentChange(c.visibility, c.previousVisibility),
      difference: c.visibility - summary.score,
    })),
  ];
  const charted = rows.filter((r) => r.selected);
  const openAdd = () => setAdding((a) => ({ open: true, key: a.key + 1 }));

  return (
    <>
      <Panel
        title="AI Visibility Comparison"
        description="Visibility and mentions for your business and selected competitors"
        actions={
          competitors.length > 0 ? (
            <Button size="sm" variant="outline" onClick={openAdd}>
              <Plus aria-hidden /> Add Competitor
            </Button>
          ) : undefined
        }
      >
        {competitors.length === 0 ? (
          <NoAiCompetitorsEmpty onAdd={openAdd} />
        ) : (
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="min-w-0">
              <p className="mb-2 text-xs text-muted-foreground">
                Visibility · {charted.length - 1} of {competitors.length} competitors selected
              </p>
              <CompetitorChart rows={charted} />
            </div>
            <div className="min-w-0 overflow-hidden rounded-lg border border-border">
              <CompetitorTable
                rows={rows}
                onToggle={(id, selected) => aiVisibilityActions.setCompetitorSelected(id, selected)}
                onRemove={setRemoving}
              />
            </div>
          </div>
        )}
      </Panel>

      <AddCompetitorModal
        key={adding.key}
        open={adding.open}
        onOpenChange={(open) => setAdding((a) => ({ ...a, open }))}
        existing={competitors}
        defaultLocation={profile.city}
        onSubmit={(input) => {
          aiVisibilityActions.addCompetitor(input);
          toast.success("Competitor added", { description: `${input.name} is now included in the comparison.` });
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title="Remove competitor?"
        description={removing ? `${removing.name} will be removed from AI visibility comparison.` : ""}
        confirmLabel="Remove"
        onConfirm={() => {
          if (!removing) return;
          aiVisibilityActions.removeCompetitor(removing.id);
          toast.success("Competitor removed", { description: `${removing.name} is no longer compared.` });
          setRemoving(null);
        }}
      />
    </>
  );
}

export function CompetitorComparisonSkeleton() {
  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <ChartSkeleton />
      <TableSkeleton rows={4} columns={5} />
    </div>
  );
}
