/**
 * The photo library's data (Phase 25c): the library and the location's other photos, a page at a time; uploads to
 * the library; and changes of one photo (caption, "Use anyway", in or out of the library).
 *
 * The keys sit under the posts' media key (`[...postsKey(id), "media"]`, the post editor's gallery), so a change
 * here refreshes the editor's photos and an upload there refreshes the library. Library changes move the readiness
 * checklist (usable photos), so it is read again too. A recent upload still being checked is read again every few
 * seconds until its screening lands.
 */
import { useEffect, useRef } from "react";
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { getPostMedia, updatePostMedia, uploadPostMedia, type PostMediaDetails, type PostMediaList, type PostMediaPatch } from "@/api";
import { invalidateAiReadiness } from "@/lib/ai-readiness/use-readiness";
import { postsKey } from "@/lib/posts/use-posts";
import { LIBRARY_PAGE_SIZE, hasFreshPending, isPending } from "./library";

/** How often a recent upload still being checked is read again. */
export const SCREENING_POLL_MS = 4_000;

/** The post editor's gallery key: every photo list of the location starts with it. */
export const locationMediaKey = (locationId: string) => [...postsKey(locationId), "media"] as const;

/** The library (`library: true`) or the location's other photos (`false`). */
export const libraryPhotosKey = (locationId: string, library: boolean) => [...locationMediaKey(locationId), "library", library] as const;

export const photosOf = (data: InfiniteData<PostMediaList> | undefined): PostMediaDetails[] => (data?.pages ?? []).flatMap((page) => page.media ?? []);

/**
 * The library (`library: true`) or the location's other photos (`false`), a page at a time. While a recent upload is
 * being checked the library is read again every few seconds; when a screening lands, the readiness checklist is read
 * again too (its usable photos moved). (`useLibraryPhotos` in `use-posts.ts` is the post editor's whole-library read.)
 */
export function usePhotoList(locationId: string, library: boolean, enabled = true) {
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: libraryPhotosKey(locationId, library),
    queryFn: ({ pageParam, signal }) => getPostMedia(locationId, pageParam, LIBRARY_PAGE_SIZE, signal, { library }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
    enabled,
    retry: false,
    refetchInterval: (state) => (library && hasFreshPending(photosOf(state.state.data), Date.now()) ? SCREENING_POLL_MS : false),
  });
  const pending = library ? photosOf(query.data).filter(isPending).length : 0;
  const wasPending = useRef(pending);
  useEffect(() => {
    if (pending < wasPending.current) invalidateAiReadiness(queryClient, locationId);
    wasPending.current = pending;
  }, [pending, queryClient, locationId]);
  return query;
}

/** The pages with one photo replaced (a caption or a "Use anyway" saved). */
function withPhoto(data: InfiniteData<PostMediaList> | undefined, photo: PostMediaDetails): InfiniteData<PostMediaList> | undefined {
  if (!data) return data;
  return { ...data, pages: data.pages.map((page) => ({ ...page, media: page.media.map((item) => (item.media_id === photo.media_id ? { ...item, ...photo } : item)) })) };
}

export function useLibraryMutations(locationId: string) {
  const queryClient = useQueryClient();
  /** Every photo list of the location, and the checklist. */
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: locationMediaKey(locationId) });
    invalidateAiReadiness(queryClient, locationId);
  };

  /** One file into the library; the page uploads several one after the other, then calls `refresh`. */
  const upload = useMutation({ mutationFn: (file: File) => uploadPostMedia(locationId, file, { library: true }) });

  const patch = useMutation({
    mutationFn: ({ mediaId, change }: { mediaId: string; change: PostMediaPatch }) => updatePostMedia(locationId, mediaId, change),
    onSuccess: (photo, { change }) => {
      if (photo && typeof photo === "object" && photo.media_id && change.library === undefined) {
        for (const library of [true, false]) {
          queryClient.setQueryData<InfiniteData<PostMediaList>>(libraryPhotosKey(locationId, library), (data) => withPhoto(data, photo));
        }
      }
      refresh();
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: locationMediaKey(locationId) });
    },
  });

  return { upload, patch, refresh };
}
