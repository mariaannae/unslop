import type { BeatNote } from "./feedback";

/**
 * The arcade effects (spec B.48): chiptune sounds made with the Web Audio API,
 * screen shake, a flash, and a burst of pixel confetti, plus the rhythm track's
 * playback (spec B.52). Presentation only; nothing here touches the game. Motion
 * is skipped for players whose device asks to reduce it, and sound plays only
 * once the player turns it on, or presses Play on the rhythm track.
 */

export type Sound = "on" | "check" | "better" | "worse" | "blocked" | "worked" | "win" | "lose";

/** A tune: notes as [frequency in Hz, start in s, length in s], on one wave shape. */
type Tune = {
  wave: OscillatorType;
  notes: Array<[number, number, number]>;
  volume?: number;
  /** Each note slides to this frequency, for a buzz that sags. */
  slideTo?: number;
};

const TUNES: Record<Sound, Tune> = {
  on: { wave: "square", notes: [[1047, 0, 0.06]] },
  check: {
    wave: "square",
    notes: [
      [660, 0, 0.05],
      [990, 0.05, 0.06],
    ],
  },
  // A coin: B5 then E6.
  better: {
    wave: "square",
    notes: [
      [988, 0, 0.08],
      [1319, 0.08, 0.3],
    ],
  },
  worse: {
    wave: "triangle",
    volume: 0.12,
    notes: [
      [392, 0, 0.12],
      [262, 0.12, 0.25],
    ],
  },
  blocked: { wave: "sawtooth", volume: 0.05, slideTo: 70, notes: [[150, 0, 0.32]] },
  worked: { wave: "square", volume: 0.035, notes: [[1568, 0, 0.05]] },
  // C E G C, a step back, then C again.
  win: {
    wave: "square",
    notes: [
      [523, 0, 0.1],
      [659, 0.1, 0.1],
      [784, 0.2, 0.1],
      [1047, 0.3, 0.3],
      [784, 0.45, 0.08],
      [1047, 0.53, 0.5],
    ],
  },
  // Four falling notes.
  lose: {
    wave: "triangle",
    volume: 0.12,
    notes: [
      [392, 0, 0.18],
      [370, 0.2, 0.18],
      [349, 0.4, 0.18],
      [311, 0.6, 0.6],
    ],
  },
};

/** A player's on/off choice, remembered on this device. */
function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSetting(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? "on" : "off");
  } catch {
    // Storage blocked (a private window): the choice lasts for this page only.
  }
}

const SOUND_KEY = "unslop.sound";
const RHYTHM_KEY = "unslop.rhythm";
let soundEnabled = readSetting(SOUND_KEY) === "on";
let audio: AudioContext | null = null;

/** Whether the player has turned sound on. Off until they do; remembered on this device. */
export function soundOn(): boolean {
  return soundEnabled;
}

export function setSoundOn(on: boolean) {
  soundEnabled = on;
  writeSetting(SOUND_KEY, on);
  if (on) play("on");
}

/** Whether the rhythm track shows (spec B.52). On until the player turns it off. */
export function rhythmOn(): boolean {
  return readSetting(RHYTHM_KEY) !== "off";
}

export function setRhythmOn(on: boolean) {
  writeSetting(RHYTHM_KEY, on);
}

/**
 * Plays the rhythm track's notes (spec B.52), calling `onNote` with each note's
 * index as it starts and null when it ends. It plays even with sound off, since
 * the player pressed Play; without Web Audio only the lights play. Returns a
 * function that stops it.
 */
