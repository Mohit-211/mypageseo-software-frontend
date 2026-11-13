import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import { keywordsPath } from "@/lib/keywords/paths";

// One-click tracking of a Google search term lives in the shared search-terms section
// (`SearchTermsSection`, with `useTrackKeyword`), so GBP Overview and Keywords track the same way.

/**
 * "Manage keywords": a link to the location's Keywords page, for panels that show keywords elsewhere.
 * A read-only client user can look but not change, so it reads "See keywords" for them.
 */
export function ManageKeywordsLink({ locationId, className }: { locationId: string; className?: string }) {
  const canEdit = useCanEdit();
  return (
    <Button asChild variant="outline" size="sm" className={className}>
      <Link to={keywordsPath(locationId)}>{canEdit ? "Manage keywords" : "See keywords"}</Link>
    </Button>
  );
}
