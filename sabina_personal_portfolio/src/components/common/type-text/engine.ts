// TypeText — engine. Převzaté z GhostType a zúžené na samotné PSANÍ (bez
// ghost doplňování, nápovědy a smyček): zástupný text se označí (zvýraznění
// výběru jako v editoru), smaže a pak se píše znak po znaku s lidským
// tempem (náhodný rozptyl, delší pauza za mezerou a interpunkcí). Kurzor
// při psaní svítí, po dopsání bliká a pak zhasne.
//
// Text je v úsecích (`segments`) — úsek může mít vlastní třídu (zvýrazněné
// slovo v barvě). Konce řádků jsou "\n" (obal má `white-space: pre-wrap`).

export type TypeSegment = { text: string; className?: string };

export type TypeCaret = "bar" | "block" | "underscore";

export type TypeSettings = {
  segments: TypeSegment[];
  placeholder: string;
  accentColor: string;
  /** Základní prodleva mezi znaky (ms). */
  typeSpeed: number;
  /** Jak dlouho je zástupný text označený, než se smaže (ms). */
  selectDelay: number;
  /** Jak dlouho po dopsání kurzor bliká, než zhasne (ms). */
  caretHold: number;
  caret: TypeCaret;
  caretBlink: boolean;
  onDone?: () => void;
};

export type Typer = {
  /** Spustí psaní od začátku. */
  play: () => void;
  /** Vrátí na zástupný text (před psaním). */
  reset: () => void;
  /** Hotový text bez animace. */
  finish: () => void;
  destroy: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const splitGraphemes = (value: string) => {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(value), (part) => part.segment);
  }
  return Array.from(value);
};

export function createTyper(line: HTMLElement, settingsRef: { current: TypeSettings }): Typer {
  const doc = line.ownerDocument;
  const view = doc.defaultView ?? window;
  const S = () => settingsRef.current;

  const placeholderEl = doc.createElement("span");
  const typedEl = doc.createElement("span");
  const caretEl = doc.createElement("span");
  placeholderEl.setAttribute("data-placeholder", "");
  placeholderEl.style.borderRadius = "0.08em";
  placeholderEl.style.setProperty("box-decoration-break", "clone");
  placeholderEl.style.setProperty("-webkit-box-decoration-break", "clone");
  caretEl.setAttribute("aria-hidden", "true");
  line.replaceChildren(placeholderEl, typedEl, caretEl);

  let gen = 0;
  let timer = 0;
  let destroyed = false;
  let blink: Animation | null = null;
  let caretOpacity = 1;

  const styleCaret = () => {
    const s = S();
    const c = caretEl.style;
    c.display = "inline-block";
    c.background = s.accentColor;
    c.position = "relative";
    if (s.caret === "block") {
      c.width = "0.5em";
      c.height = "0.9em";
      c.verticalAlign = "-0.12em";
      c.marginRight = "-0.5em";
      c.borderRadius = "0.06em";
      caretOpacity = 0.55;
    } else if (s.caret === "underscore") {
      c.width = "0.5em";
      c.height = "0.07em";
      c.verticalAlign = "-0.1em";
      c.marginRight = "-0.5em";
      c.borderRadius = "0.04em";
      caretOpacity = 1;
    } else {
      c.width = "max(2px, 0.05em)";
      c.height = "0.92em";
      c.verticalAlign = "-0.14em";
      c.marginLeft = "0.02em";
      c.marginRight = "calc(-1 * max(2px, 0.05em) - 0.02em)";
      c.borderRadius = "1px";
      caretOpacity = 1;
    }
    c.opacity = String(caretOpacity);
    blink?.cancel();
    blink = null;
  };

  const caretState = (state: "solid" | "blink" | "hidden") => {
    if (!blink) {
      const o = caretOpacity;
      blink = caretEl.animate(
        [
          { opacity: o, offset: 0 },
          { opacity: o, offset: 0.46 },
          { opacity: 0, offset: 0.54 },
          { opacity: 0, offset: 0.94 },
          { opacity: o, offset: 1 },
        ],
        { duration: 1060, iterations: Infinity, easing: "ease-in-out" },
      );
      blink.cancel();
    }
    caretEl.style.visibility = state === "hidden" ? "hidden" : "visible";
    if (state === "blink" && S().caretBlink) {
      blink.currentTime = 0;
      blink.play();
    } else {
      blink.cancel();
    }
  };

  const sleep = (ms: number, g: number) =>
    new Promise<void>((resolve) => {
      timer = view.setTimeout(() => {
        timer = 0;
        if (g === gen && !destroyed) resolve();
      }, Math.max(0, ms));
    });

  const showPlaceholder = () => {
    placeholderEl.textContent = S().placeholder;
    placeholderEl.style.background = "";
    typedEl.replaceChildren();
  };

  const renderFinal = () => {
    placeholderEl.textContent = "";
    placeholderEl.style.background = "";
    typedEl.replaceChildren(
      ...S().segments.map((segment) => {
        const span = doc.createElement("span");
        if (segment.className) span.className = segment.className;
        span.textContent = segment.text;
        return span;
      }),
    );
    caretState("hidden");
  };

  const run = async (g: number) => {
    const s = S();
    styleCaret();
    showPlaceholder();
    // 1. Zástupný text se označí (jako výběr v editoru) a smaže.
    if (s.placeholder) {
      placeholderEl.style.background = `color-mix(in oklab, ${s.accentColor} 32%, transparent)`;
      caretState("hidden");
      await sleep(s.selectDelay, g);
      placeholderEl.textContent = "";
      placeholderEl.style.background = "";
    }
    caretState("solid");
    // 2. Psaní znak po znaku, úsek po úseku.
    typedEl.replaceChildren();
    for (const segment of S().segments) {
      const span = doc.createElement("span");
      if (segment.className) span.className = segment.className;
      typedEl.appendChild(span);
      for (const char of splitGraphemes(segment.text)) {
        if (g !== gen) return;
        span.textContent += char;
        const base = clamp(S().typeSpeed, 5, 1000);
        await sleep(base * (0.6 + Math.random() * 0.8) + (/[\s.,!?]/.test(char) ? base * 0.8 : 0), g);
      }
    }
    // 3. Kurzor chvíli bliká a zhasne.
    caretState("blink");
    await sleep(S().caretHold, g);
    caretState("hidden");
    S().onDone?.();
  };

  styleCaret();
  showPlaceholder();
  caretState("hidden");

  return {
    play: () => {
      gen += 1;
      if (timer) view.clearTimeout(timer);
      void run(gen);
    },
    reset: () => {
      gen += 1;
      if (timer) view.clearTimeout(timer);
      showPlaceholder();
      caretState("hidden");
    },
    finish: () => {
      gen += 1;
      if (timer) view.clearTimeout(timer);
      renderFinal();
    },
    destroy: () => {
      destroyed = true;
      gen += 1;
      if (timer) view.clearTimeout(timer);
      blink?.cancel();
      line.replaceChildren();
    },
  };
}
