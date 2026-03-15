# Helper Scripts for Media Debugging

To debug media rendering and identify problematic patterns in the Hive feed (snaps and posts), use the following scripts:

### [debug-feed.ts](file:///home/adam/Projects/skatehive/monorepo/mobileapp-skatehive/scripts/debug-feed.ts)
Fetches recent blog posts for a specific user and analyzes the raw markdown for media patterns (Odysee, IPFS, YouTube).

### [debug-snaps-specific.ts](file:///home/adam/Projects/skatehive/monorepo/mobileapp-skatehive/scripts/debug-snaps-specific.ts)
Specifically fetches "Snaps" (comments) using the `get_discussions_by_comments` API. This is crucial for debugging the Snaps feed since they are comments inside containers, not top-level posts.

**Usage:**
```bash
npx tsx scripts/debug-snaps-specific.ts
```

### [debug-problematic.ts](file:///home/adam/Projects/skatehive/monorepo/mobileapp-skatehive/scripts/debug-problematic.ts)
A temporary focus script to analyze specific authors like `@skaters` or `@nogenta` who are known to have complex media embeds.
