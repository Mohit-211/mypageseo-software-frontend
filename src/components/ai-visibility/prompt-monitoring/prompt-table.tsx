import { format } from "date-fns";
import { Eye, Loader2, Pencil, RotateCw, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/layout/shared/data-display";
import {
  MobileField,
  MobileListRow,
  RowActions,
  SortableTh,
  TableBody,
  TableHead,
  TableRow,
  TableScroll,
  Th,
  tdClass,
  tdMutedClass,
  type SortOrder,
} from "@/components/layout/shared/data-table";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  CHECK_STATUS_LABEL,
  CHECK_STATUS_TONE,
  TOPIC_LABEL,
  type PromptCheck,
  type TrackedPrompt,
} from "@/lib/ai-visibility/ai-visibility";
import { PlatformLabel } from "../visibility-ui";

export type PromptRow = { check: PromptCheck; prompt: TrackedPrompt };

export type PromptSortKey = "visibility" | "position" | "checkedAt";

export type PromptRowHandlers = {
  onView: (row: PromptRow) => void;
  onRerun: (row: PromptRow) => void;
  onEdit: (row: PromptRow) => void;
  onDelete: (row: PromptRow) => void;
};

function MentionedCell({ check }: { check: PromptCheck }) {
  if (check.mentioned === null) return <span className="text-muted-foreground">—</span>;
  return check.mentioned ? <StatusBadge tone="success">Yes</StatusBadge> : <StatusBadge>No</StatusBadge>;
}

function StatusCell({ check }: { check: PromptCheck }) {
  return (
    <StatusBadge tone={CHECK_STATUS_TONE[check.status]}>
      {check.status === "checking" ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
      {CHECK_STATUS_LABEL[check.status]}
    </StatusBadge>
  );
}

const lastChecked = (check: PromptCheck) => (check.checkedAt ? format(new Date(check.checkedAt), "MMM d") : "Pending");
const position = (check: PromptCheck) => (check.position ? `#${check.position}` : "—");
const visibility = (check: PromptCheck) => (check.visibility === null ? "—" : `${check.visibility}%`);

function RowMenu({ row, handlers }: { row: PromptRow; handlers: PromptRowHandlers }) {
  const busy = row.check.status === "checking";
  return (
    <RowActions label={`Actions for “${row.prompt.prompt}”`}>
      <DropdownMenuItem disabled={!row.check.response} onSelect={() => handlers.onView(row)}>
        <Eye aria-hidden /> View Result
      </DropdownMenuItem>
      <DropdownMenuItem disabled={busy} onSelect={() => handlers.onRerun(row)}>
        <RotateCw aria-hidden /> Re-run Prompt
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => handlers.onEdit(row)}>
        <Pencil aria-hidden /> Edit Prompt
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="text-critical focus:text-critical" onSelect={() => handlers.onDelete(row)}>
        <Trash2 aria-hidden /> Delete Prompt
      </DropdownMenuItem>
    </RowActions>
  );
}

export function PromptTable({
  rows,
  sort,
  order,
  onSort,
  handlers,
}: {
  rows: PromptRow[];
  sort: PromptSortKey | null;
  order: SortOrder;
  onSort: (key: PromptSortKey) => void;
  handlers: PromptRowHandlers;
}) {
  return (
    <>
      {/* Tablet and desktop: full table, horizontally scrollable when narrow. */}
      <div className="hidden md:block">
        <TableScroll minWidth={960} label="Tracked AI prompts">
          <TableHead>
            <Th>Prompt</Th>
            <Th>AI Platform</Th>
            <Th>Business Mentioned</Th>
            <SortableTh label="Position" value="position" active={sort} order={order} onSort={onSort} />
            <SortableTh label="Visibility" value="visibility" active={sort} order={order} onSort={onSort} />
            <SortableTh label="Last Checked" value="checkedAt" active={sort} order={order} onSort={onSort} />
            <Th>Status</Th>
            <Th srOnly align="right">
              Action
            </Th>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.check.id}>
                <td className={`${tdClass} max-w-80`}>
                  <button
                    type="button"
                    className="block max-w-full truncate text-left font-medium text-foreground hover:text-primary hover:underline disabled:pointer-events-none"
                    disabled={!row.check.response}
                    onClick={() => handlers.onView(row)}
                    title={row.prompt.prompt}
                  >
                    {row.prompt.prompt}
                  </button>
                  <p className="mt-0.5 text-xs text-muted-foreground">{TOPIC_LABEL[row.prompt.topic]}</p>
                </td>
                <td className={tdClass}>
                  <PlatformLabel platform={row.check.platform} />
                </td>
                <td className={tdClass}>
                  <MentionedCell check={row.check} />
                </td>
                <td className={`${tdClass} tabular`}>{position(row.check)}</td>
                <td className={`${tdClass} tabular`}>{visibility(row.check)}</td>
                <td className={`${tdMutedClass} whitespace-nowrap`}>{lastChecked(row.check)}</td>
                <td className={tdClass}>
                  <StatusCell check={row.check} />
                </td>
                <td className={`${tdClass} text-right`}>
                  <RowMenu row={row} handlers={handlers} />
                </td>
              </TableRow>
            ))}
          </TableBody>
        </TableScroll>
      </div>

      {/* Mobile: structured cards instead of a cramped table. */}
      <ul className="divide-y divide-border md:hidden" aria-label="Tracked AI prompts">
        {rows.map((row) => (
          <li key={row.check.id}>
            <MobileListRow>
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="min-w-0 text-left text-sm font-medium text-foreground disabled:pointer-events-none"
                  disabled={!row.check.response}
                  onClick={() => handlers.onView(row)}
                >
                  {row.prompt.prompt}
                </button>
                <RowMenu row={row} handlers={handlers} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <PlatformLabel platform={row.check.platform} />
                <StatusCell check={row.check} />
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                <MobileField label="Mentioned" value={row.check.mentioned === null ? "—" : row.check.mentioned ? "Yes" : "No"} />
                <MobileField label="Position" value={position(row.check)} />
                <MobileField label="Visibility" value={visibility(row.check)} />
                <MobileField label="Checked" value={lastChecked(row.check)} />
              </div>
            </MobileListRow>
          </li>
        ))}
      </ul>
    </>
  );
}
