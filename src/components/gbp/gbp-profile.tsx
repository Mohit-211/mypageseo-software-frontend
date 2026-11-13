import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { BadgeCheck, Clock3, Copy, ExternalLink, Globe, MapPin, Phone, ShieldCheck, Store, Tags } from "lucide-react";
import type { GbpProfile, GbpReport } from "@/api";
import { Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { TermWithTip } from "@/components/layout/shared/info-tip";
import { Button } from "@/components/ui/button";
import { attributeLabel, attributeValue, formatHours, syncStatus, VERIFICATION_STATE_LABEL } from "@/lib/gbp/gbp-labels";
import { formatRunDate } from "@/lib/rankings/format";
import { cn } from "@/lib/utils";

// Google search terms ("What people searched") moved to the shared `SearchTermsSection`
// (src/components/keywords/search-terms-section.tsx), which GBP Overview renders as `ProfileSearchTerms`.

/* -------------------------------------------------------------------------- */
/* Profile details                                                             */
/* -------------------------------------------------------------------------- */

function formatPrice(price: { currency: string; amount: number }) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: price.currency }).format(price.amount);
  } catch {
    return `${price.amount} ${price.currency}`;
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  );
}

/** One attribute's value: Google's labels (links for URL attributes), else a readable form of the raw values. */
function AttributeValue({ attribute }: { attribute: GbpProfile["attributes"][number] }) {
  const labels = attribute.value_labels;
  if (!labels || labels.length === 0) return <>{attributeValue(attribute.values)}</>;
  return (
    <>
      {labels.map((label, index) => (
        <span key={`${label}-${index}`}>
          {index > 0 ? ", " : null}
          {/^https?:\/\//i.test(label) ? (
            <a href={label} target="_blank" rel="noreferrer" className="break-all font-medium text-primary underline-offset-2 hover:underline">
              {label}
            </a>
          ) : (
            label
          )}
        </span>
      ))}
    </>
  );
}

