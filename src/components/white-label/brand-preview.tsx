import { useState } from "react";
import { ExternalLink, FileText, Globe, Mail, Paperclip } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { BrandPreviewData } from "@/lib/white-label/brand-form";
import { PDF_WHITE, brandWash, clientHeroBackground, clientPageTextOn } from "@/lib/white-label/color";
import { cn } from "@/lib/utils";

export type PreviewView = "client" | "pdf" | "email";

const VIEWS = [
  { value: "client", label: "Client page", icon: Globe },
  { value: "pdf", label: "PDF report", icon: FileText },
  { value: "email", label: "Email", icon: Mail },
] as const;

const SAMPLE_BUSINESS = "Your client's business";

/**
 * The brand on the three things clients get: the live client page, a PDF report and a report email,
 * drawn from `brand` (the form while editing, so every keystroke shows). Each view follows how that
 * channel really uses the colours: the PDF and the email print white on the primary colour and the
 * business name in the secondary colour; the client page picks its own text colour.
 */
export function BrandPreview({
  brand,
  logoUrl,
  sampleLinkUrl,
  subtitle = "How your clients see your brand.",
  className,
}: {
  brand: BrandPreviewData;
  logoUrl: string | null;
  /** A live client link, to open a real page with this brand. */
  sampleLinkUrl?: string | null | undefined;
  subtitle?: string;
  className?: string;
}) {
  const [view, setView] = useState<PreviewView>("client");
  return (
    <div className={cn("min-w-0 rounded-xl border border-border bg-card shadow-card", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Live preview</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <SegmentedControl size="sm" aria-label="Preview" value={view} onValueChange={setView} options={VIEWS} />
      </div>
      <div className="bg-muted/70 p-3 sm:p-4" aria-live="polite">
        {view === "client" ? (
          <ClientPagePreview brand={brand} logoUrl={logoUrl} />
        ) : view === "pdf" ? (
          <PdfPreview brand={brand} logoUrl={logoUrl} />
        ) : (
          <EmailPreview brand={brand} />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span>{VIEW_NOTE[view](brand)}</span>
        {sampleLinkUrl && view === "client" ? (
          <a
            href={sampleLinkUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 rounded-sm font-medium text-primary underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open a real client page <ExternalLink aria-hidden className="size-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

const VIEW_NOTE: Record<PreviewView, (brand: BrandPreviewData) => string> = {
  client: () => "Client links never mention MyPageSEO.",
  pdf: (brand) => (brand.hideMyPageSeo ? "PDFs carry only your brand." : "PDFs end with a small “Powered by MyPageSEO”."),
  email: () => "Sent with the PDF attached.",
};

/** The logo, or the name's initial in the primary colour when there is none. */
function LogoMark({ brand, logoUrl, className }: { brand: BrandPreviewData; logoUrl: string | null; className?: string }) {
  if (logoUrl) return <img src={logoUrl} alt="" className={cn("h-6 max-w-20 object-contain", className)} />;
  return (
    <span
      aria-hidden
      className={cn("grid size-6 place-items-center rounded-md text-xs font-bold", className)}
      style={{ backgroundColor: brand.primary, color: clientPageTextOn(brand.primary) }}
    >
      {brand.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function ClientPagePreview({ brand, logoUrl }: { brand: BrandPreviewData; logoUrl: string | null }) {
  const onPrimary = clientPageTextOn(brand.primary);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-strong shadow-sm" role="img" aria-label={`Client page with ${brand.name}'s brand`}>
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        <span className="flex h-8 items-center rounded-md bg-card px-1.5 shadow-xs ring-1 ring-border">
          <LogoMark brand={brand} logoUrl={logoUrl} />
        </span>
        <span className="min-w-0 truncate text-xs font-semibold text-foreground">{brand.name}</span>
        {brand.websiteHost ? (
          <span
            className="ml-auto hidden max-w-[45%] items-center gap-1 truncate rounded-md px-2 py-1 text-xs font-medium ring-1 ring-border sm:inline-flex"
            style={{ color: brand.primary, backgroundColor: brandWash(brand.primary, 6) }}
          >
            <span className="truncate">{brand.websiteHost}</span>
            <ExternalLink aria-hidden className="size-3 shrink-0" />
          </span>
        ) : null}
      </div>
      <div className="space-y-3 p-3">
        <div className="rounded-xl px-4 py-4 shadow-sm" style={{ background: clientHeroBackground(brand.primary, brand.secondary), color: onPrimary }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Local search report</p>
          <p className="mt-1 text-base font-semibold leading-tight">{SAMPLE_BUSINESS}</p>
          <p className="mt-1.5 text-xs leading-relaxed">Prepared for you by {brand.name}. It updates on its own every month.</p>
        </div>
        <div className="flex gap-1 overflow-hidden rounded-lg bg-card p-1 text-xs ring-1 ring-border">
          <span className="rounded-md px-2.5 py-1 font-semibold shadow-xs ring-1 ring-border" style={{ color: brand.primary }}>
            Overview
          </span>
          <span className="truncate rounded-md px-2.5 py-1 text-muted-foreground">Rank Tracker</span>
          <span className="hidden truncate rounded-md px-2.5 py-1 text-muted-foreground sm:block">GBP Audit</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <PreviewKpi label="Average rank" value="8.4" color={brand.primary} fill={0.72} />
          <PreviewKpi label="Profile score" value="86" color={brand.secondary} fill={0.86} />
        </div>
      </div>
    </div>
  );
}

function PreviewKpi({ label, value, color, fill }: { label: string; value: string; color: string; fill: number }) {
  return (
    <div className="rounded-lg bg-card p-2.5 ring-1 ring-border">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold leading-tight text-foreground">{value}</p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${fill * 100}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

const SAMPLE_ROWS: [string, string, string][] = [
  ["emergency plumber", "3.2", "+1.4"],
  ["water heater repair", "6.8", "+0.6"],
  ["drain cleaning", "11.5", "−0.8"],
];

function PdfPreview({ brand, logoUrl }: { brand: BrandPreviewData; logoUrl: string | null }) {
  return (
    <div className="mx-auto max-w-[400px] overflow-hidden rounded-md border border-border bg-card shadow-raised" role="img" aria-label={`PDF report with ${brand.name}'s brand`}>
      {/* The band: the logo sits right on the primary colour, the text is always white. */}
      <div className="flex min-h-[72px] items-center gap-3 px-4 py-3" style={{ backgroundColor: brand.primary, color: PDF_WHITE }}>
        {logoUrl ? <img src={logoUrl} alt="" className="h-10 max-w-24 shrink-0 object-contain" /> : null}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{brand.name}</p>
          {brand.contact ? <p className="truncate text-xs">{brand.contact}</p> : null}
        </div>
      </div>
      <div className="px-4 pt-4">
        <p className="text-base font-bold leading-tight text-foreground">Rank Tracker Report</p>
        <p className="mt-1 text-sm font-bold" style={{ color: brand.secondary }}>
          {SAMPLE_BUSINESS}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">120 King St W, Toronto · Last 28 days</p>
      </div>
      <div className="mx-4 my-3 h-px bg-border" />
      <div className="px-4">
        <p className="mb-1.5 text-xs font-bold text-foreground">Keywords</p>
        <div className="overflow-hidden rounded-sm text-xs">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-2 py-1.5 font-bold" style={{ backgroundColor: brand.primary, color: PDF_WHITE }}>
            <span>Keyword</span>
            <span className="text-right">Avg rank</span>
            <span className="w-10 text-right">Change</span>
          </div>
          {SAMPLE_ROWS.map(([keyword, rank, change]) => (
            <div key={keyword} className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border px-2 py-1.5 text-foreground last:border-b-0">
              <span className="truncate">{keyword}</span>
              <span className="text-right tabular-nums">{rank}</span>
              <span className="w-10 text-right tabular-nums">{change}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate">{brand.footer || brand.name}</span>
          <span className="shrink-0">Page 1 of 5</span>
        </div>
        {brand.hideMyPageSeo ? null : <p className="mt-0.5 text-right">Powered by MyPageSEO</p>}
      </div>
    </div>
  );
}

function EmailPreview({ brand }: { brand: BrandPreviewData }) {
  return (
    <div className="mx-auto max-w-[440px] overflow-hidden rounded-lg border border-border bg-card shadow-raised" role="img" aria-label={`Report email from ${brand.sender}`}>
      <dl className="space-y-1 border-b border-border bg-surface-strong px-4 py-3 text-xs">
        <EmailHeader label="From" value={brand.sender} />
        <EmailHeader label="Reply-to" value={brand.replyTo || "Not set"} muted={!brand.replyTo} />
        <EmailHeader label="Subject" value={`Rank Tracker Report: ${SAMPLE_BUSINESS}`} />
      </dl>
      <div className="p-4">
        <div className="px-3 py-2.5 text-sm font-bold" style={{ backgroundColor: brand.primary, color: PDF_WHITE }}>
          {brand.name}
        </div>
        <div className="space-y-2 px-1 pt-3">
          <div>
            <p className="text-base font-bold leading-tight text-foreground">Rank Tracker Report</p>
            <p className="text-sm font-bold" style={{ color: brand.secondary }}>
              {SAMPLE_BUSINESS}
            </p>
            <p className="text-xs text-muted-foreground">Last 28 days</p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-sm bg-muted px-2.5 py-1.5">
              <span className="block text-xs text-muted-foreground">Average rank</span>
              <span className="block text-base font-bold text-foreground">8.4</span>
            </span>
            <span className="rounded-sm bg-muted px-2.5 py-1.5">
              <span className="block text-xs text-muted-foreground">Top-3 rate</span>
              <span className="block text-base font-bold text-foreground">42%</span>
            </span>
          </div>
          <p className="text-sm text-foreground">The full report is attached as a PDF.</p>
          <p className="text-xs text-muted-foreground">
            {[brand.footer, brand.contact, brand.hideMyPageSeo ? "" : "Powered by MyPageSEO"].filter(Boolean).map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
          <p className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground">
            <Paperclip aria-hidden className="size-3.5 text-muted-foreground" /> rank-tracker-report.pdf
          </p>
        </div>
      </div>
    </div>
  );
}

function EmailHeader({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex min-w-0 gap-2">
      <dt className="w-16 shrink-0 font-semibold text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 truncate", muted ? "text-muted-foreground" : "text-foreground")}>{value}</dd>
    </div>
  );
}
