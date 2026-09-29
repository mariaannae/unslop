import { canonicalJson } from "@unslop/shared";
import type { KvStore } from "./kv";

export interface TaskCache {
  get(key: string): Promise<unknown | undefined>;
  put(key: string, value: unknown): Promise<void>;
}

/**
 * Cache key = task id + task version + SHA-256 of the canonical payload.
 * Bumping a task's version therefore invalidates every cached result for it.
 */
export async function buildCacheKey(
  taskId: string,
  version: number,
  payload: unknown,
): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return `task:${taskId}@${version}:${hex}`;
}

export function createKvTaskCache(kv: KvStore, ttlSeconds: number): TaskCache {
  return {
    async get(key) {
      const stored = await kv.get(key);
      if (stored === null) return undefined;
      try {
        return JSON.parse(stored) as unknown;
      } catch {
        // A corrupt entry is treated as a miss and overwritten on the next put.
        return undefined;
      }
    },
    async put(key, value) {
      await kv.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
    },
  };
}
