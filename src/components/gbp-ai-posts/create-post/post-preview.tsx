import { useState } from "react";
import { MoreVertical, Share2 } from "lucide-react";
import { AI_POST_CTA_LABEL, AI_POST_TYPE_LABEL, type AiPostCta, type AiPostType } from "@/lib/gbp/ai-posts";
import { cn } from "@/lib/utils";
import { PostThumbnail } from "../post-ui";

function initials(name: string) {
  return name
    .split(/[\s—-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

/**
 * Approximation of how a post renders on a Google Business Profile.
 * The CTA uses Google's link colour so the preview reads as the real thing.
 */
export function PostPreview({
  businessName,
  title,
  content,
  imageUrl,
  cta,
  type,
  dateLabel,
  className,
}: {
  businessName: string | null;
  title: string;
  content: string;
  imageUrl: string | null;
  cta: AiPostCta;
  type: AiPostType;
  dateLabel: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const empty = !content.trim() && !imageUrl;
  const long = content.length > 220;
  const showTitle = type !== "whats_new" && title.trim();

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-white text-[#202124] shadow-raised", className)}>
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {businessName ? initials(businessName) : "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{businessName ?? "Your business"}</p>
          <p className="text-xs text-[#5f6368]">{dateLabel}</p>
        </div>
        <MoreVertical className="size-4 text-[#5f6368]" aria-hidden />
      </div>

      {imageUrl ? (
        <PostThumbnail src={imageUrl} alt="" className="aspect-[4/3] w-full rounded-none border-x-0" iconClassName="size-8" />
      ) : empty ? (
        <div className="flex aspect-[4/3] w-full items-center justify-center border-y border-border bg-[#f1f3f4] text-xs text-[#5f6368]">
          Image preview
        </div>
      ) : null}

      <div className="space-y-2 px-4 py-3">
        {type !== "whats_new" ? (
          <span className="inline-block rounded bg-[#e8f0fe] px-1.5 py-0.5 text-[11px] font-medium text-[#1967d2]">
            {AI_POST_TYPE_LABEL[type]}
          </span>
        ) : null}
        {showTitle ? <p className="text-[15px] font-medium leading-snug">{title}</p> : null}
        {empty ? (
          <div className="space-y-1.5 py-1" aria-label="Post text will appear here">
            <div className="h-2.5 w-full rounded bg-[#f1f3f4]" />
            <div className="h-2.5 w-full rounded bg-[#f1f3f4]" />
            <div className="h-2.5 w-2/3 rounded bg-[#f1f3f4]" />
          </div>
        ) : (
          <p className={cn("whitespace-pre-line text-sm leading-relaxed", !expanded && long && "line-clamp-4")}>
            {content}
          </p>
        )}
        {long ? (
          <button type="button" onClick={() => setExpanded(!expanded)} className="text-sm font-medium text-[#1a73e8] hover:underline">
            {expanded ? "Less" : "More"}
          </button>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 px-4 pb-4">
        {cta !== "none" ? (
          <span className="inline-flex h-9 items-center rounded-full border border-[#dadce0] px-4 text-sm font-medium text-[#1a73e8]">
            {AI_POST_CTA_LABEL[cta]}
          </span>
        ) : (
          <span />
        )}
        <Share2 className="size-4 text-[#5f6368]" aria-hidden />
      </div>
    </div>
  );
}
