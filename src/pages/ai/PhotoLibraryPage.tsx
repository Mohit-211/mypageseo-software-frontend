import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Images, Loader2, SlidersHorizontal, Upload } from "lucide-react";
import type { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";
import type { PostMediaDetails, PostMediaList } from "@/api";
import { LibraryPhotoCard, OtherPhotoCard } from "@/components/photo-library/photo-card";
import { UploadReportNotice, UploadZone } from "@/components/photo-library/upload-zone";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState } from "@/components/layout/shared/feedback/states";
import { FormAlert } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { useCanEdit } from "@/hooks/use-access";
import { useAiReadiness } from "@/lib/ai-readiness/use-readiness";
import { isNotAvailableYet } from "@/lib/ai-settings/errors";
import { useLocationRoute } from "@/lib/locations/location-route-context";
import { locationPath } from "@/lib/mypageseo/section-links";
import { LIBRARY_READ_ONLY_TEXT, PHOTO_ACCEPT, libraryCountsText, librarySize } from "@/lib/photo-library/library";
import { photosOf, usePhotoList } from "@/lib/photo-library/use-library";
import { useUploadPhotos } from "@/lib/photo-library/use-upload";

type View = "library" | "other";

const COUNT = new Intl.NumberFormat("en-US");
const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";

/**
 * "Photo library" (`/locations/:locationId/ai/photos`, Phase 25c): the business's own photos, which AI posts use
 * first (a photo that fits the post, then the same photo touched up, and only then an AI image). Up to 200 per
 * location. Linked from AI Settings, the readiness checklist and AI Studio.
 *
 * - "Your library": each photo with where it stands for automatic posts (being checked, ready, kept out and why),
 *   "Use anyway" for a stock-like or watermark flag, its description (it decides which posts it fits) and its use.
 *   Owners and members upload (several at once, or dropped on the page), describe, and take photos out.
 * - "Other photos": the location's photos outside the library (uploaded in the post editor, AI images, pictures made
 *   for posts); photos the business uploaded can join the library.
 * A client user sees both, read-only.
 */
