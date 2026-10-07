/**
 * Long AI routes (text generation, correction) stream their progress to the
 * loading screen as newline-delimited JSON:
 *   {"type":"progress","value":0.42}   — 0 to 1, never decreasing
 *   {"type":"done","status":200,"body":{…}}   — the route's actual response
 * Errors detected before the AI work starts (auth, quota, validation) are
 * still answered as plain JSON with their HTTP status; fetchWithProgress
 * handles both.
 */

export type ReportProgress = (value: number) => void;

type Outcome = { status: number; body: unknown };

/** Server side: runs `work`, streaming its progress reports, then its outcome. */
export function progressResponse(work: (report: ReportProgress) => Promise<Outcome>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let last = 0;
      const send = (line: object) => controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
      const report: ReportProgress = (value) => {
        const clamped = Math.min(1, Math.max(last, value));
        // Only meaningful moves (≥ 0.5 %) are worth a line.
        if (clamped - last < 0.005) return;
        last = clamped;
        send({ type: "progress", value: Math.round(clamped * 1000) / 1000 });
      };
      try {
        const outcome = await work(report);
        send({ type: "done", ...outcome });
      } catch (error) {
        console.error("streamed route error", error);
        send({ type: "done", status: 500, body: { error: "Une erreur est survenue." } });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
  });
}

/** Maps a sub-task's 0–1 progress onto [from, to] of the overall bar. */
export function scaledProgress(report: ReportProgress | undefined, from: number, to: number) {
  return (value: number) => report?.(from + (to - from) * value);
}

/** Client side: fetches a progress-streaming route; resolves with the body of
 * a successful response, throws with the route's error message otherwise. */
export async function fetchWithProgress<T>(
  url: string,
  init: RequestInit,
  onProgress: ReportProgress
): Promise<T> {
  const res = await fetch(url, init);
  const fail = (body: unknown): never => {
    const message = (body as { error?: string } | null)?.error;
    throw new Error(message ?? "Une erreur est survenue.");
  };

  if (!res.headers.get("Content-Type")?.includes("application/x-ndjson") || !res.body) {
    const data = await res.json().catch(() => null);
    if (!res.ok) fail(data);
    return data as T;
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const event = JSON.parse(line) as
        | { type: "progress"; value: number }
        | { type: "done"; status: number; body: unknown };
      if (event.type === "progress") onProgress(event.value);
      else if (event.status >= 400) fail(event.body);
      else {
        onProgress(1);
        return event.body as T;
      }
    }
  }
  throw new Error("La connexion a été interrompue. Réessayez.");
}
