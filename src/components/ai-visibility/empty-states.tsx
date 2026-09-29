import { MessageSquareText, Plus, Users } from "lucide-react";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";

export function NoPromptsEmpty({ onAdd, className }: { onAdd: () => void; className?: string }) {
  return (
    <EmptyState
      icon={MessageSquareText}
      title="Start tracking your AI visibility"
      description="Add prompts to see how AI assistants mention your business."
      action={
        <Button onClick={onAdd}>
          <Plus aria-hidden /> Add Your First Prompt
        </Button>
      }
      {...(className === undefined ? {} : { className })}
    />
  );
}

export function NoAiCompetitorsEmpty({ onAdd, className }: { onAdd: () => void; className?: string }) {
  return (
    <EmptyState
      compact
      icon={Users}
      title="No competitors yet"
      description="Add competitors to compare AI visibility."
      action={
        <Button size="sm" onClick={onAdd}>
          <Plus aria-hidden /> Add Competitor
        </Button>
      }
      {...(className === undefined ? {} : { className })}
    />
  );
}