function PhotoLibraryPage() {
  const { location } = useLocationRoute();
  const id = location.location_id;
  const canEdit = useCanEdit();
  const [view, setView] = useState<View>("library");
  const library = usePhotoList(id, true);
  const other = usePhotoList(id, false);
  const readiness = useAiReadiness(id);
  const uploader = useUploadPhotos(id);
  const fileInput = useRef<HTMLInputElement>(null);

  const size = librarySize(library.data?.pages[0] ?? other.data?.pages[0]);
  const full = size !== null && size.count >= size.max;
  const libraryCount = size?.count ?? library.data?.pages[0]?.total ?? null;
  const otherCount = other.data?.pages[0]?.total ?? null;
  const counts = libraryCountsText(size, readiness.data?.details?.photos);
  const pick = () => fileInput.current?.click();
  const upload = (files: readonly File[]) => {
    setView("library");
    void uploader.start(files);
  };

  return (
    <>
      <PageHeader
        icon={Images}
        tone="ai"
        title="Photo library"
        description={`Photos of ${location.name} that AI posts use first: a photo that fits the post, then the same photo touched up, and only then an AI image.`}
        meta={counts ? <p className="text-xs text-muted-foreground">{counts}</p> : undefined}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={locationPath(id, "ai/settings", "#images")}>
                <SlidersHorizontal aria-hidden /> Image settings
              </Link>
            </Button>
            {canEdit ? (
              <Button type="button" onClick={pick} disabled={full || uploader.uploading} aria-busy={uploader.uploading || undefined}>
                {uploader.uploading ? <Loader2 aria-hidden className="animate-spin" /> : <Upload aria-hidden />}
                {uploader.uploading ? "Uploading…" : "Upload photos"}
              </Button>
            ) : null}
          </>
        }
      >
        <SegmentedControl<View>
          aria-label="Which photos"
          value={view}
          onValueChange={setView}
          options={[
            { value: "library", label: libraryCount === null ? "Your library" : `Your library · ${COUNT.format(libraryCount)}` },
            { value: "other", label: otherCount === null ? "Other photos" : `Other photos · ${COUNT.format(otherCount)}` },
          ]}
        />
      </PageHeader>

      {canEdit ? (
        <input
          ref={fileInput}
          type="file"
          accept={PHOTO_ACCEPT}
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            // The same files can be picked again after a refusal.
            event.target.value = "";
            if (files.length > 0) upload(files);
          }}
        />
      ) : (
        <FormAlert tone="info" title={LIBRARY_READ_ONLY_TEXT}>
          You can see the photos AI posts may use for {location.name}, and which ones are kept out.
        </FormAlert>
      )}

      {view === "library" ? (
        <>
          {canEdit && library.data ? (
            full ? (
              <FormAlert tone="warning" title="Your library is full">
                It holds {COUNT.format(size?.max ?? 0)} photos, the most it can keep. Take some out to add others.
              </FormAlert>
            ) : (
              <UploadZone onPick={pick} onFiles={upload} progress={uploader.progress} />
            )
          ) : null}
          {uploader.report ? <UploadReportNotice report={uploader.report} onDismiss={uploader.dismissReport} /> : null}
          <PhotoGrid
            query={library}
            label="Photos in your library"
            render={(photo) => <LibraryPhotoCard key={photo.media_id} locationId={id} photo={photo} canEdit={canEdit} />}
            empty={
              canEdit ? (
                <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                  No photos in your library yet. Add a few above: AI posts pick the one that fits each post.
                </p>
              ) : (
                <EmptyState
                  icon={Images}
                  tone="ai"
                  title="No photos in the library yet"
                  description="Your agency adds photos of the business here. AI posts pick the one that fits each post."
                />
              )
            }
          />
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Photos uploaded in the post editor and pictures made for posts. Only photos you uploaded can join the library: AI images and post pictures
            can&apos;t.
          </p>
          <PhotoGrid
            query={other}
            label="Other photos"
            render={(photo) => <OtherPhotoCard key={photo.media_id} locationId={id} photo={photo} canEdit={canEdit} libraryFull={full} />}
            empty={<p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">No other photos.</p>}
          />
        </>
      )}
    </>
  );
}

/** A grid of photos a page at a time, with its loading, failure and empty states and "Show more". */
function PhotoGrid({
  query,
  label,
  render,
  empty,
}: {
  query: UseInfiniteQueryResult<InfiniteData<PostMediaList>>;
  label: string;
  render: (photo: PostMediaDetails) => ReactNode;
  empty: ReactNode;
}) {
  if (query.isPending) {
    return (
      <div role="status" aria-label={`Loading ${label.toLowerCase()}`} className={GRID}>
        {[0, 1, 2].map((index) => (
          <div key={index} className="overflow-hidden rounded-xl border border-border bg-card">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (query.isError && !query.data) {
    if (isNotAvailableYet(query.error)) {
      return (
        <EmptyState
          variant="unavailable"
          tone="ai"
          title="The photo library isn't available yet"
          description="Once it's switched on, the photos you add here are the first ones AI posts use."
        />
      );
    }
    return <ErrorState description="The photos couldn't be loaded. Nothing was changed." onRetry={() => void query.refetch()} />;
  }
  const photos = photosOf(query.data);
  if (photos.length === 0) return <>{empty}</>;
  const total = query.data?.pages[0]?.total ?? photos.length;
  return (
    <section aria-label={label} className="space-y-4">
      <ul className={GRID}>{photos.map(render)}</ul>
      {query.hasNextPage ? (
        <div className="flex flex-col items-center gap-1.5">
          <Button type="button" variant="outline" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
            {query.isFetchingNextPage ? <Loader2 aria-hidden className="animate-spin" /> : null}
            Show more
          </Button>
          <p className="text-xs text-muted-foreground">
            {COUNT.format(photos.length)} of {COUNT.format(total)} shown
          </p>
        </div>
      ) : null}
    </section>
  );
}

export default PhotoLibraryPage;
