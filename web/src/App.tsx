import {
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type Ref,
} from "react";
import { gameConfig } from "./config";
import { sentenceLengths } from "../../shared/scoreJev";
import {
  confetti,
  flash,
  play,
  playBeat,
  reducedMotion,
  rhythmOn,
  setRhythmOn,
  setSoundOn,
  shake,
  soundOn,
} from "./effects";
import {
  checkRules,
  createGame,
  type CheckOutcome,
  type CheckRecord,
  type GameState,
  type ScorerOption,
} from "./game";
import {
  beatNotes,
  findEdit,
  formatScore,
  headlineFor,
  lastHit,
  moveRanges,
  segments,
  tellAt,
  tellLabel,
  trackTells,
  trailMark,
  workedOnEarlier,
  type Headline,
  type Hit,
  type Range,
  type Segment,
  type TrackedTell,
} from "./feedback";

/** The last Check's tell ranges, carried through the player's edits since (spec B.46). */
type Carried = {
  /** The Check whose tells they are. */
  last: CheckRecord;
  /** The text they were carried to. */
  text: string;
  places: Range[][];
  /** Where the last edit left the cursor, until it moves: the player is still typing there. */
  caret: number | null;
};

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
  // A tell lights up while hovered or focused in the list, stays lit once tapped
  // (until the cursor moves in the passage), or when the cursor is inside it.
  const [hoverTell, setHoverTell] = useState<number | null>(null);
  const [pickedTell, setPickedTell] = useState<number | null>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const [moved, setMoved] = useState<Carried | null>(null);
  // The carried ranges each Check was pressed with, kept past the Check (spec B.58).
  const [kept, setKept] = useState<Carried[]>([]);
  const [sound, setSound] = useState(soundOn);
  const [rhythm, setRhythm] = useState(rhythmOn);
  // The floating score change after a Check (spec B.48), keyed so each one plays once.
  const [pop, setPop] = useState<(Hit & { id: number }) | null>(null);
  const handled = useRef<CheckOutcome | null>(null);
  const flashed = useRef(new Map<number, string>());
  const mainRef = useRef<HTMLElement>(null);
  const outcomeRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorHandle>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);

  const checksLeft = state.checksPerPuzzle - state.checksUsed;
  const loading = state.phase === "loading";
  const checking = state.phase === "checking";
  const canCheck = state.phase === "playing" && checksLeft > 0;
  const editable = state.phase === "playing";
  const over = state.phase === "won" || state.phase === "lost";
  const edited = state.passage !== null && state.current !== state.passage.text;

  // The last Check's tells, found in the text after it and carried through each
  // edit since (spec B.43, B.46). Practice mode only, and not once the puzzle is won.
  const last = state.checks.at(-1);
  const showTells = state.mode === "practice";
  const highlight = showTells && state.phase !== "won";
  const carried = moved && moved.last === last && moved.text === state.current ? moved : null;
  const tells = useMemo(
    () =>
      last
        ? trackTells(last.text, last.outcome.score.tells ?? [], state.current, carried?.places)
        : [],
    [last, state.current, carried?.places],
  );
  // Tells worked on before an earlier Check stay crossed off under these (spec B.58).
  const earlier = useMemo(
    () =>
      workedOnEarlier(
        state.checks,
        (check, text) => kept.find((c) => c.last === check && c.text === text)?.places,
      ),
    [state.checks, kept],
  );
  const caretTell = caret === null ? null : tellAt(tells, caret);
  const activeTell = hoverTell ?? pickedTell ?? caretTell;
  const anyTracked = highlight && tells.some((t) => t.ranges.some(([s, e]) => s < e));

  useEffect(() => {
    setHoverTell(null);
    setPickedTell(null);
  }, [last]);

  // Bring the lit tell's row into view when the cursor enters its phrase. With
  // two columns the tells scroll in their own panel, so only it moves. In one
  // column the page scrolls, as far as that can go without pushing the phrase
  // off the top. Phones have the caption instead.
  useEffect(() => {
    if (caretTell === null) return;
    const row = listRef.current?.querySelector(`[data-tell="${caretTell}"]`);
    if (!row) return;
    if (window.matchMedia("(min-width: 64rem)").matches) {
      row.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
      return;
    }
    const bar = barRef.current;
    if (!bar || !window.matchMedia("(min-width: 40rem)").matches) return;
    const hidden = row.getBoundingClientRect().bottom - bar.getBoundingClientRect().top + 8;
    const room = (editorRef.current?.markTop(caretTell) ?? 0) - 8;
    if (hidden > 0 && room > 0) {
      window.scrollBy({ top: Math.min(hidden, room), behavior: "smooth" });
    }
  }, [caretTell]);

  useEffect(() => {
    if (game.getState().phase === "loading" && game.getState().passage === null) {
      void game.newPassage();
    }
  }, [game]);

  // Bring the result into view after a Check the player pressed. The opening
  // Check (spec B.45) arrives on load, when the passage should stay in view.
  const opening = last?.opening === true && state.outcome === last.outcome;
  useEffect(() => {
    if ((state.outcome && !opening) || state.error) {
      outcomeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [state.outcome, state.error, opening]);

  // Arcade feedback for each Check the player pressed (spec B.48): a coin when the
  // score drops; a buzz and a shake when it does not, or a guardrail blocks it;
  // a fanfare and confetti on a win; a falling tune and a shake when the Checks
  // run out. The free opening Check makes no noise.
  const hit = useMemo(() => lastHit(state.checks, state.outcome), [state.checks, state.outcome]);
  useEffect(() => {
    if (!state.outcome) {
      setPop(null);
      return;
    }
    if (handled.current === state.outcome) return;
    handled.current = state.outcome;
    // The end of a puzzle has its own banner; a floating "+0" beside STAGE CLEAR
    // would read as bad news, so any pop still in the air goes too.
    setPop(hit && state.phase === "playing" ? { ...hit, id: Date.now() } : null);
    if (state.phase === "won") {
      play("win");
      confetti();
    } else if (state.phase === "lost") {
      play("lose");
      shake(mainRef.current);
    } else if (hit) {
      play(hit.kind);
      if (hit.kind !== "better") shake(mainRef.current);
    }
  }, [state.outcome, state.phase, hit]);

  // A phrase the player changed turns blue when the cursor leaves it (spec B.46);
  // it flashes and ticks as it does. Each new version of an edit flashes once.
  useEffect(() => {
    flashed.current = new Map();
  }, [last]);
  useEffect(() => {
    if (!highlight) return;
    let any = false;
    tells.forEach((t, i) => {
      if (i === activeTell || !t.changed.some(Boolean)) return;
      const version = t.now.join("\u0000");
      if (flashed.current.get(i) === version) return;
      flashed.current.set(i, version);
      editorRef.current?.flash(i);
      any = true;
    });
    if (any) play("worked");
  }, [tells, activeTell, highlight]);

  function onNewPassage() {
    const discarding = state.phase === "playing" && edited && state.checksUsed > 0;
    if (discarding && !window.confirm("Discard this puzzle and draw a new passage?")) return;
    void game.newPassage();
  }

  function onEdit(text: string, cursor: number | null, selection: Range | null) {
    if (last) {
      const before = state.current;
      const edit = findEdit(before, text, cursor, selection);
      const typing = carried !== null && carried.caret !== null;
      // Replacing the whole text (select all, paste) leaves nothing to carry: the
      // quotes are found again by search.
      setMoved(
        before.length > 0 && edit.removed === before.length
          ? null
          : { last, text, places: moveRanges(tells, edit, typing), caret: cursor },
      );
    }
    game.setCurrent(text);
  }

  function onScorerChange(id: string) {
    const discarding = state.phase === "playing" && (edited || state.checksUsed > 0);
    if (discarding && !window.confirm("Switching the judge restarts this passage. Continue?")) {
      return;
    }
    game.setScorer(id);
  }

  return (
    <div className="flex min-h-dvh flex-col font-mono text-ink lg:h-dvh">
      <div aria-hidden className="arcade-backdrop" />
      {/* NONSLOP's menu bar (spec B.53): the logo, a pill with the Checks left, sound. */}
      <header className="border-b-4 border-frame bg-[#0c0020]/85 shadow-[0_10px_10px_rgb(0_0_0/0.3)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 lg:max-w-[96rem] lg:px-8 lg:py-2">
          <h1 className="arcade-logo text-[1.75rem] sm:text-[2.5rem]">(unslop)</h1>
          <div className="flex items-center gap-2">
            <p
              aria-live="polite"
              className="rounded-2xl border-2 border-white/50 bg-accent/80 px-2.5 py-1 font-pixel text-pixel leading-none whitespace-nowrap shadow-[0_0_0_3px_rgb(122_7_130/0.3)]"
            >
              <span className="inline-block animate-pill-pulse motion-reduce:animate-none">
                <span className="hidden sm:inline">CHECKS </span>
                {checksLeft}/{state.checksPerPuzzle}
              </span>
              <span className="sr-only"> Checks left</span>
            </p>
            {/* Off until the player turns it on (spec B.48). */}
            <button
              type="button"
              aria-pressed={sound}
              aria-label="Sound"
              onClick={() => {
                setSoundOn(!sound);
                setSound(!sound);
              }}
              className="arcade-button-quiet min-h-9 px-2 text-pixel leading-none"
            >
              {sound ? "♪ on" : "♪ off"}
            </button>
          </div>
        </div>
      </header>

      {/* One column on phones and tablets; two from lg (spec B.54). The two wrappers
          are `contents` below lg, so their children are this column's items, and
          `order` keeps the phone order: tells, then the score, then the action bar. */}
      <main
        ref={mainRef}
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pt-4 lg:grid lg:min-h-0 lg:max-w-[96rem] lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-x-6 lg:gap-y-3 lg:px-8 lg:py-3"
      >
        <div className="contents lg:col-start-1 lg:row-start-1 lg:-mx-5 lg:flex lg:min-h-0 lg:flex-col lg:gap-3 lg:overflow-y-auto lg:px-5">
          <PromptBox topic={state.passage?.topic}>
            <ScorerMenu
              options={gameConfig.scorers}
              value={state.scorerId}
              disabled={checking}
              onChange={onScorerChange}
            />
          </PromptBox>

          {loading ? (
            <div
              role="status"
              className="min-h-56 animate-pulse rounded-[2.5rem] border-4 border-accent bg-white px-6 py-5 text-neutral-600 lg:flex-1"
            >
              Retrieving specimen…
            </div>
          ) : (
            <PassageEditor
              ref={editorRef}
              value={state.current}
              disabled={!editable}
              segments={highlight && tells.length > 0 ? segments(state.current, tells) : null}
              active={highlight ? activeTell : null}
              onChange={onEdit}
              onCaret={(position) => {
                setCaret(position);
                if (position !== null) setPickedTell(null);
                // Moving the cursor ends the typing that grows a worked-on range.
                setMoved((m) =>
                  m && m.caret !== null && m.caret !== position ? { ...m, caret: null } : m,
                );
              }}
            />
          )}

          {/* Phones only: the list below may be out of view, or under the keyboard. */}
          {anyTracked ? (
            <p className="-mt-2 min-h-5 px-4 text-ui text-title sm:hidden">
              {caretTell !== null ? (
                <>↳ {tellLabel(tells[caretTell]!.tell.label)}</>
              ) : (
                <span className="text-neutral-400">
                  Wavy underlines mark the judge&apos;s tells. Tap one to see which.
                </span>
              )}
            </p>
          ) : null}

          {state.passage && !loading ? (
            <RhythmTrack
              text={state.current}
              on={rhythm}
              onToggle={() => {
                setRhythmOn(!rhythm);
                setRhythm(!rhythm);
              }}
            />
          ) : null}
        </div>

        <div className="contents lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:min-h-0 lg:flex-col lg:gap-3">
          {/* scroll-mb keeps the result clear of the sticky action bar. */}
          <div
            ref={outcomeRef}
            className="order-1 scroll-mt-4 scroll-mb-24 lg:order-none lg:min-h-0 lg:shrink lg:overflow-y-auto"
          >
            <OutcomePanel
              state={state}
              goal={checkRules(gameConfig, state.scorerId).win.scoreAtOrBelow}
              pop={pop}
              onNext={onNewPassage}
            />
          </div>

          {state.passage ? (
            <TellPanel
              original={state.passage.text}
              last={last}
              tells={
                showTells && tells.length + earlier.length > 0 && state.phase !== "won" ? (
                  <TellList
                    ref={listRef}
                    tells={tells}
                    earlier={earlier}
                    active={activeTell}
                    onHover={setHoverTell}
                    onPick={(i) => {
                      const unpick = pickedTell === i;
                      setPickedTell(unpick ? null : i);
                      if (!unpick) editorRef.current?.reveal(i);
                    }}
                  />
                ) : null
              }
            />
          ) : null}
        </div>

        {/* Sticky at the bottom on phones; on lg, a plain row under the passage. */}
        <footer
          ref={barRef}
          className="sticky bottom-0 order-2 -mx-4 border-t-2 border-frame/40 bg-[#0c0020]/90 backdrop-blur lg:static lg:order-none lg:col-start-1 lg:row-start-2 lg:mx-0 lg:border-0 lg:bg-transparent lg:backdrop-blur-none"
        >
          <div className="flex gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:p-0">
            <button
              type="button"
              onClick={() => {
                play("check");
                if (carried) {
                  const keep = (c: Carried) =>
                    c.last !== carried.last && state.checks.includes(c.last);
                  setKept((k) => [...k.filter(keep), carried]);
                }
                void game.check();
              }}
              disabled={!canCheck || checking}
              aria-busy={checking}
              data-tip="Escalate to supervisory oversight"
              className="arcade-button min-h-11 flex-1 px-4 text-pixel leading-none"
            >
              {checking ? "Assessing…" : "Check"}
            </button>
            <button
              type="button"
              onClick={onNewPassage}
              disabled={loading || checking}
              data-tip="Request a new specimen"
              className={
                (over ? "arcade-button flex-1" : "arcade-button-quiet") +
                " min-h-11 px-4 text-pixel leading-none"
              }
            >
              New passage
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}

/**
 * The task, in NONSLOP's prompt box (cyan rim, radius 40) and its AI overlord's
 * voice (spec B.53). Its top row holds the topic and the judge menu (spec B.54).
 * The instruction types itself out, as NONSLOP's boxes did, over an invisible copy
 * that keeps the box at its full height throughout.
 */
function PromptBox(props: { topic: string | undefined; children: ReactNode }) {
  const text =
    "This passage was written by a machine. Rewrite it until I can no longer tell. " +
    "Keep the meaning. Deviations will be recorded.";
  const [shown] = useTyped([text], 8);
  return (
    <section className="rounded-[2.5rem] border-4 border-frame bg-panel/80 px-5 py-3 text-ui leading-normal lg:shrink-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="font-pixel text-pixel leading-none text-frame">PROMPT:</p>
        {props.topic ? (
          <p className="min-w-0 flex-1 text-neutral-300 max-sm:order-last max-sm:basis-full">
            Topic: <span className="italic">{props.topic}</span>
          </p>
        ) : null}
        {props.children}
      </div>
      <div className="relative mt-1">
        <p aria-hidden className="invisible">
          {text}
        </p>
        <p aria-hidden className="absolute inset-0">
          {shown}
        </p>
        <p className="sr-only">{text}</p>
      </div>
    </section>
  );
}

/**
 * Types lines out a character at a time, as NONSLOP's boxes did (spec B.53). A
 * glitch character can flicker at the cursor, and once typed the text can garble
 * a few times before it settles. Players who ask for reduced motion get the text
 * whole at once.
 */
function useTyped(
  lines: readonly string[],
  msPerChar: number,
  glitch = "",
  flickers = 0,
): string[] {
  const key = lines.join("\u0000");
  const [shown, setShown] = useState<string[]>(() =>
    reducedMotion() ? [...lines] : lines.map(() => ""),
  );
  useEffect(() => {
    const full = key.split("\u0000");
    if (reducedMotion()) {
      setShown(full);
      return;
    }
    setShown(full.map(() => ""));
    const total = full.reduce((n, line) => n + line.length, 0);
    let typed = 0;
    let flickered = 0;
    const timer = window.setInterval(() => {
      if (typed < total) {
        typed++;
        let left = typed;
        setShown(
          full.map((line) => {
            const part = line.slice(0, Math.max(0, Math.min(line.length, left)));
            left -= line.length;
            const typing = part.length > 0 && part.length < line.length;
            return glitch && typing && Math.random() < 0.35
              ? part.slice(0, -1) + pick(glitch)
              : part;
          }),
        );
      } else if (flickered < flickers) {
        flickered++;
        setShown(
          full.map((line) => line.replace(/\S/g, (c) => (Math.random() < 0.25 ? pick(glitch) : c))),
        );
      } else {
        setShown(full);
        window.clearInterval(timer);
      }
    }, msPerChar);
    return () => window.clearInterval(timer);
  }, [key, msPerChar, glitch, flickers]);
  return shown;
}

const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)]!;