export function playBeat(
  notes: readonly BeatNote[],
  onNote: (index: number | null) => void,
): () => void {
  const lead = 0.05;
  const oscillators: OscillatorNode[] = [];
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const begin = audio.currentTime + lead;
    for (const { start, length, frequency } of notes) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const [on, off] = [begin + start, begin + start + length];
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(frequency, on);
      gain.gain.setValueAtTime(0.04, on);
      gain.gain.setValueAtTime(0.04, Math.max(on, off - 0.04));
      gain.gain.exponentialRampToValueAtTime(0.0001, off);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(on);
      oscillator.stop(off + 0.02);
      oscillators.push(oscillator);
    }
  } catch {
    // No Web Audio: the blocks still light up in time.
  }
  const timers = notes.map((note, i) =>
    window.setTimeout(() => onNote(i), (lead + note.start) * 1000),
  );
  const last = notes.at(-1);
  const end = last ? last.start + last.length : 0;
  timers.push(window.setTimeout(() => onNote(null), (lead + end) * 1000 + 60));
  return () => {
    timers.forEach((timer) => window.clearTimeout(timer));
    for (const oscillator of oscillators) {
      try {
        oscillator.stop();
      } catch {
        // Already stopped.
      }
    }
    onNote(null);
  };
}

export function play(sound: Sound) {
  if (!soundEnabled) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const tune = TUNES[sound];
    const start = audio.currentTime + 0.01;
    for (const [frequency, at, length] of tune.notes) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = tune.wave;
      oscillator.frequency.setValueAtTime(frequency, start + at);
      if (tune.slideTo)
        oscillator.frequency.linearRampToValueAtTime(tune.slideTo, start + at + length);
      gain.gain.setValueAtTime(tune.volume ?? 0.06, start + at);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + at + length);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start + at);
      oscillator.stop(start + at + length + 0.02);
    }
  } catch {
    // No Web Audio: the game plays on in silence.
  }
}

export function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Jolts an element sideways for a moment, like taking a hit. */
export function shake(element: HTMLElement | null) {
  if (!element || reducedMotion()) return;
  element.animate(
    [0, -8, 7, -6, 4, -2, 0].map((x) => ({ transform: `translateX(${x}px)` })),
    { duration: 380, easing: "linear" },
  );
}

/**
 * Rings elements in a cyan glow that fades out. Only the shadow animates, so the
 * element's own colour change (amber to blue) plays out undisturbed.
 */
export function flash(elements: Iterable<Element>) {
  if (reducedMotion()) return;
  for (const element of elements) {
    element.animate(
      [
        { boxShadow: "0 0 0 3px rgb(103 232 249), 0 0 14px rgb(103 232 249)" },
        { boxShadow: "0 0 0 3px rgb(103 232 249 / 0), 0 0 14px rgb(103 232 249 / 0)" },
      ],
      { duration: 600, easing: "ease-out" },
    );
  }
}

/** NONSLOP's hard-mode confetti was gold; this adds its title yellow, magenta and cyan. */
const CONFETTI = ["#ffd700", "#fbf056", "#f8ac3a", "#9e0e77", "#00e5ff", "#ffffff"];

/**
 * A burst of pixel confetti over the whole window. It is drawn on a canvas at a
 * quarter of the screen's resolution and scaled up without smoothing, so every
 * bit is a chunky pixel.
 */
export function confetti() {
  if (reducedMotion()) return;
  const scale = 4;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    pointerEvents: "none",
    zIndex: "50",
    imageRendering: "pixelated",
  });
  canvas.width = Math.ceil(window.innerWidth / scale);
  canvas.height = Math.ceil(window.innerHeight / scale);
  const context = canvas.getContext("2d");
  if (!context) return;
  document.body.append(canvas);

  const bits = Array.from({ length: 90 }, () => ({
    x: canvas.width / 2 + (Math.random() - 0.5) * 20,
    y: canvas.height * 0.55,
    vx: (Math.random() - 0.5) * 5,
    vy: -2.5 - Math.random() * 4,
    size: Math.random() < 0.6 ? 1 : 2,
    color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)]!,
  }));
  const began = performance.now();
  const frame = (now: number) => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const bit of bits) {
      bit.vy += 0.12;
      bit.x += bit.vx;
      bit.y += bit.vy;
      context.fillStyle = bit.color;
      context.fillRect(Math.round(bit.x), Math.round(bit.y), bit.size, bit.size);
    }
    if (now - began < 2200) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
