/** Score statistics and the Appendix A.5 report format. */

export type ScoreStats = {
  n: number;
  histogram: number[]; // index = score 0..10
  mean: number;
  median: number;
};

export function computeStats(scores: readonly number[]): ScoreStats {
  const histogram = new Array<number>(11).fill(0);
  for (const s of scores) histogram[Math.min(10, Math.max(0, Math.round(s)))]!++;
  const sorted = [...scores].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = n === 0 ? 0 : sorted.reduce((a, b) => a + b, 0) / n;
  const median =
    n === 0 ? 0 : n % 2 === 1 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
  return { n, histogram, mean, median };
}

export function fractionAtOrAbove(scores: readonly number[], threshold: number): number {
  if (scores.length === 0) return 0;
  return scores.filter((s) => s >= threshold).length / scores.length;
}

export type SeparationTarget = {
  threshold: number;
  /** "min" means the fraction must be at least `target`; "max" means at most. */
  kind: "min" | "max";
  target: number;
};

export function formatSet(label: string, scores: readonly number[], sep: SeparationTarget): string {
  const stats = computeStats(scores);
  const head = `${label} (n=${stats.n})`.padEnd(22);
  const cells = stats.histogram.map((c) => String(c).padStart(3)).join("");
  const header =
    " ".repeat(22) + Array.from({ length: 11 }, (_, i) => String(i).padStart(3)).join("");
  const frac = fractionAtOrAbove(scores, sep.threshold);
  const pct = `${(frac * 100).toFixed(1)}%`;
  const ok = sep.kind === "min" ? frac >= sep.target : frac <= sep.target;
  const targetText = `(target ${sep.kind === "min" ? ">=" : "<="} ${(sep.target * 100).toFixed(0)}%)`;
  return [
    header,
    `${head}${cells}`,
    `  mean ${stats.mean.toFixed(1)}  median ${stats.median}   >=${sep.threshold}: ${pct.padEnd(7)} ${targetText}  ${ok ? "PASS" : "MISS"}`,
  ].join("\n");
}