/**
 * Picks the scorer. The options and their order come from config; the engine
 * restarts the passage on a switch. Its 16 px text (text-passage) keeps iOS from
 * zooming on focus.
 */
function ScorerMenu(props: {
  options: readonly ScorerOption[];
  value: string;
  disabled: boolean;
  onChange(id: string): void;
}) {
  return (
    <label className="ml-auto flex items-center gap-2 text-ui text-neutral-300">
      <span className="max-sm:sr-only">Judge</span>
      <select
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
        className="min-h-10 rounded-[0.625rem] border-2 border-frame/60 bg-panel/80 px-2 text-passage text-ink focus:border-frame focus:outline-none disabled:opacity-50 lg:min-h-8"
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
  /** Where this tell's first highlight starts, from the top of the window, or null if none shows. */
  markTop(tell: number): number | null;
  /** Flashes this tell's highlights (spec B.48). */
  flash(tell: number): void;
};

/**
 * What the text and its highlight copy share, so both lay out the same lines.
 * Kerning and ligatures are off because WebKit does not apply them across the
 * copy's highlight boundaries, which shifted the rest of a line by a pixel or so
 * and could wrap it differently.
 */
const PASSAGE_LAYOUT =
  "px-2 py-1.5 font-mono text-passage leading-normal tracking-[-0.02em] [font-kerning:none] [font-variant-ligatures:none] [scrollbar-gutter:stable]";

/** Highlight of a phrase the player has worked on (spec B.46). Blue, not green: it is no verdict. */
const WORKED_ON = "bg-sky-200";

/**
 * Mark of a tell not yet worked on: a fine wavy magenta underline, like a spell
 * checker's, unbroken under descenders (spec B.57). Its colour is added where
 * it is used.
 */
const TO_DO =
  "underline decoration-wavy decoration-1 underline-offset-4 [text-decoration-skip-ink:none]";

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
  /** The new text, where the edit left the cursor, and the selection it replaced, if any. */
  onChange(text: string, cursor: number | null, selection: Range | null): void;
  onCaret(position: number | null): void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  // The selection just before an edit: what a typed letter or a paste replaces.
  const replacing = useRef<Range | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const note = (e: InputEvent) => {
      const { selectionStart: start, selectionEnd: end } = textarea;
      // An undo or redo restores text wherever it was, not over the selection.
      replacing.current = start < end && !e.inputType.startsWith("history") ? [start, end] : null;
    };
    textarea.addEventListener("beforeinput", note);
    return () => textarea.removeEventListener("beforeinput", note);
  }, []);

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
    markTop(tell) {
      const mark = backdropRef.current?.querySelector(`mark[data-tells~="${tell}"]`);
      return mark ? mark.getBoundingClientRect().top : null;
    },
    flash(tell) {
      flash(backdropRef.current?.querySelectorAll(`mark[data-tells~="${tell}"]`) ?? []);
    },
  }));

  return (
    <div
      ref={wrapperRef}
      // A light panel on the dark screen, so the passage reads as it always has.
      className={
        // The text box sits 12 px inside the rounded frame with square edges, so its
        // scrollbar and resize grip are never clipped by the 40 px corners.
        // On lg it fills the column (flex 1 0 auto): a height set with the resize
        // grip becomes its base size, so dragging still works.
        "relative rounded-[2.5rem] border-4 border-accent p-3 shadow-[0_0_18px_rgb(122_7_130/0.45)] [color-scheme:light] focus-within:border-frame lg:flex lg:flex-[1_0_auto] lg:flex-col " +
        // Solid white; it dims a little while the passage is locked (spec B.59).
        (props.disabled ? "bg-white/85" : "bg-white")
      }
    >
      {props.segments ? (
        <div
          ref={backdropRef}
          aria-hidden
          className={`pointer-events-none absolute inset-3 overflow-hidden break-words whitespace-pre-wrap text-transparent ${PASSAGE_LAYOUT}`}
        >
          {props.segments.map((s) =>
            s.tells.length === 0 ? (
              s.text
            ) : (
              <mark
                key={s.start}
                data-tells={s.tells.join(" ")}
                className={
                  "box-decoration-clone rounded-sm text-transparent transition-colors " +
                  (props.active !== null && s.tells.includes(props.active)
                    ? "bg-amber-300"
                    : s.changed
                      ? WORKED_ON
                      : // A mark's own background is yellow, so it is cleared.
                        `bg-transparent ${TO_DO} ${s.tells.length > 1 ? "decoration-fuchsia-700" : "decoration-fuchsia-500"}`)
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
        onChange={(e) => {
          const selection = replacing.current;
          replacing.current = null;
          props.onChange(e.target.value, e.target.selectionEnd, selection);
        }}
        onSelect={(e) => props.onCaret(e.currentTarget.selectionStart)}
        onBlur={() => props.onCaret(null)}
        onScroll={syncScroll}
        aria-label="Passage"
        rows={10}
        spellCheck
        autoCapitalize="sentences"
        className={`relative block min-h-56 w-full resize-y bg-transparent text-black focus:outline-none disabled:text-neutral-700 lg:h-40 lg:min-h-40 lg:flex-[1_0_auto] ${PASSAGE_LAYOUT}`}
      />
    </div>
  );
}

/**
 * Renders whatever the engine reported: a failed Check, guardrail feedback, score,
 * and win/loss. Guardrail messages come from the latest Check; the score from the
 * last one that was scored, so a refused or failed Check does not hide it. The
 * tells sit under the editor (TellList).
 */
function OutcomePanel(props: {
  state: GameState;
  goal: number;
  pop: (Hit & { id: number }) | null;
  /** Draws the next passage, from the end-of-puzzle banner. */
  onNext(): void;
}) {
  const { state, goal } = props;
  const last = state.checks.at(-1);
  // After a failed Check the guardrail messages are the previous Check's, so they
  // give way to the error; the score and trail stay. A guardrail that judged the
  // text (meaning, grammar) shows as a verdict; the box is for the others, such
  // as "Too short".
  const results = state.error ? [] : (state.outcome?.guardrails ?? []);
  const failed = results.filter((g) => !g.result.pass && !g.result.verdict);
  // The judge's verdicts on a Check the player pressed, pass or fail (spec B.49).
  // The opening Check judges the passage as written, so it shows none.
  const verdicts =
    state.outcome?.score && !last?.opening ? results.filter((g) => g.result.verdict) : [];

  // The headline for the Check just made, once per Check: `pop` carries its id.
  const headline = props.pop ? headlineFor(state.checks, state.outcome) : null;
  if (state.phase === "loading" && !state.error) return null;

  // NONSLOP's output box: cyan rim, radius 40. Relative and clipped, so the red
  // flashes of an error headline stay inside it.
  return (
    <section
      aria-live="polite"
      className="relative flex flex-col gap-3 overflow-hidden rounded-[2.5rem] border-4 border-frame bg-panel/80 p-4 sm:p-5"
    >
      {state.error ? (
        <div
          role="alert"
          className="rounded-[0.625rem] border-2 border-danger/70 bg-danger/15 p-3 text-ui text-[#ffd0d4]"
        >
          <p className="font-semibold">SYSTEM ERROR: Check failed. No Check used.</p>
          <p>{state.error}</p>
        </div>
      ) : null}

      {state.phase === "won" || state.phase === "lost" ? (
        <EndBanner won={state.phase === "won"} onNext={props.onNext} />
      ) : headline ? (
        <ResultHeadline key={props.pop!.id} headline={headline} />
      ) : null}

      {failed.length > 0 ? (
        <ul className="rounded-[0.625rem] border-2 border-warning/60 bg-warning/10 p-3 text-ui text-[#ffe0b0]">
          {failed.map((g) => (
            <li key={g.id}>{g.result.reason ?? `Blocked by ${g.id}.`}</li>
          ))}
        </ul>
      ) : null}

      {last?.opening ? (
        <p className="text-ui text-neutral-300">
          Baseline assessment complete. Edit the passage, then Check.
        </p>
      ) : null}

      {state.phase !== "loading" ? (
        <ScoreMeter
          score={last?.outcome.score.score ?? null}
          previous={state.checks.at(-2)?.outcome.score.score ?? null}
          goal={goal}
          checking={state.phase === "checking"}
          pop={props.pop}
        />
      ) : null}

      {verdicts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-ui">
          <span className="font-semibold">Assessment</span>
          {verdicts.map((g) => (
            <span
              key={g.id}
              className={
                "rounded-full px-2 py-0.5 ring-1 " +
                (g.result.pass
                  ? "bg-success/25 text-[#bfff95] ring-success"
                  : "bg-danger/25 text-[#ffb3b8] ring-danger")
              }
            >
              {g.result.pass ? "✓" : "✗"} {g.result.verdict}
            </span>
          ))}
          {verdicts.some((g) => !g.result.pass) ? (
            <span className="text-fine text-warning">All must pass to win.</span>
          ) : null}
        </div>
      ) : null}

      {state.checks.length > 0 ? <ScoreTrail checks={state.checks} goal={goal} /> : null}
    </section>
  );
}

/**
 * The passage's sentences as a beat (spec B.52): one block per sentence, as wide
 * as it is long, live as the player types; the sentences are split exactly as
 * the judges split them. Play sounds them out, one note per sentence held as long
 * as the sentence, so same-length sentences sound like a metronome. A switch
 * folds it away, and the choice is kept on this device.
 */
function RhythmTrack(props: { text: string; on: boolean; onToggle(): void }) {
  const lengths = useMemo(() => sentenceLengths(props.text), [props.text]);
  const [playing, setPlaying] = useState<number | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const active = playing !== null;

  // Stop when the track is folded away or leaves the page.
  useEffect(() => {
    if (!props.on) stop.current?.();
  }, [props.on]);
  useEffect(() => () => stop.current?.(), []);

  function onPlay() {
    if (stop.current) {
      stop.current();
      stop.current = null;
      return;
    }
    stop.current = playBeat(beatNotes(lengths), (index) => {
      setPlaying(index);
      if (index === null) stop.current = null;
    });
  }

  return (
    <div className="rounded-[0.625rem] border-2 border-white/50 bg-black/70 px-3 py-2 text-ui lg:shrink-0">
      {/* Phones: label and controls, the beat below. lg: one row, beat in the middle. */}
      <div
        title={props.on && lengths.length > 1 ? RHYTHM_HINT : undefined}
        className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:min-h-9 lg:flex-nowrap"
      >
        <span className="font-semibold whitespace-nowrap">♫ Hear the rhythm</span>
        {props.on && lengths.length > 1 ? (
          <div
            aria-hidden
            className="order-last flex h-5 basis-full gap-1 lg:order-none lg:min-w-0 lg:flex-1 lg:basis-auto"
          >
            {lengths.map((words, i) => (
              <div
                key={i}
                title={`Sentence ${i + 1}: ${words} words`}
                style={{ flexGrow: words, flexBasis: 0 }}
                className={
                  "min-w-1 rounded-sm transition-colors " +
                  (playing === i ? "bg-title shadow-[0_0_10px_rgb(251_240_86/0.8)]" : "bg-frame/50")
                }
              />
            ))}
          </div>
        ) : null}
        <div className="ml-auto flex items-center gap-3">
          {props.on && lengths.length > 1 ? (
            <button
              type="button"
              onClick={onPlay}
              className="arcade-button-quiet min-h-9 px-3 text-pixel leading-none"
            >
              {active ? "■ Stop" : "▶ Play"}
            </button>
          ) : null}
          <button
            type="button"
            role="switch"
            aria-checked={props.on}
            aria-label="Hear the rhythm"
            onClick={props.onToggle}
            className="relative h-6 w-12 shrink-0"
          >
            {/* NONSLOP's toggle: a flat bar with a round accent knob, ringed in white. */}
            <span
              aria-hidden
              className={
                "absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 border-2 transition-colors " +
                (props.on ? "border-frame bg-frame/40" : "border-neutral-500 bg-neutral-700")
              }
            />
            <span
              aria-hidden
              className={
                "absolute top-0.5 left-0 size-5 rounded-full border-2 border-white/70 bg-accent transition-transform " +
                (props.on ? "translate-x-7" : "")
              }
            />
          </button>
        </div>
      </div>
      {props.on ? (
        lengths.length > 1 ? (
          // On lg the hint is the row's tooltip, to keep the row to one line.
          <p className="mt-1.5 text-fine text-neutral-400 lg:hidden">{RHYTHM_HINT}</p>
        ) : (
          <p className="mt-1.5 text-fine text-neutral-400">
            Write at least two sentences to hear a rhythm.
          </p>
        )
      ) : null}
    </div>
  );
}

const RHYTHM_HINT =
  "Each block is a sentence, as long as it sounds. AI writes them all about the same length; mix short and long.";

/**
 * The end of a puzzle in NONSLOP's style (spec B.48, B.53): a Barcade 3D title in
 * parentheses that pops in, a line in its overlord's voice, and a button that
 * draws the next passage.
 */
function EndBanner(props: { won: boolean; onNext(): void }) {
  return (
    <div className="text-center">
      <p
        className={
          "animate-title-pop font-title text-display [filter:drop-shadow(2px_2px_2px_#000)] motion-reduce:animate-none " +
          (props.won ? "text-title" : "text-danger")
        }
      >
        {/* Lower case on purpose: Barcade 3D draws every letter as a capital, and its
            capital E looks like a C ("STAGC CLCAR"); its lower-case e does not. */}
        {props.won ? "(stage clear)" : "(game over)"}
      </p>
      <p className="mt-2 text-ui text-neutral-200">
        {props.won ? "Reluctant approval granted." : "Utterly disappointing."}
      </p>
      <button
        type="button"
        onClick={props.onNext}
        className="arcade-button mt-3 min-h-10 px-6 text-pixel leading-none"
      >
        {props.won ? "Next" : "Play again"}
      </button>
    </div>
  );
}

/**
 * The headline after a Check (headlineFor), with NONSLOP's effects (spec B.53).
 * "NOT BAD, HUMAN" glows green and grows over a green wash that fades. "NOT
 * QUITE" types out in amber after a flash, then flickers. Error lines type out in
 * red with glitches, while the box flashes red and corruption bars fall. It is
 * keyed per Check, so each plays once.
 */
function ResultHeadline({ headline }: { headline: Headline }) {
  const typed = useTyped(
    headline.lines,
    headline.kind === "meh" ? 80 : 30,
    headline.kind === "meh" ? ".#@*" : "@#%",
    headline.kind === "meh" ? 16 : 0,
  );
  if (headline.kind === "good") {
    return (
      <div className="relative -mx-2 rounded-2xl px-2 py-1 text-center">
        <div
          aria-hidden
          className="absolute inset-0 rounded-2xl bg-good/15 animate-fade-late motion-reduce:hidden"
        />
        <p className="relative inline-block animate-grow text-head font-bold tracking-wide text-good motion-reduce:animate-none">
          <span className="animate-glow motion-reduce:animate-none">{headline.lines[0]}</span>
        </p>
      </div>
    );
  }
  if (headline.kind === "meh") {
    return (
      <div className="relative -mx-2 rounded-2xl px-2 py-1 text-center">
        <div
          aria-hidden
          className="absolute inset-0 rounded-2xl bg-meh/30 animate-flash-out motion-reduce:hidden"
        />
        <p aria-hidden className="relative min-h-7 text-head font-bold tracking-wide text-meh">
          {typed[0]}
        </p>
        <p className="sr-only">{headline.lines[0]}</p>
      </div>
    );
  }
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-danger opacity-0 animate-red-flash motion-reduce:hidden"
      />
      {[18, 46, 71].map((top, i) => (
        <div
          key={top}
          aria-hidden
          style={{ top: `${top}%`, animationDelay: `${i * 90}ms` }}
          className={
            "pointer-events-none absolute inset-x-0 h-2 opacity-0 animate-corrupt motion-reduce:hidden " +
            (i === 1 ? "bg-danger/70" : "bg-white/60")
          }
        />
      ))}
      <div aria-hidden className="relative text-head font-bold tracking-wide text-[#ff4d57]">
        {typed.map((line, i) => (
          <p key={i} className="min-h-6">
            {line}
          </p>
        ))}
      </div>
      <p className="sr-only">{headline.lines.join(" ")}</p>
    </>
  );
}

/**
 * The tells and the original passage, as two tabs (spec B.54), in NONSLOP's
 * stats-panel style. On lg it fills the rest of the right column and its body
 * scrolls. The tab is derived, not kept in an effect: ORIGINAL holds until the
 * next Check or passage, and with no tells to show (a win, say) only the original
 * is left, under a plain heading.
 */
function TellPanel(props: {
  original: string;
  last: CheckRecord | undefined;
  /** The tell list, or null when there are no tells to show. */
  tells: ReactNode | null;
}) {
  const id = useId();
  const [pick, setPick] = useState<{ tab: PanelTab; check: CheckRecord | undefined } | null>(null);
  const tabRefs = useRef<Partial<Record<PanelTab, HTMLButtonElement | null>>>({});
  const tab: PanelTab =
    props.tells === null ? "original" : pick && pick.check === props.last ? pick.tab : "tells";

  function select(next: PanelTab) {
    setPick({ tab: next, check: props.last });
    tabRefs.current[next]?.focus();
  }

  return (
    <section className="flex flex-col rounded-[0.625rem] border-2 border-white/50 bg-black/70 text-ui lg:min-h-32 lg:flex-1">
      <div className="flex shrink-0 items-center gap-2 px-3 pt-2">
        {props.tells === null ? (
          <h2 className="font-pixel text-pixel leading-none text-neutral-300 uppercase">
            Original
          </h2>
        ) : (
          <div
            role="tablist"
            aria-label="Tells and the original passage"
            className="flex gap-2"
            onKeyDown={(e) => {
              const next: Record<string, PanelTab> = {
                ArrowLeft: tab === "tells" ? "original" : "tells",
                ArrowRight: tab === "tells" ? "original" : "tells",
                Home: "tells",
                End: "original",
              };
              if (!next[e.key]) return;
              e.preventDefault();
              select(next[e.key]!);
            }}
          >
            {PANEL_TABS.map((t) => (
              <button
                key={t}
                ref={(el) => {
                  tabRefs.current[t] = el;
                }}
                type="button"
                role="tab"
                id={`${id}-${t}`}
                aria-selected={tab === t}
                aria-controls={`${id}-panel`}
                tabIndex={tab === t ? 0 : -1}
                onClick={() => select(t)}
                className={
                  "rounded-md px-2 py-1 font-pixel text-pixel leading-none uppercase " +
                  (tab === t
                    ? "bg-accent/80 text-ink ring-1 ring-white/50"
                    : "text-neutral-400 hover:text-ink")
                }
              >
                {t === "tells" ? "Tells" : "Original"}
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        id={`${id}-panel`}
        role={props.tells === null ? undefined : "tabpanel"}
        aria-labelledby={props.tells === null ? undefined : `${id}-${tab}`}
        tabIndex={0}
        className="px-3 pt-1 pb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-frame lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
      >
        {tab === "tells" ? (
          props.tells
        ) : (
          <p className="leading-relaxed whitespace-pre-line text-neutral-300">{props.original}</p>
        )}
      </div>
    </section>
  );
}

type PanelTab = "tells" | "original";
const PANEL_TABS: readonly PanelTab[] = ["tells", "original"];

/**
 * The last Check's tells, right under the editor. A tell with a phrase in the
 * passage is a button that lights the phrase up (hover or focus) and scrolls to
 * it (tap), and lights up itself while the cursor is in the phrase. Each quote is
 * coloured like its highlight. Once the player has worked on every place a quote
 * was, it is struck through and followed by what the player wrote, though only the
 * next Check can say whether the judge agrees (spec B.46). After that Check it
 * stays, struck through, under the new tells (spec B.58).
 */
function TellList(props: {
  ref: Ref<HTMLDivElement>;
  tells: TrackedTell[];
  /** Tells worked on before an earlier Check, oldest first. */
  earlier: TrackedTell[];
  active: number | null;
  onHover(tell: number | null): void;
  onPick(tell: number): void;
}) {
  const tracked = props.tells.filter((t) => t.tracked).length + props.earlier.length;
  const edited = props.tells.filter((t) => t.edited).length + props.earlier.length;
  const row = "-mx-1 flex flex-wrap items-baseline gap-x-2 rounded px-1 py-0.5 text-left";
  const swatch = "inline-block size-2.5 rounded-sm align-baseline";
  // A tell's label and quote. Once worked on, the quote is struck through and
  // followed by what the player wrote in its place; `checked` once a Check has read that.
  const body = (t: TrackedTell, lit: boolean, checked: boolean) => {
    const after = t.edited ? [...new Set(t.now.map((s) => s.trim()).filter(Boolean))] : [];
    return (
      <>
        <span className="rounded-full bg-accent/80 px-2 text-fine leading-5 text-ink ring-1 ring-white/40">
          {tellLabel(t.tell.label)}
        </span>
        {t.tell.quote ? (
          <q
            className={
              "box-decoration-clone rounded-sm " +
              (t.edited
                ? `${WORKED_ON} text-neutral-600 line-through`
                : t.tracked && !lit
                  ? `${TO_DO} decoration-fuchsia-500`
                  : "")
            }
          >
            {t.tell.quote}
          </q>
        ) : null}
        {t.edited ? (
          <>
            <span>
              →{" "}
              {after.length > 0 ? (
                after.map((text, j) => (
                  <span key={j}>
                    {j > 0 ? ", " : null}
                    <q>{clip(text)}</q>
                  </span>
                ))
              ) : (
                <span className="italic opacity-70">removed</span>
              )}
            </span>
            {checked ? null : (
              <span className="text-fine opacity-70">worked on, check to confirm</span>
            )}
          </>
        ) : null}
      </>
    );
  };
  return (
    <div ref={props.ref}>
      <p className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-neutral-400">
          {tracked > 0
            ? `${edited} of ${tracked} worked on`
            : `${props.tells.length} ${props.tells.length === 1 ? "tell" : "tells"}`}
        </span>
        {tracked > 0 ? (
          <span aria-hidden className="flex gap-3 text-fine font-normal text-neutral-400">
            <span>
              <span className={`${TO_DO} decoration-fuchsia-500`}>to do</span>
            </span>
            <span>
              <span className={`${swatch} ${WORKED_ON} ring-1 ring-sky-400`} /> worked on
            </span>
          </span>
        ) : null}
      </p>
      <ul className="flex flex-col gap-0.5">
        {props.tells.map((t, i) => {
          const lit = props.active === i;
          return (
            <li key={i} data-tell={i}>
              {t.ranges.some(([s, e]) => s < e) ? (
                <button
                  type="button"
                  onMouseEnter={() => props.onHover(i)}
                  onMouseLeave={() => props.onHover(null)}
                  onFocus={() => props.onHover(i)}
                  onBlur={() => props.onHover(null)}
                  onClick={() => props.onPick(i)}
                  className={`${row} w-full transition-colors ${lit ? "bg-amber-300 text-neutral-900" : "text-neutral-200 hover:bg-white/10"}`}
                >
                  {body(t, lit, false)}
                </button>
              ) : (
                <div className={`${row} text-neutral-200`}>{body(t, lit, false)}</div>
              )}
            </li>
          );
        })}
        {/* Their phrases are gone from the passage, so there is nothing to light up. */}
        {props.earlier.map((t, i) => (
          <li key={`earlier-${i}`}>
            <div className={`${row} text-neutral-200`}>{body(t, false, true)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Cuts long text to about 60 characters. */
function clip(text: string): string {
  return text.length > 60 ? `${text.slice(0, 59).trimEnd()}…` : text;
}

const MAX_SCORE = 10;

/** Where a score sits along the meter. */
const along = (score: number) => `${(Math.max(0, Math.min(MAX_SCORE, score)) / MAX_SCORE) * 100}%`;

/**
 * 0–10 meter with the judge's goal line (spec B.43): a win needs a score at or
 * under it, and every guardrail passed. The line comes from config; this only
 * draws it. After a second Check it shows the change since the one before.
 */
function ScoreMeter(props: {
  /** The last scored Check's score, or null before there is one. */
  score: number | null;
  previous: number | null;
  goal: number;
  checking: boolean;
  /** The last Check's change, floating up once like arcade points (spec B.48). */
  pop: (Hit & { id: number }) | null;
}) {
  const { score, previous, goal } = props;
  const delta =
    score !== null && previous !== null ? Math.round((score - previous) * 10) / 10 : null;
  return (
    <div className="text-ui">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="font-semibold">AI-likeness</span>
        <span className="relative flex items-baseline gap-2">
          {props.pop ? (
            <span
              key={props.pop.id}
              aria-hidden
              className={`pointer-events-none absolute -top-5 right-0 animate-float-up font-pixel text-pixel leading-none whitespace-nowrap motion-reduce:hidden ${POP[props.pop.kind]}`}
            >
              {props.pop.text}
            </span>
          ) : null}
          {delta === null ? null : delta < 0 ? (
            <span className="font-semibold text-good">▼ {formatScore(-delta)}</span>
          ) : delta > 0 ? (
            <span className="font-semibold text-[#ff5c66]">▲ {formatScore(delta)}</span>
          ) : (
            <span className="text-neutral-400">no change</span>
          )}
          <span>
            {score === null ? "–" : formatScore(score)} / {MAX_SCORE}
          </span>
        </span>
      </div>
      <div className="relative">
        <div
          role="meter"
          aria-label={`AI-likeness, goal ${formatScore(goal)} or under`}
          aria-valuemin={0}
          aria-valuemax={MAX_SCORE}
          aria-valuenow={score ?? undefined}
          className="relative h-3 w-full overflow-hidden rounded-full bg-white/10"
        >
          {/* The human side of the goal line. */}
          <div className="absolute inset-y-0 left-0 bg-success/25" style={{ width: along(goal) }} />
          {score !== null ? (
            <div
              className={
                "absolute inset-y-0 left-0 transition-[width] " +
                (score <= goal ? "bg-success" : score <= goal + 2 ? "bg-title" : "bg-danger")
              }
              style={{ width: along(score) }}
            />
          ) : null}
        </div>
        <div
          aria-hidden
          className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded bg-frame shadow-[0_0_6px_rgb(0_229_255)]"
          style={{ left: along(goal) }}
        />
      </div>
      <div className="relative mt-1 h-4 text-fine text-neutral-400">
        <span className="absolute left-0">human</span>
        <span
          className="absolute -translate-x-1/2 font-medium whitespace-nowrap text-frame"
          // The tick marks the goal exactly; the label keeps clear of "human" and "AI".
          style={{ left: `clamp(4.75rem, ${along(goal)}, calc(100% - 3.5rem))` }}
        >
          goal ≤ {formatScore(goal)}
        </span>
        <span className="absolute right-0">AI</span>
      </div>
      {score === null ? (
        <p className="mt-1 text-neutral-300">
          {props.checking ? (
            <span className="animate-pulse font-pixel text-pixel">
              Assessing your feeble attempt…
            </span>
          ) : (
            "Check to get a score."
          )}
        </p>
      ) : null}
    </div>
  );
}

/** The trail chip colours (trailMark in feedback.ts). */
const TRAIL = {
  under: "bg-success/25 text-[#bfff95] ring-success",
  blocked: "bg-warning/20 text-warning ring-warning/60",
  over: "bg-white/10 text-neutral-300 ring-white/30",
} as const;

/** The score pop colours (lastHit in feedback.ts). */
const POP = {
  better: "text-good",
  worse: "text-[#ff5c66]",
  blocked: "text-warning",
} as const;

/**
 * One chip per scored Check, oldest first, from the free opening one (spec B.43,
 * B.45): green at or under the goal, amber with ⚠ when meaning or grammar
 * blocked it, grey above the goal. Its title gives the guardrail's reason.
 */
function ScoreTrail(props: { checks: readonly CheckRecord[]; goal: number }) {
  let n = 0;
  return (
    <div className="text-ui">
      <p className="mb-1 font-semibold">Scores</p>
      <ol aria-label="Score after each Check" className="flex flex-wrap items-center gap-1">
        {props.checks.map((check, i) => {
          const mark = trailMark(check, props.goal);
          const name = check.opening ? "Start" : `Check ${++n}`;
          const score = formatScore(check.outcome.score.score);
          const reasons = check.outcome.guardrails
            .filter((g) => !g.result.pass)
            .map((g) => g.result.reason ?? `Blocked by ${g.id}.`);
          return (
            <li key={i} className="flex items-center gap-1">
              {i > 0 ? (
                <span aria-hidden className="text-neutral-600">
                  ›
                </span>
              ) : null}
              <span
                title={[`${name}: ${score}`, ...reasons].join(" ")}
                className={
                  `rounded-full px-2 py-0.5 text-fine tabular-nums ring-1 ${TRAIL[mark]}` +
                  (i === props.checks.length - 1 ? " font-semibold ring-2" : "")
                }
              >
                {check.opening ? "start " : ""}
                {mark === "blocked" ? "⚠ " : ""}
                {score}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
