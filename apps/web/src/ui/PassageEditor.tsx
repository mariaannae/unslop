type Props = {
  value: string;
  disabled: boolean;
  onChange(text: string): void;
};

/** A plain textarea, per spec §4. Swap this component for a richer editor later. */
export function PassageEditor({ value, disabled, onChange }: Props) {
  return (
    <textarea
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Passage"
      rows={10}
      spellCheck
      autoCapitalize="sentences"
      className="min-h-56 w-full resize-y rounded-md border border-neutral-300 bg-white p-3 font-serif text-base leading-relaxed text-neutral-900 focus:border-neutral-900 focus:outline-none disabled:bg-neutral-100 disabled:text-neutral-500"
    />
  );
}
