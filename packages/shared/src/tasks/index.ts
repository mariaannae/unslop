import type { TaskDefinition } from "./types";
import { scoreV1Task } from "./scoreV1";

export * from "./scoreV1";
export * from "./generateV1";

/**
 * Tasks the Worker is allowed to execute. Anything not listed here is rejected
 * with `unknown_task`. Script-only tasks (for example `generate-v1`) must not be
 * registered here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTask = TaskDefinition<any, any>;

export const callableTasks: ReadonlyMap<string, AnyTask> = new Map<string, AnyTask>([
  [scoreV1Task.id, scoreV1Task],
]);

export function getCallableTask(taskId: string): AnyTask | undefined {
  return callableTasks.get(taskId);
}
