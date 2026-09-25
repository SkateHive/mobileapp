// Submit a skate spot to Hive. A spot is a normal snap (comment under the
// peak.snaps container) tagged "skatespot" with a canonical body the spotmap
// sync knows how to parse. Mirrors the web composer so the existing sync picks
// it up unchanged.

import { getLastSnapsContainer, COMMUNITY_TAG } from "~/lib/hive-utils";
import { postComment } from "~/lib/posting";
import { t } from "~/lib/i18n";
import type { AuthSession } from "~/lib/types";

export interface SpotMedia {
  /** Markdown image lines and/or video iframes already uploaded, in order. */
  imageUrls: string[];
  videoIframes: string[];
}

export interface SubmitSpotInput {
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
  description?: string;
  media: SpotMedia;
}

export interface SubmitSpotResult {
  author: string;
  permlink: string;
}

const SPOT_TAG = "skatespot";

function generateSpotPermlink(): string {
  const ts = new Date().toISOString().replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  // Append a short random suffix so two spots created in the same second by the
  // same account don't collide on the permlink (Hive rejects duplicates).
  const rand = Math.random().toString(36).slice(2, 8);
  return `skatespot-${ts.substring(0, 15)}-${rand}`;
}

/**
 * Build the canonical spot body the spotmap parser expects:
 *
 *   Spot Name: <name>
 *   🌐 <lat>, <lng> (<address>)
 *
 *   <description>
 *
 *   ![spot](image-url)
 *   <iframe ...></iframe>
 */
export function buildSpotBody(input: SubmitSpotInput): string {
  const { name, lat, lng, address, description, media } = input;
  const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  const locationLine = address ? `🌐 ${coords} (${address})` : `🌐 ${coords}`;

  const parts: string[] = [`Spot Name: ${name.trim()}`, locationLine];

  const desc = description?.trim();
  if (desc) parts.push("", desc);

  const mediaLines = [...media.imageUrls, ...media.videoIframes];
  if (mediaLines.length > 0) parts.push("", mediaLines.join("\n"));

  return parts.join("\n");
}

/**
 * Broadcast the spot snap. Returns the author + permlink so the caller can
 * optimistically pin it and trigger the targeted server sync.
 */
export async function submitSpot(
  session: AuthSession,
  input: SubmitSpotInput
): Promise<SubmitSpotResult> {
  // Post under the latest snaps container so the spotmap sync's
  // parent_permlink filter matches (same as the web composer). If the container
  // lookup fails we must abort: a top-level post (parent_author="") would carry
  // the tag but NOT match the sync's parent_permlink filter, so it would never
  // be ingested — and the caller would falsely report success.
  let parentAuthor: string;
  let parentPermlink: string;
  try {
    const container = await getLastSnapsContainer();
    parentAuthor = container.author;
    parentPermlink = container.permlink;
  } catch (err) {
    throw new Error(t("map.create.error.hive_unreachable"));
  }

  const permlink = generateSpotPermlink();
  const body = buildSpotBody(input);
  const jsonMetadata = {
    app: "mycommunity-mobile",
    tags: [COMMUNITY_TAG, SPOT_TAG],
  };

  // Routes through the unified posting seam: server-signed via @skateuser for
  // lite accounts, or the local key for full Hive accounts.
  const res = await postComment(session, {
    parentAuthor,
    parentPermlink,
    permlink,
    title: "",
    body,
    jsonMetadata,
  });

  return { author: res.author, permlink: res.permlink || permlink };
}
