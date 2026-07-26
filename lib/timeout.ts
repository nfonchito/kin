// Guards against a hung backend. Supabase free-tier projects pause after ~7
// days idle; without a ceiling the auth check can stall and the whole page
// hangs instead of failing fast.

export const DB_TIMEOUT_MS = 4000;

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: PromiseLike<T>, ms = DB_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

// True when a failure means "the database isn't reachable" rather than
// "this user isn't signed in". supabase-js returns network problems as an
// error object (often AuthRetryableFetchError) instead of throwing, so the
// shape has to be sniffed rather than caught.
export function isUnreachable(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof TimeoutError) return true;

  const e = err as { name?: string; message?: string; status?: number };
  const name = String(e.name ?? "");
  const message = String(e.message ?? "").toLowerCase();

  if (name === "TimeoutError" || name === "AuthRetryableFetchError") return true;
  if (e.status === 0 || e.status === 502 || e.status === 503 || e.status === 504) return true;

  return [
    "fetch failed",
    "failed to fetch",
    "network",
    "enotfound",
    "getaddrinfo",
    "econnrefused",
    "econnreset",
    "etimedout",
    "timed out",
    "socket hang up",
  ].some((needle) => message.includes(needle));
}
