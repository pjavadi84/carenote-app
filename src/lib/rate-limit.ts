// Sliding-window rate limiter. In-memory Map keyed by caller-supplied
// string (IP, token, etc.). Good enough for a single Next.js server;
// if we ever need multi-region scale, swap the backing Map for Upstash
// Redis behind the same interface.
//
// Entries are pruned lazily on access — checkRate is the only code
// path that writes to the map, so we don't need a background sweeper.

type Hit = { timestamps: number[] };

const buckets = new Map<string, Hit>();
const MAX_TRACKED_KEYS = 10_000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function checkRate(
  key: string,
  max: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  const cutoff = now - windowMs;
  const bucket = buckets.get(key);

  const fresh: number[] = bucket
    ? bucket.timestamps.filter((t) => t > cutoff)
    : [];

  if (fresh.length >= max) {
    // Oldest hit's age tells the caller when they can retry.
    const oldest = fresh[0]!;
    const retryAfterMs = Math.max(1, oldest + windowMs - now);
    if (bucket) {
      bucket.timestamps = fresh;
    }
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  fresh.push(now);
  if (bucket) {
    bucket.timestamps = fresh;
  } else {
    if (buckets.size >= MAX_TRACKED_KEYS) {
      // Basic LRU-ish eviction: drop the first entry we walk into.
      // Good enough for abuse prevention; accurate eviction isn't the point.
      const firstKey = buckets.keys().next().value;
      if (firstKey !== undefined) buckets.delete(firstKey);
    }
    buckets.set(key, { timestamps: fresh });
  }
  return {
    allowed: true,
    remaining: Math.max(0, max - fresh.length),
    retryAfterMs: 0,
  };
}

// Exposed for tests so we don't leak state across test runs.
export function _resetRateLimitBucketsForTests(): void {
  buckets.clear();
}
