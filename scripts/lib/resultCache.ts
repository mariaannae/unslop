import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { canonicalJson } from "@unslop/shared";

/**
 * Disk cache of parsed task results under scripts/.cache/results, keyed like the
 * Worker's KV cache (task id, task version, payload hash). Re-running the harness
 * while tuning costs nothing until the task version is bumped.
 */
export interface ResultCache {
  get(taskId: string, version: number, payload: unknown): Promise<unknown | undefined>;
  put(taskId: string, version: number, payload: unknown, result: unknown): Promise<void>;
}

export function createDiskCache(root: string): ResultCache {
  const file = (taskId: string, version: number, payload: unknown) => {
    const hash = createHash("sha256").update(canonicalJson(payload)).digest("hex");
    return path.join(root, `${taskId}@${version}`, `${hash}.json`);
  };
  return {
    async get(taskId, version, payload) {
      try {
        return JSON.parse(await readFile(file(taskId, version, payload), "utf8")) as unknown;
      } catch {
        return undefined;
      }
    },
    async put(taskId, version, payload, result) {
      const target = file(taskId, version, payload);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, JSON.stringify(result));
    },
  };
}

export const noCache: ResultCache = {
  async get() {
    return undefined;
  },
  async put() {},
};
