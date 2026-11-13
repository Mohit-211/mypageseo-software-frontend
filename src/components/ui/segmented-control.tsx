import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
};

/** Options grow to 36px on touch screens (the minimum tap target); mouse layouts keep their density. */
const SIZES = {
  sm: { track: "h-9 p-1 pointer-coarse:h-11", item: "h-7 px-2.5 text-[13px] [&_svg]:size-3.5 pointer-coarse:h-9" },
  md: { track: "h-10 p-1 pointer-coarse:h-11", item: "h-8 px-3 text-sm [&_svg]:size-4 pointer-coarse:h-9" },
} as const;

/**
 * One-of-N switch for an in-page view or period (28 days / 90 days / 12 months, list / calendar).
 * It changes what the page shows, not where you are: it is not a replacement for navigation.
 * Keyboard: Tab focuses the selected option, arrow keys move between options (Radix roving focus),
 * and the options are exposed as radios.
 */
function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  size?: "sm" | "md";
  className?: string;
  "aria-label": string;
}) {
  const sizes = SIZES[size];
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      // Radix lets a single toggle group be emptied by clicking the active item; a view switch must
      // always have a value, so an empty change is ignored.
      onValueChange={(next) => {
        if (next) onValueChange(next as T);
      }}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted ring-1 ring-inset ring-border [scrollbar-width:none]",
        sizes.track,
        className,
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <ToggleGroupPrimitive.Item
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium text-muted-foreground transition-[color,background-color,box-shadow] outline-hidden hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-card data-[state=on]:font-semibold data-[state=on]:text-foreground data-[state=on]:shadow-sm data-[state=on]:ring-1 data-[state=on]:ring-border-strong/60 [&_svg]:shrink-0",
              sizes.item,
            )}
          >
            {Icon ? <Icon aria-hidden /> : null}
            {option.label}
          </ToggleGroupPrimitive.Item>
        );
      })}
    </ToggleGroupPrimitive.Root>
  );
}

export { SegmentedControl };
