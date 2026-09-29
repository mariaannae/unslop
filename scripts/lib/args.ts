import { parseArgs, type ParseArgsConfig } from "node:util";

export function readArgs<T extends ParseArgsConfig["options"]>(options: T) {
  return parseArgs({ options, allowPositionals: false, strict: true }).values;
}

export function intArg(value: string | undefined, fallback: number): number {
  const n = value === undefined ? NaN : Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}
