/**
 * The slice of Cloudflare's KVNamespace the Worker actually uses.
 * Tests substitute an in-memory implementation.
 */
export interface KvStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}
