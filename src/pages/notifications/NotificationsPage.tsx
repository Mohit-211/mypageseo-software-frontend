import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, CheckCheck, Undo2 } from "lucide-react";
import { AppShell } from "@/components/mypageseo/app-shell";
import { PageHeader, Panel, StatusBadge } from "@/components/mypageseo/data-display";
import { EmptyState } from "@/components/mypageseo/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  NOTIFICATION_CAPABILITIES,
  NOTIFICATION_CATEGORY_LABEL,
  NOTIFICATION_CATEGORY_TONE,
  formatNotificationTime,
  formatNotificationTimestamp,
  getNotifications,
  type NotificationCategory,
  type NotificationItem,
  type NotificationTarget,
} from "@/lib/mypageseo/notifications";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { cn } from "@/lib/utils";
import { NoNotificationsEmpty, NoResultsEmpty } from "@/components/mypageseo/empty-states";

const DESCRIPTION =
  "Important updates and alerts from your Mypageseo account, newest first.";



const PAGE_SIZE = 10;

function NotificationsPage() {
  const workspace = useWorkspace();
  const isAgency = workspace.organization?.accountType === "agency";
  const data = getNotifications();

  const [readOverrides, setReadOverrides] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [status, setStatus] = useState<"all" | "unread" | "read">("all");
  const [category, setCategory] = useState<"all" | NotificationCategory>("all");
  const [client, setClient] = useState<string>("all");
  const [location, setLocation] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const items: NotificationItem[] = useMemo(
    () =>
      data.notifications.map((item) => ({
        ...item,
        read: readOverrides[item.id] ?? item.read,
      })),
    [data.notifications, readOverrides],
  );

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category))),
    [items],
  );
  const clients = useMemo(
    () =>
      Array.from(
        new Map(
          items
            .filter((item) => item.clientId && item.clientName)
            .map((item) => [item.clientId as string, item.clientName as string]),
        ),
      ),
    [items],
  );
  const locations = useMemo(
    () =>
      Array.from(
        new Map(
          items
            .filter((item) => item.locationId && item.locationName)
            .filter((item) => client === "all" || item.clientId === client)
            .map((item) => [item.locationId as string, item.locationName as string]),
        ),
      ),
    [items, client],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items
      .filter((item) => (status === "all" ? true : status === "unread" ? !item.read : item.read))
      .filter((item) => category === "all" || item.category === category)
      .filter((item) => client === "all" || item.clientId === client)
      .filter((item) => location === "all" || item.locationId === location)
      .filter((item) =>
        term.length === 0
          ? true
          : `${item.title} ${item.description} ${item.locationName ?? ""}`
              .toLowerCase()
              .includes(term),
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [items, status, category, client, location, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const unreadCount = items.filter((item) => !item.read).length;

  const setRead = (id: string, read: boolean) => {
    setPending(id);
    window.setTimeout(() => {
      setReadOverrides((prev) => ({ ...prev, [id]: read }));
      setPending(null);
    }, 200);
  };

  const markAllRead = () => {
    setReadOverrides((prev) => {
      const next = { ...prev };
      for (const item of items) next[item.id] = true;
      return next;
    });
  };

  const resetFilters = () => {
    setStatus("all");
    setCategory("all");
    setClient("all");
    setLocation("all");
    setSearch("");
    setPage(1);
  };

  return (
    <AppShell>
      <PageHeader
        title="Notifications"
        description={DESCRIPTION}
        actions={
          NOTIFICATION_CAPABILITIES.canMarkAllRead ? (
            <Button variant="outline" onClick={markAllRead} disabled={unreadCount === 0}>
              <CheckCheck aria-hidden />
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      {data.status === "no_notifications" ? (
        <NoNotificationsEmpty />
      ) : (
        <div className="space-y-4">
          <Panel className="p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div>
                <Label htmlFor="notif-search" className="sr-only">
                  Search notifications
                </Label>
                <Input
                  id="notif-search"
                  type="search"
                  placeholder="Search notifications"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <FilterSelect
                label="Status"
                value={status}
                onChange={(value) => {
                  setStatus(value as typeof status);
                  setPage(1);
                }}
                options={[
                  { value: "all", label: `All (${items.length})` },
                  { value: "unread", label: `Unread (${unreadCount})` },
                  { value: "read", label: "Read" },
                ]}
              />
              <FilterSelect
                label="Type"
                value={category}
                onChange={(value) => {
                  setCategory(value as typeof category);
                  setPage(1);
                }}
                options={[
                  { value: "all", label: "All types" },
                  ...categories.map((item) => ({
                    value: item,
                    label: NOTIFICATION_CATEGORY_LABEL[item],
                  })),
                ]}
              />
              {isAgency && clients.length > 0 ? (
                <FilterSelect
                  label="Client"
                  value={client}
                  onChange={(value) => {
                    setClient(value);
                    setLocation("all");
                    setPage(1);
                  }}
                  options={[
                    { value: "all", label: "All clients" },
                    ...clients.map(([id, name]) => ({ value: id, label: name })),
                  ]}
                />
              ) : null}
              {locations.length > 0 ? (
                <FilterSelect
                  label="Location"
                  value={location}
                  onChange={(value) => {
                    setLocation(value);
                    setPage(1);
                  }}
                  options={[
                    { value: "all", label: "All locations" },
                    ...locations.map(([id, name]) => ({ value: id, label: name })),
                  ]}
                />
              ) : null}
            </div>
          </Panel>

          {filtered.length === 0 ? (
            <NoResultsEmpty label="notifications" onClear={resetFilters} />
          ) : (
            <>
              <Panel className="p-0">
                <ul className="divide-y divide-border">
                  {visible.map((item) => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      busy={pending === item.id}
                      onSetRead={setRead}
                    />
                  ))}
                </ul>
              </Panel>

              {pageCount > 1 ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {pageCount} · {filtered.length} notifications
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                      disabled={currentPage === pageCount}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <Label className="sr-only">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function NotificationRow({
  item,
  busy,
  onSetRead,
}: {
  item: NotificationItem;
  busy: boolean;
  onSetRead: (id: string, read: boolean) => void;
}) {
  return (
    <li className={cn("flex gap-3 p-4", !item.read && "bg-secondary/40")}>
      <span
        aria-hidden
        className={cn(
          "mt-2 size-2 shrink-0 rounded-full",
          item.read ? "bg-transparent" : "bg-primary",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={NOTIFICATION_CATEGORY_TONE[item.category]}>
            {NOTIFICATION_CATEGORY_LABEL[item.category]}
          </StatusBadge>
          <span
            className="text-xs text-muted-foreground"
            title={formatNotificationTimestamp(item.createdAt)}
          >
            {formatNotificationTime(item.createdAt)}
          </span>
          {!item.read ? (
            <span className="text-xs font-medium text-primary">Unread</span>
          ) : null}
        </div>
        <p className={cn("mt-1.5 text-sm text-foreground", !item.read && "font-medium")}>
          {item.title}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
        {item.clientName || item.locationName ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {[item.clientName, item.locationName].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <TargetLink target={item.target} />
          {item.read
            ? NOTIFICATION_CAPABILITIES.canMarkUnread && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => onSetRead(item.id, false)}
                >
                  <Undo2 aria-hidden />
                  Mark as unread
                </Button>
              )
            : NOTIFICATION_CAPABILITIES.canMarkRead && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => onSetRead(item.id, true)}
                >
                  <Check aria-hidden />
                  {busy ? "Marking…" : "Mark as read"}
                </Button>
              )}
        </div>
      </div>
    </li>
  );
}

function TargetLink({ target }: { target: NotificationTarget | undefined }) {
  if (!target) return null;
  const className = "text-sm font-medium text-primary underline-offset-4 hover:underline";

  switch (target.kind) {
    case "location":
      return (
        <Link to={`/locations/${target.locationId}/gbp`} className={className}>
          View location
        </Link>
      );
    case "location_gbp":
      return (
        <Link to={`/locations/${target.locationId}/gbp`} className={className}>
          View profile
        </Link>
      );
    case "location_reviews":
      return (
        <Link
          to={`/locations/${target.locationId}/gbp/reviews`}
          className={className}
        >
          View reviews
        </Link>
      );
    case "location_rankings":
      return (
        <Link
          to={`/locations/${target.locationId}/rankings`}
          className={className}
        >
          View rankings
        </Link>
      );
    case "location_citations":
      return (
        <Link
          to={`/locations/${target.locationId}/citations`}
          className={className}
        >
          View citations
        </Link>
      );
    case "report":
      return (
        <Link to={`/reports/${target.reportId}`} className={className}>
          View report
        </Link>
      );
    case "automation":
      return (
        <Link
          to={`/automations/${target.automationId}`}
          className={className}
        >
          View automation
        </Link>
      );
    case "billing":
      return (
        <Link to="/settings/billing" className={className}>
          View billing
        </Link>
      );
    default:
      return null;
  }
}

export default NotificationsPage;
