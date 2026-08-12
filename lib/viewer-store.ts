import { useSyncExternalStore } from "react";

/**
 * The post list handed to the immersive viewer route.
 *
 * The viewer used to be a Modal rendered inside the profile, which made this a
 * prop. As a route it can't be: route params are serialised strings, and this
 * carries a loaded page of posts plus the callback that fetches the next one.
 *
 * Refetching in the route instead was the obvious alternative and the wrong
 * one — useUserComments keeps its pagination in local state, so a second copy
 * would start from page one and its indices would no longer line up with the
 * grid the user just tapped.
 */
export interface ViewerPayload {
  posts: any[];
  initialIndex: number;
  hasMore: boolean;
  onLoadMore: () => void;
}

let payload: ViewerPayload | null = null;
const listeners = new Set<() => void>();

export function setViewerPayload(next: ViewerPayload | null) {
  payload = next;
  listeners.forEach((l) => l());
}

/**
 * Keep an open viewer's list current as the profile pages in more posts.
 *
 * Without this the payload is a photograph taken when the tile was tapped: the
 * viewer asks for more, the profile fetches it, and nothing ever reaches the
 * viewer — endless scrolling that silently stops. A no-op when the viewer isn't
 * open, so the profile can call it freely.
 */
export function updateViewerPosts(posts: any[], hasMore: boolean) {
  if (!payload) return;
  if (payload.posts === posts && payload.hasMore === hasMore) return;
  payload = { ...payload, posts, hasMore };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useViewerPayload(): ViewerPayload | null {
  return useSyncExternalStore(
    subscribe,
    () => payload,
    () => payload
  );
}
