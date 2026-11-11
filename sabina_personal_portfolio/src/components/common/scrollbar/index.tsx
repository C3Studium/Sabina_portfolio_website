import { motion, useSpring, useTransform } from "framer-motion";
import { useRouter } from "next/router";
import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import styles from "./styles.module.scss";

// Vlastní posuvník stránky — lišta čárek pod výzvou v hlavičce (na telefonu
// pod tlačítkem menu), převzatá z eshopu Keramická zahrada (verze před
// 10. 11. 2026). Dlouhá čárka = sekce, krátké = díly mezi nimi. V klidu je
// u pravého kraje stažená na polovinu, najetím / dotykem / tahem se
// roztáhne (styles). Za lištu jde chytit a táhnout nahoru i dolů (myší
// i prstem) — během tahu ukazuje zelený jezdec, kde jsem; klik / ťuknutí
// na čárku doskroluje na místo, hover ukáže názvy sekcí.
// Sekce: `main > section` a k nim značky `[data-scroll-section]` — místo ve
// scrollu, kde začíná sekce, která není samostatný prvek (CTA v dolly
// galerii Procesu); seřazené podle polohy. Název z `data-scroll-label` /
// `aria-label`.

type ScrollSection = {
  element: HTMLElement;
  id: string;
  label: string;
  subdivisions: number;
};

// O kolik px se ukazatel pohne, než je ze stisku tah (jinak je to klik).
const DRAG_SLOP = 3;
// Mezera mezi tlačítkem v hlavičce a lištou (px).
const UNDER_BUTTON = 12;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

const labelAnim = {
  hidden: {
    transition: { staggerChildren: 0.012, staggerDirection: 1 },
  },
  visible: {
    transition: { delayChildren: 0.035, staggerChildren: 0.026, staggerDirection: -1 },
  },
} as const;

const charAnim = {
  hidden: { opacity: 0, x: "0.85em" },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  },
} as const;

const markerSpring = { type: "spring", stiffness: 165, damping: 25, mass: 0.72 } as const;

// Roztažení / stažení lišty (scaleX): pružina s malým překmitem.
const OPEN_SPRING = { stiffness: 340, damping: 24, mass: 0.85 };
// Vlna čárek při otevření: zpoždění na čárku od aktivní (s), strop.
const WAVE_STEP = 0.014;
const WAVE_MAX = 0.32;
// Čárky ve sbalené liště (× k šířce v rozbalené) — při otevření se dotáhnou.
const CLOSED_LINES = 0.7;

/** Scroll přes Lenis (plynule; `immediate` při tahu), bez něj nativně. */
const scrollToTarget = (target: number | HTMLElement, immediate = false) => {
  const lenis = window.lenisInstance;
  if (lenis) {
    lenis.scrollTo(target, { immediate, force: true });
    return;
  }
  const top = typeof target === "number" ? target : target.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top, behavior: immediate ? "auto" : "smooth" });
};

const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
const pageTop = (element: HTMLElement) => element.getBoundingClientRect().top + window.scrollY;

const getPageSections = (): ScrollSection[] => {
  const blocks = Array.from(document.querySelectorAll<HTMLElement>("main > section, main > [role='region']")).filter(
    (element) => element.offsetHeight > 1,
  );
  // Značky sekcí uvnitř jiných (CTA v Procesu) — stačí jim poloha, výšku nemají.
  const marks = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-section]"));
  const candidates = [...new Set([...blocks, ...marks])].filter(
    (element) => window.getComputedStyle(element).display !== "none",
  );

  if (!candidates.length) {
    const main = document.querySelector<HTMLElement>("main");
    if (main) candidates.push(main);
  }

  const tops = new Map(candidates.map((element) => [element, pageTop(element)]));
  candidates.sort((a, b) => (tops.get(a) ?? 0) - (tops.get(b) ?? 0));

  return candidates.map((element, index) => {
    const id = element.id || `page-section-${index + 1}`;
    const label = element.dataset.scrollLabel || element.getAttribute("aria-label") || `Sekce ${index + 1}`;
    if (!element.id) element.id = id;
    // Díly podle délky úseku do další sekce (ne výšky prvku — Proces končí
    // tam, kde začíná CTA uvnitř něj).
    const next = candidates[index + 1];
    const span = next ? (tops.get(next) ?? 0) - (tops.get(element) ?? 0) : element.offsetHeight;
    const sectionViewports = span / Math.max(window.innerHeight, 1);
    const subdivisions = Math.min(16, Math.max(5, Math.round(sectionViewports * 4)));
    return { element, id, label, subdivisions };
  });
};

