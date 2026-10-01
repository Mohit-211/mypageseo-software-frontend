import type { Attribution } from "./locations";

/** `self` is the location; `competitor_1`… follow `tracking.competitors`. */
export type TargetKey = string;

/** `name` (Phase 17) labels competitors; it can be null when no details were found. */
export type RankTarget = { key: TargetKey; place_id: string; name?: string | null };

export type RankBucket = "pack" | "visible" | "low" | "invisible" | "not_found" | "error";

/** One target's rank at one point. `rank` is null for not found and for errors. */
export type RankCell = {
  rank: number | null;
  status: "ok" | "not_found" | "error";
  bucket: RankBucket;
  display: string;
  /** Phase 12.5: one value per sample (61 = not in the top 60, null = failed). Absent on older runs. */
  samples?: (number | null)[];
  spread?: number | null;
};

export type ChangeLabel = "improved" | "declined" | "unchanged" | "entered_top_60" | "dropped_out_of_top_60";

/** Per keyword per target. `change` is previous − current (positive = improved); null when not comparable. */
export type RankSummary = {
  avgRank: number | null;
  foundRate: number | null;
  top3Rate: number | null;
  change?: number | null;
  changeLabel?: ChangeLabel | null;
};

export type RunMeta = {
  run_id: string;
  run_at: string;
  status: "done" | "partial";
  keywords_version: number;
  center: { lat: number; lng: number };
  /** `radius_km` (Phase 17) is center to edge; `radius_m` is the search bias around each point. */
  config: {
    grid_size: number;
    spacing_km: number;
    radius_km?: number;
    tracker_offset_km: number;
    radius_m: number;
    store_place_names: boolean;
  };
};

/** `change` covers only the keywords both runs measured (`comparable_keywords` of `keywords_total`). */
export type OverallRank = {
  overallAvgRank: number | null;
  change: number | null;
  comparable_keywords?: number;
  keywords_total?: number;
};

/** A keyword group's summary in one run (`GET rank-tracker` → `groups`). */
export type GroupSummary = {
  group_id: string;
  name: string;
  keywords: string[];
  keywords_in_run: number;
  summary: Record<TargetKey, RankSummary & { comparable_keywords?: number }>;
};

export type TrackerPointLabel = "C" | "N" | "S" | "E" | "W";

/** `GET locations/:id/rank-tracker`. */
export type RankTrackerResponse = {
  run: RunMeta;
  targets: RankTarget[];
  keywords: {
    keyword: string;
    summary: Record<TargetKey, RankSummary>;
    cells: { point: { label: TrackerPointLabel; lat: number; lng: number }; byTarget: Record<TargetKey, RankCell> }[];
  }[];
  overall: Record<TargetKey, OverallRank>;
  /** The overall average of `self` over the last 12 done/partial runs, oldest first. */
  trend: { run_id: string; run_at: string; overallAvgRank: number | null; keywords_version: number }[];
  /** The `?group=` filter in effect, or null. */
  group?: { group_id: string; name: string } | null;
  groups?: GroupSummary[];
};

export type GridPoint = { row: number; col: number; lat: number; lng: number; byTarget: Record<TargetKey, RankCell> };

/** `GET locations/:id/grid`. Points are row-major: row 0 = north, col 0 = west. */
export type GridResponse = {
  run: RunMeta;
  targets: RankTarget[];
  grid: { size: number; spacing_km: number };
  keywords: { keyword: string; summary: Record<TargetKey, RankSummary>; points: GridPoint[] }[];
};

export type MapRankingResult = {
  rank: number;
  place_id: string;
  name: string | null;
  is_self: boolean;
  target_key: TargetKey | null;
  /** Phase 17 (null on older runs): for pins on the map. */
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
};

/** `GET locations/:id/map-ranking`. */
export type MapRankingResponse = {
  run: RunMeta;
  targets?: RankTarget[];
  names_stored: boolean;
  point: TrackerPointLabel | "all";
  points_available: TrackerPointLabel[];
  keywords: { keyword: string; point: TrackerPointLabel; results: MapRankingResult[] }[];
  attribution?: Attribution;
};

export type RankRunSummary = {
  run_id: string;
  run_at: string;
  status: "queued" | "running" | "done" | "partial" | "failed";
  trigger: string;
  keywords_version: number;
  overall: Record<TargetKey, OverallRank>;
  targets?: RankTarget[];
};

/** `GET locations/:id/rank-runs`, newest first. */
export type RankRunsResponse = { runs: RankRunSummary[]; page: number; limit: number; total: number };

/** `GET locations/:id/refresh`: the refresh button's state. `next_allowed_at: null` = allowed now. */
export type RefreshState = {
  frequency: string;
  gbp_connected: boolean;
  next_refresh_at: string | null;
  rankings: { next_allowed_at: string | null; active_run: { run_id: string; status: string } | null };
  gbp: { next_allowed_at: string | null; active_sync: unknown; last_synced_at: string | null } | null;
  tokens: { cost: { rankings: number; gbp: number }; balance: number };
};

/** `POST locations/:id/refresh` → 202 (or the body of a 429). */
export type RefreshResult = {
  rankings?:
    | { run_id: string; status: string; existing: boolean; next_allowed_at: string | null }
    | { skipped: string; next_allowed_at: string | null };
};

export type ReportStatus = "queued" | "generating" | "ready" | "failed" | "expired" | "archived";

export type ReportRecord = {
  report_id: string;
  type: string;
  status: ReportStatus;
  location: { location_id: string; name: string } | null;
  client?: { client_id: string; name: string | null } | null;
  range: string | null;
  run_id: string | null;
  /** The ranking run's date; null for types without rankings. */
  run_at?: string | null;
  pdf: { bytes: number; pages: number } | null;
  failure_reason: string | null;
  created_at: string;
  generated_at: string | null;
  existing?: boolean;
};

export type ReportBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string; muted?: boolean }
  | { kind: "kpis"; items: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "neutral" }[] }
  | {
      kind: "table";
      columns: { label: string; weight?: number; align?: "left" | "right" }[];
      rows: string[][];
      highlight?: number[];
    }
  | { kind: "line_chart"; title?: string; points: { label: string; value: number | null }[]; lower_is_better?: boolean }
  | { kind: "heatmap"; title?: string; size: number; cells: { row: number; col: number; text: string; bucket: RankBucket }[] }
  | { kind: "list"; title?: string; items: string[] }
  | { kind: "unavailable"; title?: string; message: string }
  | { kind: "page_break" };

/** `GET reports/:id`. `document` is null until the report is ready. */
export type ReportDetail = {
  report: ReportRecord;
  snapshot: unknown;
  document: { title: string; period: string | null; generated_at: string; blocks: ReportBlock[] } | null;
};

/** `GET locations/:id/keyword-history`: one keyword across finished runs, oldest first. */
export type KeywordHistory = {
  keyword: string;
  runs: {
    run_id: string;
    run_at: string;
    status: string;
    keywords_version: number;
    targets: RankTarget[];
    summary: Record<TargetKey, RankSummary>;
  }[];
};

export type KeywordGroup = { group_id: string; name: string; keywords: string[] };

/** `GET reports`. */
export type ReportsListResponse = { reports: ReportRecord[]; page: number; limit: number; total: number };
