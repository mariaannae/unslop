import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";
import { gameConfig } from "./config";
import {
  createGame,
  type CheckOutcome,
  type CheckRecord,
  type GamePhase,
  type ScorerOption,
} from "./game";
import {
  segments,
  tellAt,
  tellLabel,
  trackTells,
  type Segment,
  type TrackedTell,
} from "./feedback";

/**
 * The whole screen. Builds the game from config once, subscribes to its store,
 * and renders it.
 *
 * Single-column, mobile-first layout. The action bar is `sticky` inside the
 * flex column rather than `fixed`, so iOS keeps it attached to the content
 * when the keyboard opens instead of floating it mid-screen.
 */
export function App() {
  const game = useMemo(() => createGame(gameConfig), []);
  const state = useSyncExternalStore(game.subscribe, game.getState, game.getState);
  const [showOriginal, setShowOriginal] = useState(false);
  // A tell lights up while hovered or focused in the list, stays lit once tapped
  // (until the cursor moves in the passage), or when the cursor is inside it.
  const [hoverTell, setHoverTell] = useState<number | null>(null);
  const [pickedTell, setPickedTell] = useState<number | null>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const outcomeRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorHandle>(null);

  const checksLeft = state.checksPerPuzzle - state.checksUsed;
  const loading = state.phase === "loading";
  const checking = state.phase === "checking";
  const canCheck = state.phase === "playing" && checksLeft > 0;
  const editable = state.phase === "playing";
  const over = state.phase === "won" || state.phase === "lost";
  const edited = state.passage !== null && state.current !== state.passage.text;

  // The last Check's tells, found again in the text as it is edited (spec B.43).
  // Practice mode only, and not once the puzzle is won.
  const last = state.checks.at(-1);
  const showTells = state.mode === "practice";
  const highlight = showTells && state.phase !== "won";
  const tells = useMemo(
    () => (last ? trackTells(last.text, last.outcome.score.tells ?? [], state.current) : []),
    [last, state.current],
  );
  const caretTell = caret === null ? null : tellAt(tells, caret);
  const activeTell = hoverTell ?? pickedTell ?? caretTell;
  const anyTracked = highlight && tells.some((t) => t.tracked && !t.edited);

  useEffect(() => {
    setHoverTell(null);
    setPickedTell(null);
  }, [last]);

  useEffect(() => {
    if (game.getState().phase === "loading" && game.getState().passage === null) {
      void game.newPassage();
    }
  }, [game]);

  useEffect(() => {
    if (state.outcome || state.error) {
      outcomeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [state.outcome, state.error]);

  function onNewPassage() {
    const discarding = state.phase === "playing" && edited && state.checksUsed > 0;
    if (discarding && !window.confirm("Discard this puzzle and draw a new passage?")) return;
    void game.newPassage();
  }

  function onScorerChange(id: string) {
    const discarding = state.phase === "playing" && (edited || state.checksUsed > 0);
    if (discarding && !window.confirm("Switching the judge restarts this passage. Continue?")) {
      return;
    }
    game.setScorer(id);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-white font-sans text-neutral-900">
      <header className="flex items-baseline justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <h1 className="text-xl font-semibold tracking-tight">UNSLOP</h1>
        <p className="text-sm text-neutral-600" aria-live="polite">
          Checks left: <span className="font-semibold text-neutral-900">{checksLeft}</span> /{" "}
          {state.checksPerPuzzle}
        </p>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 pb-6">
        <ScorerMenu
          options={gameConfig.scorers}
          value={state.scorerId}
          disabled={checking}
          onChange={onScorerChange}
        />

        <p className="text-sm text-neutral-600">
          Edit this passage until it no longer reads like an AI wrote it. Keep the meaning.
          {state.passage?.topic ? (
            <>
              {" "}
              Topic: <span className="italic">{state.passage.topic}</span>.
            </>
          ) : null}
        </p>

        {loading ? (
          <div
            role="status"
            className="min-h-56 animate-pulse rounded-md border border-neutral-200 bg-neutral-100 p-3 text-sm text-neutral-500"
          >
            Loading passage…
          </div>
        ) : (
          <PassageEditor
            ref={editorRef}
            value={state.current}
            disabled={!editable}
            segments={highlight && tells.length > 0 ? segments(state.current, tells) : null}
            active={highlight ? activeTell : null}
            onChange={(text) => game.setCurrent(text)}
            onCaret={(position) => {
              setCaret(position);
              if (position !== null) setPickedTell(null);
            }}
          />
        )}

        {anyTracked ? (
          <p className="-mt-2 min-h-5 text-sm text-amber-900">
            {caretTell !== null ? (
              <>↳ {tellLabel(tells[caretTell]!.tell.label)}</>
            ) : (
              <span className="text-neutral-500">
                Highlights mark the judge&apos;s tells. Tap one to see which.
              </span>
            )}
          </p>
        ) : null}

        {state.passage ? (
          <details
            className="text-sm"
            open={showOriginal}
            onToggle={(e) => setShowOriginal(e.currentTarget.open)}
          >
            <summary className="cursor-pointer select-none py-2 text-neutral-600">
              {showOriginal ? "Hide original" : "Show original"}
            </summary>
            <blockquote className="mt-1 rounded-md border border-neutral-200 bg-neutral-50 p-3 font-serif leading-relaxed text-neutral-700">
              {state.passage.text}
            </blockquote>
          </details>
        ) : null}

        <div ref={outcomeRef} className="scroll-mt-4">
          <OutcomePanel
            phase={state.phase}
            outcome={state.outcome}
            last={last}
            error={state.error}
            tells={showTells ? tells : []}
            activeTell={activeTell}
            onTellHover={setHoverTell}
            onTellPick={(i) => {
              const unpick = pickedTell === i;
              setPickedTell(unpick ? null : i);
              if (!unpick) editorRef.current?.reveal(i);
            }}
          />
        </div>
      </main>

      <footer className="sticky bottom-0 border-t border-neutral-200 bg-white/95 backdrop-blur">
        <div className="flex gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => void game.check()}
            disabled={!canCheck || checking}
            aria-busy={checking}
            className="min-h-12 flex-1 rounded-lg bg-neutral-900 px-4 py-3 text-base font-semibold text-white active:bg-neutral-700 disabled:bg-neutral-300"
          >
            {checking ? "Checking…" : "Check"}
          </button>
          <button
            type="button"
            onClick={onNewPassage}
            disabled={loading || checking}
            className={
              "min-h-12 rounded-lg border px-4 py-3 text-base font-semibold disabled:opacity-50 " +
              (over
                ? "flex-1 border-neutral-900 bg-neutral-900 text-white active:bg-neutral-700"
                : "border-neutral-300 bg-white text-neutral-900 active:bg-neutral-100")
            }
          >
            New passage
          </button>
        </div>
      </footer>
    </div>
  );
}

/**
 * Picks the scorer. The options and their order come from config; the engine
 * restarts the passage on a switch. text-base keeps iOS from zooming on focus.
 */
function ScorerMenu(props: {
  options: readonly ScorerOption[];
  value: string;
  disabled: boolean;
  onChange(id: string): void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-600">
      Judge
      <select
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
        className="min-h-10 rounded-md border border-neutral-300 bg-white px-2 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none disabled:opacity-50"
      >
        {props.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type EditorHandle = {
  /** Scrolls the passage to this tell's first highlight and brings the editor into view. */
  reveal(tell: number): void;
};

/**
 * What the text and its highlight copy share, so both lay out the same lines.
 * Kerning and ligatures are off because WebKit does not apply them across the
 * copy's highlight boundaries, which shifted the rest of a line by a pixel or so
 * and could wrap it differently.
 */
const PASSAGE_LAYOUT =
  "p-3 font-serif text-base leading-relaxed [font-kerning:none] [font-variant-ligatures:none] [scrollbar-gutter:stable]";

/**
 * A plain textarea, per spec §4, over a copy of its text that draws the tell
 * highlights (spec B.43). The copy sits behind a transparent textarea with
 * transparent text of its own, so only the highlight colour shows through. The
 * two must wrap identically: same padding, font, and scrollbar gutter.
 */
function PassageEditor(props: {
  ref: Ref<EditorHandle>;
  value: string;
  disabled: boolean;
  /** The text split into highlight runs, or null to draw none. */
  segments: Segment[] | null;
  /** The tell to draw stronger. */
  active: number | null;
  onChange(text: string): void;
  onCaret(position: number | null): void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Keep the copy scrolled with the textarea, including when it first appears.
  const syncScroll = () => {
    if (backdropRef.current && textareaRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };
  useLayoutEffect(syncScroll);

  useImperativeHandle(props.ref, () => ({
    reveal(tell) {
      const mark = backdropRef.current?.querySelector<HTMLElement>(`mark[data-tells~="${tell}"]`);
      const textarea = textareaRef.current;
      if (!mark || !textarea) return;
      textarea.scrollTop = Math.max(0, mark.offsetTop - textarea.clientHeight / 3);
      syncScroll();
      wrapperRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
  }));

  return (
    <div
      ref={wrapperRef}
      className={
        "relative rounded-md border border-neutral-300 focus-within:border-neutral-900 " +
        (props.disabled ? "bg-neutral-100" : "bg-white")
      }
    >
      {props.segments ? (
        <div
          ref={backdropRef}
          aria-hidden
          className={`pointer-events-none absolute inset-0 overflow-hidden break-words whitespace-pre-wrap text-transparent ${PASSAGE_LAYOUT}`}
        >
          {props.segments.map((s) =>
            s.tells.length === 0 ? (
              s.text
            ) : (
              <mark
                key={s.start}
                data-tells={s.tells.join(" ")}
                className={
                  "box-decoration-clone rounded-sm text-transparent " +
                  (props.active !== null && s.tells.includes(props.active)
                    ? "bg-amber-300"
                    : s.tells.length > 1
                      ? "bg-amber-200"
                      : "bg-amber-100")
                }
              >
                {s.text}
              </mark>
            ),
          )}
          {/* A trailing newline only makes a line once something follows it. */}
          {props.value.endsWith("\n") ? " " : null}
        </div>
      ) : null}
      <textarea
        ref={textareaRef}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
        onSelect={(e) => props.onCaret(e.currentTarget.selectionStart)}
        onBlur={() => props.onCaret(null)}
        onScroll={syncScroll}
        aria-label="Passage"
        rows={10}
        spellCheck
        autoCapitalize="sentences"
        className={`relative block min-h-56 w-full resize-y rounded-md bg-transparent text-neutral-900 focus:outline-none disabled:text-neutral-500 ${PASSAGE_LAYOUT}`}
      />
    </div>
  );
}

/**
 * Renders whatever the engine reported: guardrail feedback, score, tells, and
 * win/loss. Guardrail messages come from the latest Check; the score and tells
 * from the last one that was scored, so a refused Check does not hide them.
 */
function OutcomePanel(props: {
  phase: GamePhase;
  outcome: CheckOutcome | null;
  last: CheckRecord | undefined;
  error: string | null;
  tells: TrackedTell[];
  activeTell: number | null;
  onTellHover(tell: number | null): void;
  onTellPick(tell: number): void;
}) {
  const { phase, outcome, last, error } = props;
  if (error) {
    return (
      <section
        role="alert"
        className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800"
      >
        <p className="font-semibold">Check failed, no check used.</p>
        <p>{error}</p>
      </section>
    );
  }

  if (!outcome) return null;

  const failed = outcome.guardrails.filter((g) => !g.result.pass);

  return (
    <section aria-live="polite" className="flex flex-col gap-3">
      {phase === "won" ? (
        <p className="rounded-md bg-green-100 p-3 text-base font-semibold text-green-900">
          You did it. The judge no longer thinks this reads as AI.
        </p>
      ) : phase === "lost" ? (
        <p className="rounded-md bg-neutral-200 p-3 text-base font-semibold text-neutral-900">
          Out of checks. Try a new passage.
        </p>
      ) : null}

      {failed.length > 0 ? (
        <ul className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {failed.map((g) => (
            <li key={g.id}>{g.result.reason ?? `Blocked by ${g.id}.`}</li>
          ))}
        </ul>
      ) : null}

      {last ? <ScoreMeter score={last.outcome.score.score} /> : null}

      {props.tells.length > 0 ? (
        <TellList
          tells={props.tells}
          active={props.activeTell}
          onHover={props.onTellHover}
          onPick={props.onTellPick}
        />
      ) : null}
    </section>
  );
}

/**
 * The last Check's tells. A tell whose phrase is still in the passage is a button
 * that lights the phrase up (hover or focus) and scrolls to it (tap). One whose
 * phrase has been edited away is crossed off, though only the next Check can say
 * whether the judge agrees.
 */
function TellList(props: {
  tells: TrackedTell[];
  active: number | null;
  onHover(tell: number | null): void;
  onPick(tell: number): void;
}) {
  const tracked = props.tells.filter((t) => t.tracked).length;
  const edited = props.tells.filter((t) => t.edited).length;
  const row = "-mx-1 flex flex-wrap items-baseline gap-x-2 rounded px-1 py-0.5 text-left";
  return (
    <div className="text-sm">
      <p className="mb-1 font-semibold">
        Tells
        {tracked > 0 ? (
          <span className="font-normal text-neutral-600">
            {" "}
            · {edited} of {tracked} edited
          </span>
        ) : null}
      </p>
      <ul className="flex flex-col gap-0.5">
        {props.tells.map((t, i) => {
          const body = (
            <>
              <span className="rounded bg-neutral-200 px-1.5 text-xs leading-5 text-neutral-700">
                {tellLabel(t.tell.label)}
              </span>
              {t.tell.quote ? (
                <q className={t.edited ? "text-neutral-400 line-through" : "text-neutral-800"}>
                  {t.tell.quote}
                </q>
              ) : null}
              {t.edited ? (
                <span className="text-xs text-neutral-500">edited, check to confirm</span>
              ) : null}
            </>
          );
          return (
            <li key={i}>
              {t.tracked && !t.edited ? (
                <button
                  type="button"
                  onMouseEnter={() => props.onHover(i)}
                  onMouseLeave={() => props.onHover(null)}
                  onFocus={() => props.onHover(i)}
                  onBlur={() => props.onHover(null)}
                  onClick={() => props.onPick(i)}
                  className={`${row} w-full ${props.active === i ? "bg-amber-100" : "hover:bg-neutral-100"}`}
                >
                  {body}
                </button>
              ) : (
                <div className={row}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const MAX_SCORE = 10;

/** 0–10 meter. Presentation only; the win threshold lives in config, not here. */
function ScoreMeter({ score }: { score: number }) {
  const pct = Math.round((Math.max(0, Math.min(MAX_SCORE, score)) / MAX_SCORE) * 100);
  return (
    <div className="text-sm">
      <div className="mb-1 flex justify-between">
        <span className="font-semibold">AI-likeness</span>
        <span>
          {score} / {MAX_SCORE}
        </span>
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={MAX_SCORE}
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
