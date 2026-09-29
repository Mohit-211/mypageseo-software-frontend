import { CalendarClock, Copy, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { postActions, type AiGbpPost } from "@/lib/gbp/ai-posts";
import { usePostActions } from "./use-post-actions";

export function PostActionsMenu({ post, showView = true }: { post: AiGbpPost; showView?: boolean }) {
  const actions = usePostActions(post);
  const allowed = postActions(post);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={`More actions for ${post.title}`}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {showView ? (
            <DropdownMenuItem onSelect={actions.view}>
              <Eye className="size-4" aria-hidden /> View
            </DropdownMenuItem>
          ) : null}
          {allowed.canEdit ? (
            <DropdownMenuItem onSelect={actions.edit}>
              <Pencil className="size-4" aria-hidden /> Edit
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={actions.duplicate}>
            <Copy className="size-4" aria-hidden /> Duplicate
          </DropdownMenuItem>
          {allowed.canReschedule ? (
            <DropdownMenuItem onSelect={actions.reschedule}>
              <CalendarClock className="size-4" aria-hidden /> Reschedule
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={actions.remove} className="text-critical focus:text-critical">
            <Trash2 className="size-4" aria-hidden /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {actions.dialogs}
    </>
  );
}
