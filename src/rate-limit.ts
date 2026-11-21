export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function tryConsume(
  store: Map<string, RateLimitEntry>,
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
): boolean {
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}