// Stejné sekce jako minule? Stránka se hýbe pořád (psaní textu, animace)
// a MutationObserver by jinak při každé změně překreslil celou lištu.
const sameSections = (a: ScrollSection[], b: ScrollSection[]) =>
  a.length === b.length &&
  a.every((s, i) => s.element === b[i].element && s.label === b[i].label && s.subdivisions === b[i].subdivisions);

// Pořadí první čárky každé sekce v liště (za ní její díly).
const offsetsOf = (sections: ScrollSection[]) => {
  const offsets: number[] = [];
  let count = 0;
  sections.forEach((section, index) => {
    offsets.push(count);
    count += 1;
    if (index < sections.length - 1) count += section.subdivisions;
  });
  return offsets;
};

/** Kam doskroluje díl `subdivision` sekce `index` (klik na krátkou čárku). */
const subdivisionTarget = (sections: ScrollSection[], index: number, subdivision: number) => {
  const section = sections[index];
  const sectionTop = pageTop(section.element);
  const next = sections[index + 1];
  const sectionEnd = next ? pageTop(next.element) : sectionTop + Math.max(section.element.offsetHeight, window.innerHeight);
  return sectionTop + Math.max(sectionEnd - sectionTop, 1) * ((subdivision + 1) / (section.subdivisions + 1));
};

// Lišta jako stupnice: čárky (svislý střed od vršku lišty, px) → poloha
// scrollu, vzestupně; pod poslední čárkou konec stránky. Podle ní se kreslí
// výplň projeté části i počítá tah.
type Scale = { ys: number[]; targets: number[] };

const scaleOf = (rail: HTMLElement, sections: ScrollSection[]): Scale | null => {
  const offsets = offsetsOf(sections);
  const ys: number[] = [];
  const targets: number[] = [];
  const end = maxScroll();
  rail.querySelectorAll<HTMLElement>("[data-rail-marker]").forEach((marker) => {
    const position = Number(marker.dataset.railMarker);
    const sectionIndex = offsets.reduce((found, offset, index) => (offset <= position ? index : found), 0);
    const step = position - offsets[sectionIndex];
    const target = step === 0 ? pageTop(sections[sectionIndex].element) : subdivisionTarget(sections, sectionIndex, step - 1);
    ys.push(marker.offsetTop + marker.offsetHeight / 2);
    targets.push(Math.min(Math.max(target, 0), end));
  });
  if (!ys.length) return null;
  // Konec stránky na spodku obsahu lišty (nad jejím spodním odsazením).
  const bottom = rail.clientHeight - parseFloat(getComputedStyle(rail).paddingBottom || "0");
  if (end > targets[targets.length - 1]) {
    ys.push(Math.max(bottom, ys[ys.length - 1] + 1));
    targets.push(end);
  }
  // Začátek stránky na vršku obsahu lišty.
  const top = parseFloat(getComputedStyle(rail).paddingTop || "0");
  if (targets[0] > 0) {
    ys.unshift(Math.min(top, ys[0] - 1));
    targets.unshift(0);
  }
  return ys.length > 1 ? { ys, targets } : null;
};

// Poloha na liště → poloha scrollu, lineárně mezi čárkami.
const scrollAt = ({ ys, targets }: Scale, y: number) => {
  if (y <= ys[0]) return targets[0];
  for (let i = 1; i < ys.length; i++) {
    if (y <= ys[i]) return targets[i - 1] + (targets[i] - targets[i - 1]) * ((y - ys[i - 1]) / Math.max(ys[i] - ys[i - 1], 1));
  }
  return targets[targets.length - 1];
};

