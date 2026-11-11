// Bannery za portrétem v heru (banners.ts) — stálá vrstva, obraz ztlumený,
// detaily (popisky, rámečky, slova, tvary) výrazné. Mají vlastní hodiny
// (s, timeline BANNERS) řízené stavem `show`, a běží ve smyčce:
//
//   show → stavba 0 → BANNERS.hold, HOLD_FOR s stojí, odchod pozpátku
//          (skok na BANNERS.out, doběh do konce) a další dvojice bannerů
//          s novými slovy a tvary — dokola
//   schovat → odchod; během stavby se stavba jen vrátí zpátky
//   znovu show → když ještě odcházejí, vrátí se; jinak nová stavba
//
// Dvojice se berou postupně z promíchaného pořadí zdrojů. Další dvojice se
// během stání načte dopředu (obraz i rozklad), aby nová stavba nečekala.
// Bez pohybu (`still`) rovnou hotový stav / nic, bez smyčky.

import { useEffect, useRef, useState, type RefObject } from "react";
import { animate, useMotionValue, useMotionValueEvent, type AnimationPlaybackControls } from "framer-motion";
import { createBanners, type BannerSource } from "./banners";
import { loadLayers } from "./layered";
import { BANNERS, BANNERS_END } from "./timeline";
import { ACCENT, SNOW_RGB } from "@/lib/palette";

/* ---------- Nastavení ---------- */

const LOOK = {
  accent: ACCENT,
  mark: `rgba(${SNOW_RGB}, 0.9)`,
};

// Bannery jdou přes optimalizaci obrázků — originály mají i 2560 px na výšku.
const WIDTH = 640;
const optimized = (src: string) => `/_next/image?url=${encodeURIComponent(src)}&w=${WIDTH}&q=75`;

// Jak dlouho (s) hotová dvojice stojí, než se vymění za další.
const HOLD_FOR = 3;
// Jak rychle se stavba vrací zpátky, když se schová ještě nehotová (× její tempo).
const UNBUILD = 2;

/* ---------- Komponenta ---------- */

type IntroBannersProps = {
  /** Obrázky bannerů (projekty); střídají se po dvojicích. */
  sources: string[];
  /** Prvek, v jehož místě se bannery staví (portrét). */
  area: RefObject<HTMLElement | null>;
  /** Mají bannery stát? Změna spustí stavbu / odchod. */
  show: boolean;
  /** Zpoždění (s) PRVNÍ stavby. */
  delay?: number;
  /** Bez pohybu: rovnou hotové / pryč, bez smyčky. */
  still?: boolean;
  /** Tempo: 1 = jako v heru, 2 = dvakrát pomaleji (stavba, stání i odchod). */
  pace?: number;
  /** Levý okraj pole pro slova a tvary (část šířky okna), viz banners.ts. */
  fieldLeft?: number;
  /** Spodní linka bannerů (část výšky okna), viz banners.ts. */
  baseline?: number;
  /** Výšky bannerů × tohle, viz banners.ts. */
  scale?: number;
  /** Bannery přes rám (část šířky okna) místo k portrétu, viz banners.ts. */
  across?: number;
  className?: string;
};

const shuffled = (list: string[]) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const pairAt = (order: string[], round: number): BannerSource[] =>
  order.length
    ? [0, 1].map((k) => {
        const src = order[(round * 2 + k) % order.length];
        return { src, url: optimized(src) };
      })
    : [];

export default function IntroBanners({ sources, area, show, delay = 0, still = false, pace = 1, fieldLeft, baseline, scale, across, className }: IntroBannersProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bannersRef = useRef<ReturnType<typeof createBanners>>(null);
  const firstRef = useRef(true);
  const clock = useMotionValue(0);
  const key = sources.join("\n");
  // Pořadí bannerů pro tuhle návštěvu (náhodně, jednou) a kolo smyčky.
  const [order] = useState(() => shuffled(sources));
  const [round, setRound] = useState(0);
  // Kolo, jehož bannery jsou připravené (načtené obrázky i rozklad).
  const [readyRound, setReadyRound] = useState(-1);
  const ready = readyRound === round;
  const list = key ? order.filter((src) => sources.includes(src)) : [];
  const pairKey = pairAt(list, round)
    .map(({ src }) => src)
    .join("\n");

  // Dvojice bannerů tohoto kola na plátně.
  useEffect(() => {
    const canvas = canvasRef.current;
    const el = area.current;
    if (!canvas || !el || !pairKey) return;
    const pair = pairKey.split("\n").map((src) => ({ src, url: optimized(src) }));
    const banners = createBanners(canvas, el, pair, LOOK, { fieldLeft, baseline, scale, across });
    bannersRef.current = banners;
    let cancelled = false;
    banners?.whenReady.then(() => {
      if (!cancelled) setReadyRound(round);
    });
    return () => {
      cancelled = true;
      banners?.destroy();
      bannersRef.current = null;
    };
  }, [pairKey, area, round, fieldLeft, baseline, scale, across]);

  useMotionValueEvent(clock, "change", (t) => bannersRef.current?.draw(t));

  // Stavba, stání, výměna a odchod podle `show`.
  useEffect(() => {
    if (!ready) return;
    const t = clock.get();
    if (still) {
      clock.jump(show ? BANNERS.hold : 0);
      return;
    }
    let controls: AnimationPlaybackControls | null = null;
    let timer = 0;

    // Hotovo: chvíli stát, pak odejít a postavit další dvojici.
    const holdThenNext = () => {
      if (list.length < 3) return; // stejné bannery by se jen opakovaly
      // Další dvojici načíst dopředu, ať nová stavba nečeká.
      for (const { src, url } of pairAt(list, round + 1)) {
        const img = new Image();
        img.src = url;
        void loadLayers(src);
      }
      timer = window.setTimeout(() => {
        clock.jump(BANNERS.out);
        controls = animate(clock, BANNERS_END, {
          duration: (BANNERS_END - BANNERS.out) * pace,
          ease: "linear",
          onComplete: () => {
            clock.jump(0);
            setRound((r) => r + 1);
          },
        });
      }, HOLD_FOR * pace * 1000);
    };

    if (show) {
      const first = firstRef.current;
      firstRef.current = false;
      if (t > BANNERS.out) {
        // Ještě odcházejí: vrátit odchod (stav v OUT = hotový jako v HOLD).
        controls = animate(clock, BANNERS.out, {
          duration: (t - BANNERS.out) * pace,
          ease: "linear",
          onComplete: () => {
            clock.jump(BANNERS.hold);
            holdThenNext();
          },
        });
      } else {
        const from = t > BANNERS.hold ? 0 : t;
        if (from !== t) clock.jump(from);
        controls = animate(clock, BANNERS.hold, {
          duration: (BANNERS.hold - from) * pace,
          delay: first ? delay : 0,
          ease: "linear",
          onComplete: holdThenNext,
        });
      }
    } else if (t > 0) {
      if (t < BANNERS.hold) {
        // Nehotová stavba se jen vrátí.
        controls = animate(clock, 0, { duration: (t / UNBUILD) * pace, ease: "linear" });
      } else {
        if (t < BANNERS.out) clock.jump(BANNERS.out);
        controls = animate(clock, BANNERS_END, {
          duration: (BANNERS_END - clock.get()) * pace,
          ease: "linear",
          onComplete: () => clock.jump(0),
        });
      }
    }
    return () => {
      controls?.stop();
      window.clearTimeout(timer);
    };
    // `list` se odvozuje z `order` a `key` — stačí kolo a připravenost.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, still, ready, delay, clock, round, pace]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
