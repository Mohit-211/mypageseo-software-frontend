import { useState } from "react";
import { AlertTriangle, ExternalLink, History, Library, ShieldCheck } from "lucide-react";
import type { CitationStatus } from "@/api";
import { CITATION_STATUS_LABEL, CITATION_STATUS_ORDER, CITATION_STATUS_SHORT, CITATION_STATUS_TONE } from "@/lib/citations/citations";
import { EXPLAIN } from "../copy";
import { formatDate, formatRate } from "../format";
import type { CitationData } from "../types";
import { Card, Explain, Pill, ScoreRing } from "../ui";

type Tone = "good" | "warn" | "bad" | "neutral" | "brand";
const TONE: Record<string, Tone> = { success: "good", warning: "warn", critical: "bad", info: "brand", neutral: "neutral", brand: "brand" };
const statusTone = (status: string): Tone => TONE[CITATION_STATUS_TONE[status as CitationStatus] ?? "neutral"] ?? "neutral";
/** Shorter chip labels, in plain words for the client. */
const shortLabel = (status: CitationStatus) => (status === "nap_wrong" ? "Wrong details" : CITATION_STATUS_SHORT[status]);
const statusLabel = (status: string) =>
  status === "nap_wrong" ? "Wrong details" : (CITATION_STATUS_LABEL[status as CitationStatus] ?? status.replace(/_/g, " "));

const NAP_FIELD: Record<string, string> = { name: "Name", address: "Address", phone: "Phone", website: "Website" };

export function CitationsSection({ data }: { data: CitationData }) {
  return (
    <div className="space-y-6">
      <ScoreBlock data={data} />
      <NapIssues data={data} />
      <Directories data={data} />
      <Changes data={data} />
    </div>
  );
}

function ScoreBlock({ data }: { data: CitationData }) {
  const score = data.score;
  if (!score) return null;
  const counts = CITATION_STATUS_ORDER.filter((status) => (score.counts[status] ?? 0) > 0);
  return (
    <Card title="Listing score" icon={ShieldCheck} explain={EXPLAIN.citationScore}>
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <ScoreRing value={score.score} label={score.grade} />
        <div className="w-full space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="card-3d p-4">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">Listed on <Explain label="About coverage">{EXPLAIN.coverage}</Explain></p>
              <p className="text-2xl font-semibold tabular text-foreground">{formatRate(score.coverage)}</p>
            </div>
            <div className="card-3d p-4">
              <p className="text-xs text-muted-foreground">Directories checked</p>
              <p className="text-2xl font-semibold tabular text-foreground">{score.total}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {counts.map((status) => (
              <Pill key={status} tone={statusTone(status)}>
                {score.counts[status]} {shortLabel(status)}
              </Pill>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">As of {formatDate(data.as_of)}.</p>
        </div>
      </div>
    </Card>
  );
}

function NapIssues({ data }: { data: CitationData }) {
  const issues = data.nap_issues;
  if (!issues || issues.rows.length === 0) return null;
  return (
    <Card title="Details that don't match" icon={AlertTriangle} explain={EXPLAIN.nap}>
      <ul className="space-y-2.5">
        {issues.rows.map((row, index) => (
          <li key={`${row.directory}-${row.field}-${index}`} className="rounded-xl border border-warning/30 bg-warning-surface/50 p-3 text-sm">
            <p className="font-medium text-foreground">
              {row.directory} · {NAP_FIELD[row.field] ?? row.field}
            </p>
            <p className="mt-1 text-muted-foreground">
              Shows <span className="font-medium text-critical">{row.found ?? "nothing"}</span>
              {row.expected ? <> instead of <span className="font-medium text-success">{row.expected}</span></> : null}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Directories({ data }: { data: CitationData }) {
  const rows = data.table ?? [];
  const [filter, setFilter] = useState<string>("all");
  if (rows.length === 0) return null;
  const statuses = CITATION_STATUS_ORDER.filter((status) => rows.some((row) => row.status === status));
  const shown = filter === "all" ? rows : rows.filter((row) => row.status === filter);
  return (
    <Card title="Every directory" icon={Library} bodyClassName="px-0 pb-2">
      <div className="track-inset mx-5 mb-3 inline-flex max-w-[calc(100%-2.5rem)] flex-wrap gap-1 rounded-xl p-1" role="tablist" aria-label="Show">
        {["all", ...statuses].map((status) => (
          <button
            key={status}
            type="button"
            role="tab"
            aria-selected={filter === status}
            aria-current={filter === status ? "true" : undefined}
            onClick={() => setFilter(status)}
            className="tab-raised rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {status === "all" ? `All (${rows.length})` : shortLabel(status as CitationStatus)}
          </button>
        ))}
      </div>
      <div className="data-grid-scroll">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-5 py-2 font-medium">Directory</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Checked</th>
              <th className="px-5 py-2 text-right font-medium">Listing</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.directory} className="border-t border-border/70 hover:bg-brand-tint/40">
                <td className="px-5 py-2.5">
                  <span className="font-medium text-foreground">{row.directory}</span>
                  {row.nap_issues.length ? <span className="block text-xs text-warning-foreground">Wrong {row.nap_issues.map((field) => (NAP_FIELD[field] ?? field).toLowerCase()).join(", ")}</span> : null}
                </td>
                <td className="px-3 py-2.5"><Pill tone={statusTone(row.status)}>{statusLabel(row.status)}</Pill></td>
                <td className="px-3 py-2.5 text-muted-foreground">{formatDate(row.last_checked_at)}</td>
                <td className="px-5 py-2.5 text-right">
                  {row.listing_url ? (
                    <a href={row.listing_url} target="_blank" rel="nofollow noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      Open <ExternalLink aria-hidden className="size-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Changes({ data }: { data: CitationData }) {
  const changes = data.changes ?? [];
  if (changes.length === 0) return null;
  return (
    <Card title="Recent work on your listings" icon={History}>
      <ol className="relative space-y-4 border-l-2 border-brand-tint-strong pl-5">
        {changes.slice(0, 10).map((change, index) => (
          <li key={`${change.at}-${index}`} className="relative">
            <span aria-hidden className="bevel absolute -left-[1.85rem] top-0.5 size-4" />
            <p className="text-sm text-foreground">
              <span className="font-medium">{change.directory}</span>:{" "}
              {change.from && change.to ? `${statusLabel(change.from)} → ${statusLabel(change.to)}` : change.action.replace(/_/g, " ")}
            </p>
            <p className="text-xs text-muted-foreground">{formatDate(change.at)}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
