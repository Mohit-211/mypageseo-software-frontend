import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Lock, Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";

export type PreviewDevice = "desktop" | "tablet" | "mobile";

const PREVIEW_DEVICES: { value: PreviewDevice; label: string; icon: typeof Monitor }[] = [
  { value: "desktop", label: "Desktop", icon: Monitor },
  { value: "tablet", label: "Tablet", icon: Tablet },
  { value: "mobile", label: "Mobile", icon: Smartphone },
];

/** Virtual screen size per device, in CSS pixels, including the frame. */
const DEVICE_SIZE: Record<PreviewDevice, { width: number; height: number }> = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 820 + 28, height: 1100 + 28 },
  mobile: { width: 390 + 24, height: 800 + 24 },
};

/**
 * Renders children at a fixed virtual size and scales the whole thing down to
 * fit the available width (and optional max height), so a desktop report can
 * be previewed inside a narrow column without reflowing.
 */
export function ScaledViewport({
  width,
  height,
  maxHeight,
  children,
  className,
}: {
  width: number;
  height: number;
  maxHeight?: number;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setAvailable(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setAvailable(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = available ? Math.min(1, available / width, maxHeight ? maxHeight / height : 1) : 0;

  return (
    <div ref={ref} className={cn("w-full", className)}>
      <div className="mx-auto overflow-hidden" style={{ width: width * scale, height: height * scale }}>
        {scale ? (
          <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
        ) : null}
      </div>
    </div>
  );
}

/** Browser window chrome with the agency favicon and title in the tab. */
export function BrowserChrome({
  url,
  title,
  faviconUrl,
  children,
}: {
  url: string;
  title: string;
  faviconUrl: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-lg">
      <div className="flex items-end gap-3 bg-slate-200 px-4 pt-2.5">
        <div className="flex gap-1.5 pb-3">
          <span className="size-3 rounded-full bg-[#FF5F57]" />
          <span className="size-3 rounded-full bg-[#FEBC2E]" />
          <span className="size-3 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex max-w-72 min-w-0 items-center gap-2 rounded-t-lg bg-white px-3.5 py-2 text-xs text-slate-700">
          {faviconUrl ? <img src={faviconUrl} alt="" className="size-4 shrink-0 rounded-sm object-contain" /> : <span className="size-4 shrink-0 rounded-sm bg-slate-300" />}
          <span className="truncate">{title}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 text-xs text-slate-600">
          <Lock className="size-3 shrink-0 text-slate-500" aria-hidden />
          <span className="truncate">{url}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

/** Tablet or phone bezel with a minimal address bar. */
function HandheldChrome({ device, url, children }: { device: "tablet" | "mobile"; url: string; children: ReactNode }) {
  return (
    <div className={cn("flex h-full flex-col overflow-hidden bg-slate-900 shadow-xl", device === "mobile" ? "rounded-[44px] p-3" : "rounded-4xl p-3.5")}>
      <div className={cn("flex h-full flex-col overflow-hidden bg-white", device === "mobile" ? "rounded-[34px]" : "rounded-[20px]")}>
        <div className="flex items-center justify-center border-b border-slate-200 bg-white px-4 pb-2 pt-3">
          <div className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
            <Lock className="size-2.5 shrink-0" aria-hidden />
            <span className="truncate">{url}</span>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/** A report shown inside a device frame, scaled to fit its container. */
export function DeviceFrame({
  device,
  url,
  title,
  faviconUrl,
  maxHeight,
  children,
}: {
  device: PreviewDevice;
  url: string;
  title: string;
  faviconUrl: string | null;
  maxHeight?: number;
  children: ReactNode;
}) {
  const size = DEVICE_SIZE[device];
  return (
    <ScaledViewport width={size.width} height={size.height} {...(maxHeight ? { maxHeight } : {})}>
      {device === "desktop" ? (
        <BrowserChrome url={url} title={title} faviconUrl={faviconUrl}>
          {children}
        </BrowserChrome>
      ) : (
        <HandheldChrome device={device} url={url}>
          {children}
        </HandheldChrome>
      )}
    </ScaledViewport>
  );
}

/** Desktop / Tablet / Mobile switcher. */
export function DeviceSwitcher({ value, onChange, className }: { value: PreviewDevice; onChange: (device: PreviewDevice) => void; className?: string }) {
  return (
    <div role="tablist" aria-label="Preview device" className={cn("inline-flex rounded-md border border-border bg-surface p-0.5", className)}>
      {PREVIEW_DEVICES.map(({ value: device, label, icon: Icon }) => (
        <button
          key={device}
          type="button"
          role="tab"
          aria-selected={device === value}
          onClick={() => onChange(device)}
          className={cn(
            "inline-flex min-h-8 items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
            device === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