// Poloha scrollu → poloha na liště (hrana výplně a jezdec).
const railAt = ({ ys, targets }: Scale, scroll: number) => {
  if (scroll <= targets[0]) return ys[0];
  for (let i = 1; i < targets.length; i++) {
    if (scroll <= targets[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * ((scroll - targets[i - 1]) / Math.max(targets[i] - targets[i - 1], 1));
  }
  return ys[ys.length - 1];
};

type Drag = { id: number; startY: number; startScroll: number; railTop: number; active: boolean; scale: Scale };

export default function Scrollbar() {
  const { asPath } = useRouter();
  const [sections, setSections] = useState<ScrollSection[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sectionProgress, setSectionProgress] = useState(0);
  const [hoveredMarker, setHoveredMarker] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  // Sbalená (úzká, u pravého okraje) / rozbalená (pod tlačítkem, celé čárky).
  const [open, setOpen] = useState(false);
  // Vlna čárek běží jen chvíli po otevření (jinak hover bez zpoždění).
  const [wave, setWave] = useState(false);
  const waveTimer = useRef(0);
  const expanded = open || dragging;
  // 0 = sbalená (poloviční šířka), 1 = rozbalená — jen scaleX k pravé hraně.
  const openness = useSpring(0, OPEN_SPRING);
  const railScale = useTransform(openness, (v) => 0.5 + 0.5 * v);
  useEffect(() => {
    openness.set(expanded ? 1 : 0);
  }, [expanded, openness]);
  const navRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);

  const measure = useCallback(() => {
    if (!sections.length) return;
    const readingLine = window.scrollY + window.innerHeight * 0.42;
    let nextActive = 0;
    sections.forEach((section, index) => {
      if (pageTop(section.element) <= readingLine) nextActive = index;
    });
    const active = sections[nextActive];
    const activeTop = pageTop(active.element);
    const nextTop = sections[nextActive + 1]
      ? pageTop(sections[nextActive + 1].element)
      : activeTop + Math.max(active.element.offsetHeight, window.innerHeight);
    const progress = Math.min(1, Math.max(0, (readingLine - activeTop) / Math.max(nextTop - activeTop, 1)));
    setActiveIndex((current) => (current === nextActive ? current : nextActive));
    setSectionProgress(progress);

    // Poloha jezdce (vidět při tahu) — přímo do stylu, bez překreslení Reactu.
    const rail = railRef.current;
    const scale = rail ? scaleOf(rail, sections) : null;
    if (rail && scale) rail.style.setProperty("--fill", `${railAt(scale, window.scrollY).toFixed(1)}px`);
  }, [sections]);

  // Sekce stránky (znovu po změně DOMu, velikosti a stránky).
  useEffect(() => {
    let discoveryFrame = 0;
    let cancelled = false;
    const discover = () => {
      const next = getPageSections();
      setSections((current) => (sameSections(current, next) ? current : next));
    };
    const scheduleDiscovery = () => {
      window.cancelAnimationFrame(discoveryFrame);
      discoveryFrame = window.requestAnimationFrame(discover);
    };
    scheduleDiscovery();
    const observer = new MutationObserver(scheduleDiscovery);
    const resizeObserver = new ResizeObserver(scheduleDiscovery);
    observer.observe(document.body, { childList: true, subtree: true });
    resizeObserver.observe(document.body);
    document.fonts.ready.then(() => {
      if (!cancelled) scheduleDiscovery();
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(discoveryFrame);
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, [asPath]);

  // Poloha lišty: hned pod výzvou v hlavičce, a kde je výzva schovaná
  // (telefon na výšku), pod tlačítkem menu. Vodorovně ji drží CSS (hrana rámu).
  // Hlavička se při přechodu stránek posouvá (transform) — odečte se.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || !sections.length) return;
    const place = () => {
      const visible = (el: Element | null) => {
        const box = el?.getBoundingClientRect();
        return box && box.width > 0 && box.height > 0 ? box : null;
      };
      const box =
        visible(document.querySelector('header [data-intro="cta"]')) ??
        visible(document.querySelector('header [data-intro="menu"]'));
      if (!box) return;
      const header = document.querySelector("header");
      const shift = header ? new DOMMatrix(getComputedStyle(header).transform).m42 : 0;
      nav.style.setProperty("--rail-top", `${Math.round(box.bottom - shift + UNDER_BUTTON)}px`);
    };
    place();
    const header = document.querySelector("header");
    const resizeObserver = new ResizeObserver(place);
    if (header) resizeObserver.observe(header);
    window.addEventListener("resize", place);
    document.fonts.ready.then(place);
    const late = window.setTimeout(place, 1200);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", place);
      window.clearTimeout(late);
    };
  }, [sections.length, asPath]);

  useEffect(() => {
    if (!sections.length) return;
    const requestMeasure = () => {
      if (frame.current !== null) return;
      frame.current = window.requestAnimationFrame(() => {
        measure();
        frame.current = null;
      });
    };
    requestMeasure();
    window.addEventListener("scroll", requestMeasure, { passive: true });
    window.addEventListener("resize", requestMeasure);
    return () => {
      window.removeEventListener("scroll", requestMeasure);
      window.removeEventListener("resize", requestMeasure);
      if (frame.current !== null) {
        window.cancelAnimationFrame(frame.current);
        frame.current = null;
      }
    };
  }, [measure, sections.length]);

  useEffect(() => () => window.clearTimeout(waveTimer.current), []);

  const scrollToSection = (event: MouseEvent<HTMLAnchorElement>, section: ScrollSection) => {
    event.preventDefault();
    scrollToTarget(section.element);
    window.history.replaceState(window.history.state, "", `#${section.id}`);
  };

  const scrollToSubdivision = (sectionIndex: number, subdivision: number) => {
    if (!sections[sectionIndex]) return;
    scrollToTarget(subdivisionTarget(sections, sectionIndex, subdivision));
  };

  if (!sections.length) return null;

  const markerOffsets = offsetsOf(sections);

  const markerScale = (position: number, restingScale: number, maximumScale = 1) => {
    if (hoveredMarker === null) return restingScale;
    const distance = Math.abs(hoveredMarker - position);
    const influence = 0.08 + clamp(1 - distance / 7) * 0.92;
    return restingScale + (maximumScale - restingScale) * influence;
  };

  const hoveredSectionIndex =
    hoveredMarker === null
      ? null
      : markerOffsets.reduce((closest, offset, index) => (offset <= hoveredMarker ? index : closest), 0);

  const markerNearest = (rail: HTMLElement, clientY: number) => {
    let closest: HTMLElement | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    rail.querySelectorAll<HTMLElement>("[data-rail-marker]").forEach((marker) => {
      const bounds = marker.getBoundingClientRect();
      const distance = Math.abs(clientY - (bounds.top + bounds.height / 2));
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = marker;
      }
    });
    return closest as HTMLElement | null;
  };

  // Tah: posun se počítá od místa stisku (lišta neposkočí) a k oběma koncům
  // se zbytek dráhy natáhne — horní konec lišty je začátek stránky, dolní
  // konec. Jako jezdec běžného posuvníku.
  const dragTarget = (d: Drag, clientY: number) => {
    const { targets } = d.scale;
    const first = targets[0];
    const last = targets[targets.length - 1];
    const from = scrollAt(d.scale, d.startY - d.railTop);
    const at = scrollAt(d.scale, clientY - d.railTop);
    const start = Math.min(Math.max(d.startScroll, first), last);
    if (at <= from) return from > first ? first + (at - first) * ((start - first) / (from - first)) : start + (at - from);
    return last > from ? last - (last - at) * ((last - start) / (last - from)) : start + (at - from);
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rail = event.currentTarget;
    const scale = scaleOf(rail, sections);
    if (!scale) return;
    drag.current = {
      id: event.pointerId,
      startY: event.clientY,
      startScroll: window.scrollY,
      railTop: rail.getBoundingClientRect().top,
      active: false,
      scale,
    };
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    if (!d.active) {
      if (Math.abs(event.clientY - d.startY) < DRAG_SLOP) return;
      d.active = true;
      suppressClick.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    scrollToTarget(Math.min(Math.max(dragTarget(d, event.clientY), 0), maxScroll()), true);
  };

  const startWave = () => {
    setWave(true);
    window.clearTimeout(waveTimer.current);
    waveTimer.current = window.setTimeout(() => setWave(false), (WAVE_MAX + 0.4) * 1000);
  };
  const openNow = () => {
    if (!open) startWave();
    setOpen(true);
  };
  // Sbalit hned — bez prodlevy (stažení i čárky naráz, žádná vlna).
  const close = () => {
    if (drag.current?.active) return;
    window.clearTimeout(waveTimer.current);
    setWave(false);
    setOpen(false);
  };
  // Čárka se roztáhne / stáhne se zpožděním podle vzdálenosti od aktivní.
  const activePosition = markerOffsets[activeIndex] ?? 0;
  const lineTransition = (position: number) =>
    wave ? { ...markerSpring, delay: Math.min(Math.abs(position - activePosition) * WAVE_STEP, WAVE_MAX) } : markerSpring;
  const lineK = expanded ? 1 : CLOSED_LINES;

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") window.setTimeout(close, 0);
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    if (d.active) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setDragging(false);
    }
  };

  const handleRailPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    moveDrag(event);
    const directMarker = (event.target as HTMLElement).closest<HTMLElement>("[data-rail-marker]");
    const marker = directMarker && !drag.current?.active ? directMarker : markerNearest(event.currentTarget, event.clientY);
    if (marker) setHoveredMarker(Number(marker.dataset.railMarker));
  };

  // Po tahu nesmí puštění tlačítka kliknout na čárku pod ukazatelem.
  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleRailClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-rail-marker]")) return;
    markerNearest(event.currentTarget, event.clientY)?.click();
  };

  return (
    // `data-motion-hold`: pod oponou a při přechodu stránek schovaná jako hlavička.
    <nav
      ref={navRef}
      className={styles.sidebar}
      aria-label="Navigace v této stránce"
      data-motion-hold=""
      data-open={open || dragging || undefined}
      // Klávesnicí: fokus na čárce lištu rozbalí.
      onFocus={openNow}
      onBlur={close}
      // Myš: najetí roztáhne, odjetí hned stáhne.
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") openNow();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") close();
      }}
    >
      <motion.div
        ref={railRef}
        className={styles.rail}
        style={{ scaleX: railScale, originX: 1 }}
        data-dragging={dragging || undefined}
        onPointerDown={(event) => {
          // Prstem se lišta roztáhne, dokud je dole (tah i ťuknutí).
          suppressClick.current = false;
          openNow();
          startDrag(event);
        }}
        onPointerMove={handleRailPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => {
          if (!drag.current?.active) setHoveredMarker(null);
        }}
        onLostPointerCapture={(event) => {
          setHoveredMarker(null);
          // Tah myší skončil mimo navigaci — sbalit (nad ní ji drží hover).
          if (event.pointerType === "mouse" && !navRef.current?.matches(":hover")) window.setTimeout(close, 0);
        }}
        onClickCapture={handleClickCapture}
        onClick={handleRailClick}
      >
        {/* Jezdec — kde na stránce jsem (--fill); vidět jen během tahu. */}
        <span className={styles.thumb} aria-hidden="true" />

        {sections.map((section, index) => {
          const position = markerOffsets[index];
          const active = index === activeIndex;
          const lineScale = markerScale(position, active ? 1 : 0.56) * lineK;
          const lineProgress = index < activeIndex ? 1 : active ? sectionProgress : 0;
          const labelVisible = (hoveredMarker !== null || dragging) && (active || index === hoveredSectionIndex);
          const itemStyle = { "--line-progress": lineProgress } as CSSProperties;

          return (
            <Fragment key={section.id}>
              <a
                href={`#${section.id}`}
                className={styles.item}
                data-active={active || undefined}
                aria-current={active ? "location" : undefined}
                aria-label={section.label}
                style={itemStyle}
                data-rail-marker={position}
                draggable={false}
                onClick={(event) => scrollToSection(event, section)}
                onFocus={() => setHoveredMarker(position)}
                onBlur={() => setHoveredMarker(null)}
              >
                <motion.span
                  className={styles.label}
                  variants={labelAnim}
                  initial="hidden"
                  animate={labelVisible ? "visible" : "hidden"}
                  data-visible={labelVisible || undefined}
                  aria-hidden="true"
                >
                  {Array.from(section.label).map((character, characterIndex) => (
                    <motion.i variants={charAnim} key={`${section.id}-${characterIndex}`}>
                      {character === " " ? " " : character}
                    </motion.i>
                  ))}
                </motion.span>
                <motion.span
                  className={styles.lineTrack}
                  initial={false}
                  animate={{ scaleX: lineScale }}
                  transition={lineTransition(position)}
                  aria-hidden="true"
                >
                  <i className={styles.lineBase} />
                  <i className={styles.lineProgress} />
                </motion.span>
              </a>

              {index < sections.length - 1 &&
                Array.from({ length: section.subdivisions }, (_, subdivision) => {
                  const stepSize = 1 / section.subdivisions;
                  const stepStart = subdivision * stepSize;
                  const visualScale = 0.58 + ((subdivision * 7 + index * 3) % 5) * 0.05;
                  const minorPosition = markerOffsets[index] + subdivision + 1;
                  const scale = markerScale(minorPosition, visualScale, 1.14) * lineK;
                  const progress = index < activeIndex ? 1 : active ? clamp((sectionProgress - stepStart) / stepSize) : 0;

                  return (
                    <motion.button
                      type="button"
                      className={styles.minorTrack}
                      style={{ "--line-progress": progress } as CSSProperties}
                      initial={false}
                      animate={{ scaleX: scale }}
                      transition={lineTransition(minorPosition)}
                      aria-label={`${section.label}, ${Math.round(((subdivision + 1) / (section.subdivisions + 1)) * 100)} %`}
                      data-rail-marker={minorPosition}
                      key={`${section.id}-step-${subdivision}`}
                      onClick={() => scrollToSubdivision(index, subdivision)}
                      onFocus={() => setHoveredMarker(minorPosition)}
                      onBlur={() => setHoveredMarker(null)}
                    >
                      <i className={styles.lineBase} />
                      <i className={styles.lineProgress} />
                    </motion.button>
                  );
                })}
            </Fragment>
          );
        })}
      </motion.div>
    </nav>
  );
}
