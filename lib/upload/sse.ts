// Reading the transcoder's progress, which is a long-lived Server-Sent Events
// stream (text/event-stream) that stays open while the job runs.
//
// React Native's fetch() only resolves the body when the stream ends, so the
// old poll (fetch + text()) never saw a single event. XMLHttpRequest with an
// onprogress handler set before send() does deliver the body incrementally on
// both platforms, so we read the stream through it.

/** Incremental SSE parser: feed it chunks, get each event's `data` payload. */
export function createSseParser(onData: (data: string) => void): (chunk: string) => void {
  let buffer = "";
  return (chunk: string) => {
    buffer += chunk.replace(/\r\n?/g, "\n");
    let end = buffer.indexOf("\n\n");
    while (end >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n");
      if (data) onData(data);
      end = buffer.indexOf("\n\n");
    }
  };
}

export interface FollowOptions {
  /** Reopen the stream this many times if the server closes it early. */
  maxReopens?: number;
  reopenDelayMs?: number;
}

/**
 * Follows an SSE endpoint until the returned `close` is called. A stream the
 * server ends early is reopened a few times, then left closed: no endless
 * polling that yields nothing.
 */
export function followEventStream(
  url: string,
  onData: (data: string) => void,
  { maxReopens = 3, reopenDelayMs = 2_000 }: FollowOptions = {},
): () => void {
  let closed = false;
  let reopens = 0;
  let xhr: XMLHttpRequest | null = null;
  let reopenTimer: ReturnType<typeof setTimeout> | null = null;

  const open = () => {
    if (closed) return;
    const parse = createSseParser(onData);
    let seen = 0;
    const request = new XMLHttpRequest();
    xhr = request;
    const drain = () => {
      const text = request.responseText ?? "";
      if (text.length > seen) {
        parse(text.slice(seen));
        seen = text.length;
      }
    };
    const ended = () => {
      drain();
      if (closed || reopens >= maxReopens) return;
      reopens += 1;
      reopenTimer = setTimeout(open, reopenDelayMs);
    };
    // Handlers must be set before send() for incremental delivery.
    request.onprogress = drain;
    request.onload = ended;
    request.onerror = ended;
    request.open("GET", url);
    request.setRequestHeader("Accept", "text/event-stream");
    request.setRequestHeader("Cache-Control", "no-cache");
    request.send();
  };

  open();
  return () => {
    closed = true;
    if (reopenTimer) clearTimeout(reopenTimer);
    xhr?.abort();
  };
}
