type Props = { score: number };

const MAX = 10;

/** 0–10 meter. Presentation only; the win threshold lives in config, not here. */
export function ScoreMeter({ score }: Props) {
  const pct = Math.round((Math.max(0, Math.min(MAX, score)) / MAX) * 100);
  return (
    <div className="text-sm">
      <div className="mb-1 flex justify-between">
        <span className="font-semibold">AI-likeness</span>
        <span>
          {score} / {MAX}
        </span>
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={MAX}
        aria-valuenow={score}
        className="h-3 w-full overflow-hidden rounded-full bg-neutral-200"
      >
        <div className="h-full bg-neutral-900 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-neutral-500">
        <span>human</span>
        <span>AI</span>
      </div>
    </div>
  );
}
