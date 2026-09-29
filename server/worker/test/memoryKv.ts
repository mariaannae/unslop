import type { KvStore } from "../src/kv";

/** In-memory KvStore with TTL support driven by an injectable clock. */
export function createMemoryKv(clock: () => number = Date.now): KvStore & {
  entries: Map<string, { value: string; expiresAt?: number }>;
} {
  const entries = new Map<string, { value: string; expiresAt?: number }>();
  return {
    entries,
    async get(key) {
      const entry = entries.get(key);
      if (!entry) return null;
      if (entry.expiresAt !== undefined && entry.expiresAt <= clock()) {
        entries.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(key, value, options) {
      entries.set(key, {
        value,
        expiresAt: options?.expirationTtl ? clock() + options.expirationTtl * 1000 : undefined,
      });
    },
  };
}
