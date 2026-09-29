import path from "node:path";
import { fileURLToPath } from "node:url";

export const scriptsDir = path.dirname(fileURLToPath(import.meta.url)).replace(/\/lib$/, "");
export const repoRoot = path.resolve(scriptsDir, "..");
export const dataDir = path.join(repoRoot, "data");
export const cacheDir = path.join(scriptsDir, ".cache");
