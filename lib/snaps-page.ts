/**
 * One page of the snaps feed: walks the @peak.snaps containers from a cursor
 * and keeps the replies tagged with the community, until a page is full.
 *
 * The replies of each batch of containers are fetched in parallel. Each call
 * takes ~1 s (a container holds hundreds of snaps from all of Hive), and
 * fetching them one after another made the first page take ~8 s.
 *
 * Kept free of React Native so it can be tested with fake fetchers.
 */

export interface SnapsCursor {
  permlink: string;
  date: string;
}

interface Container {
  permlink: string;
  created: string;
}

interface Reply {
  permlink: string;
  created: string;
  json_metadata?: unknown;
}

export interface SnapsPageDeps<C extends Container, R extends Reply> {
  fetchContainers: (cursor: SnapsCursor) => Promise<C[]>;
  fetchReplies: (container: C) => Promise<R[]>;
}

export interface SnapsPageOptions {
  cursor: SnapsCursor;
  /** Container and snap permlinks already loaded. */
  seen: Set<string>;
  tag: string;
  pageSize: number;
  maxBatches: number;
}

export interface SnapsPage<R> {
  snaps: R[];
  cursor: SnapsCursor;
  seen: Set<string>;
}

function hasTag(reply: Reply, tag: string): boolean {
  try {
    const metadata =
      typeof reply.json_metadata === "string" ? JSON.parse(reply.json_metadata) : reply.json_metadata;
    const tags = (metadata as { tags?: unknown })?.tags;
    return Array.isArray(tags) && tags.includes(tag);
  } catch {
    return false;
  }
}

export async function loadSnapsPage<C extends Container, R extends Reply>(
  deps: SnapsPageDeps<C, R>,
  { cursor, seen, tag, pageSize, maxBatches }: SnapsPageOptions
): Promise<SnapsPage<R>> {
  const snaps: R[] = [];
  const nextSeen = new Set(seen);
  let next = cursor;

  for (let batch = 0; batch < maxBatches && snaps.length < pageSize; batch++) {
    try {
      const containers = await deps.fetchContainers(next);
      // The cursor's own container comes back first in every call after the first.
      const fresh = containers.filter((c) => !nextSeen.has(c.permlink));
      if (fresh.length === 0) break;

      const replies = await Promise.all(fresh.map((c) => deps.fetchReplies(c)));

      fresh.forEach((container, i) => {
        nextSeen.add(container.permlink);
        const tagged = replies[i].filter((r) => hasTag(r, tag));
        tagged.forEach((r) => nextSeen.add(r.permlink));
        snaps.push(...tagged);
      });
      const last = fresh[fresh.length - 1];
      next = { permlink: last.permlink, date: last.created };
    } catch (error) {
      // Keep what loaded. The cursor stays before the failed batch, so the
      // next page retries it.
      console.error("Error fetching snaps:", error);
      break;
    }
  }

  snaps.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  return { snaps, cursor: next, seen: nextSeen };
}