/** Attributes grouped as Google groups them (Accessibility, Payments…); ungrouped ones last. */
function Attributes({ attributes }: { attributes: GbpProfile["attributes"] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? attributes : attributes.slice(0, 10);
  const groups = new Map<string, typeof attributes>();
  for (const attribute of visible) {
    const group = attribute.group ?? "Other";
    groups.set(group, [...(groups.get(group) ?? []), attribute]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)));
  // A yes/no attribute's label is already a sentence ("Has wheelchair accessible entrance"), so it stands alone.
  const sentence = (attribute: GbpProfile["attributes"][number]) => attribute.value_type === "BOOL" && Boolean(attribute.value_labels?.length);

  return (
    <div className="space-y-3">
      {ordered.map(([group, items]) => (
        <div key={group}>
          {ordered.length > 1 || group !== "Other" ? <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p> : null}
          <ul className="space-y-0.5">
            {items.map((attribute) => (
              <li key={attribute.name} className="flex flex-wrap justify-between gap-x-3">
                {sentence(attribute) ? (
                  <span>
                    <AttributeValue attribute={attribute} />
                  </span>
                ) : (
                  <>
                    <span>{attribute.display_name ?? attributeLabel(attribute.name)}</span>
                    <span className="min-w-0 text-right text-muted-foreground">
                      <AttributeValue attribute={attribute} />
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {attributes.length > 10 ? (
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setShowAll((open) => !open)}>
          {showAll ? "Show fewer" : `Show all ${attributes.length}`}
        </Button>
      ) : null}
    </div>
  );
}

function copyReviewLink(link: string) {
  void navigator.clipboard
    .writeText(link)
    .then(() => toast.success("Review link copied", { description: "Send it to happy customers to ask for a review." }))
    .catch(() => toast.error("Your browser didn't allow copying. Select the link and copy it instead."));
}

/** What the profile says on Google, as Google shows it. */
export function ProfileDetails({ profile }: { profile: GbpProfile }) {
  const hours = formatHours(profile.regular_hours);
  const reviewLink = profile.new_review_uri;
  const description = profile.description;

  return (
    <Panel
      title="Profile details"
      description={profile.taken_at ? `As shown on Google, ${formatRunDate(profile.taken_at, true)}` : "As shown on Google"}
      icon={Store}
      tone="gbp"
      actions={
        profile.maps_uri ? (
          <Button asChild variant="outline" size="sm">
            <a href={profile.maps_uri} target="_blank" rel="noreferrer">
              <MapPin aria-hidden /> View on Google Maps
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </Button>
        ) : undefined
      }
    >
      <dl className="divide-y divide-border">
        <Field label="Name">{profile.title ?? "—"}</Field>
        <Field label="Categories">
          {profile.primary_category ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <StatusBadge tone="brand" icon={Tags}>
                {profile.primary_category}
              </StatusBadge>
              {profile.additional_categories.map((category) => (
                <StatusBadge key={category} tone="neutral">
                  {category}
                </StatusBadge>
              ))}
            </span>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Description">
          {description ? (
            <>
              <span className="whitespace-pre-line leading-6">{description}</span>
              <span className={cn("mt-1 block text-xs", description.length < 250 ? "text-warning-foreground" : "text-muted-foreground")}>
                {description.length} characters{description.length < 250 ? " · 250 or more works best" : ""}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">No description</span>
          )}
        </Field>
        <Field label="Phone">
          {profile.primary_phone ? (
            <span className="inline-flex items-center gap-1.5">
              <Phone aria-hidden className="size-3.5 text-muted-foreground" />
              {profile.primary_phone}
            </span>
          ) : (
            "—"
          )}
          {profile.additional_phones.length > 0 ? <span className="block text-xs text-muted-foreground">Also {profile.additional_phones.join(", ")}</span> : null}
        </Field>
        <Field label="Website">
          {profile.website ? (
            <a href={profile.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 break-all font-medium text-primary underline-offset-2 hover:underline">
              <Globe aria-hidden className="size-3.5 shrink-0" />
              {profile.website}
            </a>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Opening hours">
          {profile.regular_hours.length === 0 ? (
            <span className="text-muted-foreground">No hours set</span>
          ) : (
            <ul className="grid max-w-xs grid-cols-[6.5rem_1fr] gap-x-3 gap-y-0.5">
              {hours.map((entry) => (
                <li key={entry.day} className="contents">
                  <span className="text-muted-foreground">{entry.day}</span>
                  <span className={cn("tabular-nums", entry.hours === "Closed" && "text-muted-foreground")}>{entry.hours}</span>
                </li>
              ))}
            </ul>
          )}
          {profile.special_hour_dates.length > 0 ? (
            <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 aria-hidden className="size-3.5" />
              Special hours set for {profile.special_hour_dates.length} date{profile.special_hour_dates.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </Field>
        {profile.service_area && (profile.service_area.place_count > 0 || profile.service_area.business_type) ? (
          <Field label="Service area">
            {profile.service_area.place_count > 0 ? `${profile.service_area.place_count} area${profile.service_area.place_count === 1 ? "" : "s"} served` : "—"}
            {profile.service_area.business_type ? (
              <span className="block text-xs text-muted-foreground">{profile.service_area.business_type.replace(/_/g, " ").toLowerCase()}</span>
            ) : null}
          </Field>
        ) : null}
        <Field label="Services">
          {profile.service_items.length === 0 ? (
            <span className="text-muted-foreground">No services listed</span>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {profile.service_items.map((item, index) => (
                <li
                  key={`${item.name}-${index}`}
                  className="rounded-md border border-border bg-surface-strong px-2 py-0.5 text-xs font-medium text-foreground"
                  title={item.description ?? undefined}
                >
                  {item.name ?? "Unnamed service"}
                  {item.price ? <span className="ml-1 font-normal text-muted-foreground">{formatPrice(item.price)}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Field>
        <Field label="Attributes">{profile.attributes.length === 0 ? <span className="text-muted-foreground">None set</span> : <Attributes attributes={profile.attributes} />}</Field>
        {reviewLink ? (
          <Field label="Review link">
            <span className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 break-all text-xs text-muted-foreground">{reviewLink}</span>
              <Button variant="outline" size="sm" onClick={() => copyReviewLink(reviewLink)}>
                <Copy aria-hidden /> Copy link
              </Button>
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">Send this to customers to ask for a review.</span>
          </Field>
        ) : null}
      </dl>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Profile status and Google data                                              */
/* -------------------------------------------------------------------------- */

function StatusRow({ label, children, detail }: { label: ReactNode; children: ReactNode; detail?: ReactNode }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="shrink-0 text-right">{children}</dd>
      </div>
      {detail ? <div className="mt-1 space-y-1 text-xs text-muted-foreground">{detail}</div> : null}
    </div>
  );
}

/** Verification, open status and Google's suggested edits, then when each part of the data was last fetched. */
export function ProfileStatus({ report }: { report: GbpReport }) {
  const verification = report.verification;
  const edits = report.pending_google_edits;
  const sync = report.sync;
  const openStatus = report.profile.available ? report.profile.open_status : null;

  return (
    <div className="space-y-4">
      <Panel title="Profile status" icon={ShieldCheck} tone="gbp">
        <dl className="divide-y divide-border">
          <StatusRow
            label="Verification"
            detail={
              verification.available ? (
                <>
                  {verification.verified && verification.verified_at ? (
                    <p>
                      Verified {formatRunDate(verification.verified_at)}
                      {verification.latest?.method ? ` by ${verification.latest.method.replace(/_/g, " ").toLowerCase()}` : ""}
                    </p>
                  ) : null}
                  {verification.guidance ? <p className="text-warning-foreground">Google says: {verification.guidance}</p> : null}
                  {!verification.verified && verification.latest?.state ? (
                    <p>
                      Latest attempt: {verification.latest.state.replace(/_/g, " ").toLowerCase()}
                      {verification.latest.create_time ? ` (${formatRunDate(verification.latest.create_time)})` : ""}
                    </p>
                  ) : null}
                  {verification.stale ? (
                    <p className="text-warning-foreground">
                      Couldn't check this with Google{verification.checked_at ? `; last checked ${formatRunDate(verification.checked_at, true)}` : ""}.
                    </p>
                  ) : null}
                </>
              ) : "message" in verification && verification.message ? (
                <p>{verification.message}</p>
              ) : null
            }
          >
            {verification.available ? (
              <StatusBadge
                tone={verification.verified ? "success" : verification.state === "verification_pending" ? "warning" : "critical"}
                icon={verification.verified ? BadgeCheck : undefined}
              >
                {VERIFICATION_STATE_LABEL[verification.state ?? ""] ?? (verification.verified ? "Verified" : "Not verified")}
              </StatusBadge>
            ) : (
              <span className="text-sm text-muted-foreground">Unknown</span>
            )}
          </StatusRow>
          {openStatus ? (
            <StatusRow label="Business status">
              {openStatus === "OPEN" ? (
                <StatusBadge tone="success" dot>
                  Open
                </StatusBadge>
              ) : (
                <StatusBadge tone="warning" dot>
                  {openStatus.charAt(0) + openStatus.slice(1).replace(/_/g, " ").toLowerCase()}
                </StatusBadge>
              )}
            </StatusRow>
          ) : null}
          <StatusRow
            label={<TermWithTip term="Edits suggested by Google">Google sometimes changes a profile based on suggestions from the public. Review them on Google so the profile shows what you want.</TermWithTip>}
            detail={
              edits.available && edits.has_pending && edits.pending_fields.length > 0 ? (
                <p>{edits.pending_fields.map((field) => field.replace(/([A-Z])/g, " $1").toLowerCase()).join(", ")}</p>
              ) : null
            }
          >
            {edits.available ? (
              edits.has_pending ? (
                <StatusBadge tone="warning">Waiting for review</StatusBadge>
              ) : (
                <StatusBadge tone="success">None</StatusBadge>
              )
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </StatusRow>
        </dl>
      </Panel>

      <Panel title="Google data" description="When each part was last fetched from Google." icon={Clock3} tone="settings">
        {"types" in sync ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Last synced <span className="font-medium text-foreground">{sync.last_synced_at ? formatRunDate(sync.last_synced_at, true) : "never"}</span>
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {Object.entries(sync.types).map(([type, entry]) => {
                const status = syncStatus(entry.status);
                return (
                  <li key={type} className="flex items-start justify-between gap-3 px-3 py-2">
                    <span className="text-sm capitalize text-foreground">{type.replace(/_/g, " ")}</span>
                    <span className="text-right">
                      <StatusBadge tone={status.tone} size="sm">
                        {status.label}
                      </StatusBadge>
                      {entry.message ? <span className="mt-0.5 block max-w-48 text-xs text-muted-foreground">{entry.message}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Google data hasn't been fetched yet.</p>
        )}
      </Panel>
    </div>
  );
}

/** Small "Open on Google" link for panels that summarise something editable only on Google. */
export function GoogleLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
      <ExternalLink aria-hidden className="size-3.5" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
