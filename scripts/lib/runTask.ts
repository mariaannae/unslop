import type { Provider, TaskDefinition } from "@unslop/shared";
import type { ResultCache } from "./resultCache";

export type TaskRunner = {
  run<P, R>(task: TaskDefinition<P, R>, payload: unknown): Promise<{ result: R; cached: boolean }>;
};

/** Same validate -> build -> complete -> parse sequence as the Worker, minus HTTP. */
export function createTaskRunner(provider: Provider, cache: ResultCache): TaskRunner {
  return {
    async run(task, input) {
      const payload = task.validatePayload(input);
      const cached = await cache.get(task.id, task.version, payload);
      if (cached !== undefined) return { result: cached as never, cached: true };
      const response = await provider.complete(task.buildRequest(payload));
      const result = task.parse(response.text, payload);
      await cache.put(task.id, task.version, payload, result);
      return { result, cached: false };
    },
  };
}
