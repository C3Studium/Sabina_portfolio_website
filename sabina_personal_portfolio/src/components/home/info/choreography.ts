// Info — choreografie umělé myši („grafik před vámi").
//
// Řídí ji scroll ve čtyřech úsecích:
//   hero (0–1)    průběh přišpendleného hera (hero/progress.ts). Myš přiletí,
//                 označí 3D scénu s kartami a SMAŽE ji (pravé tlačítko →
//                 „Smazat" v kontextové nabídce), pak klikne
//                 na portrét a táhne ho na místo v Info (přelet píše hero).
//   stage (0–1)   přišpendlená Info. Myš postaví pilulky (první jako odkaz
//                 hlavičky, další DUPLIKÁTY — Ctrl/⌘ + D), napíše nadpis
//                 a text, nakreslí rámeček karet. Pak dotáhne zprava (zpoza
//                 okraje okna) lištu statistik. Následuje volný čas (myš jen „přemýšlí", karty
//                 se dají ovládat) a mazání: lišta, karty, pak výběr tažením
//                 přes celý levý sloupec a smazání najednou. Zbude portrét.
//   process enter Proces vyjíždí zdola (0–1). Myš nese portrét (letící kopie
//                 ve fixed) na místo portrétu v Procesu — dosedne až
//                 v prvních ~20vh přišpendleného Procesu (pomalu).
//   process (0–1) přišpendlený Proces: myš napíše nadpis a text, přidá
//                 nápovědu posunu a odejde (designer-timeline.ts).
//
// Všechno se počítá ze živých obdélníků prvků KAŽDÝ SNÍMEK, dokud je něco
// z toho v dosahu — sekce se navzájem posouvají a výpočet jen při změně
// scrollu by byl o snímek pozadu (výběr by zaostával za fotkou).

import { useMemo, useRef, useState, type RefObject } from "react";
import { useAnimationFrame, useMotionValue, type MotionValue } from "framer-motion";
import { useRefRegistry } from "@/providers/RefContext";
import { SCENE_DELETED, heroAt, heroProgress } from "@/components/home/hero/progress";
import { isTyped, resetTyped } from "@/components/home/typing";
import { PROCESS, PROCESS_PINNED } from "@/components/home/designer-timeline";
import type { LayerRow } from "./designer";
import { PORTRAIT_TABLET, viewFrame, viewportHeight } from "@/lib/fluid";

/* ---------- Časy ---------- */

// Úsek hera ve vh jeho přišpendleného scrollu (heroAt, hero/progress.ts).
// Mazání scény jako v editoru, ať je vidět, proč zmizela: klik (výběr),
// pravé tlačítko → kontextová nabídka, myš sjede na „Smazat" a klikne.
// Scéna zmizí v SCENE_DELETED (421,5vh), přelet portrétu od 489vh.
const HERO = {
  arrive: [heroAt(370), heroAt(400)] as const,
  select: heroAt(403),
  /** Pravé tlačítko — otevře kontextovou nabídku. */
  menu: heroAt(407.5),
  /** Myš sjede na položku „Smazat" … */
  toDelete: [heroAt(410), heroAt(415.5)] as const,
  /** … položka se zvýrazní a myš na ni klikne. */
  deleteClick: heroAt(419.5),
  remove: SCENE_DELETED,
  toPortrait: [heroAt(447), heroAt(478)] as const,
  portrait: heroAt(484),
  /** Panel vrstev naskočí, když myš označí scénu. */
  panel: [heroAt(396), heroAt(410)] as const,
};

// Stavba v Info — podíly původního rozvržení, stlačené do první části
// přišpendleného úseku (BUILD); zbytek patří liště, volnému času a mazání.
const BUILD = 0.62;
const BASE = {
  release: [0, 0.06] as const,
  toPill: [0.04, 0.11] as const,
  pill: [0.09, 0.21] as const,
  dupStart: 0.21,
  dupLen: 0.075,
};

export type Window = readonly [number, number];

const sc = (v: number) => v * BUILD;
const scw = ([a, b]: Window): Window => [sc(a), sc(b)];

export const flowFor = (count: number) => {
  const dup = (i: number) => {
    const a = BASE.dupStart + (i - 1) * BASE.dupLen;
    const b = a + BASE.dupLen;
    const drop = a + BASE.dupLen * 0.55;
    return {
      a: sc(a),
      b: sc(b),
      drop: sc(drop),
      drag: scw([a, drop]),
      build: scw([drop - BASE.dupLen * 0.15, b + 0.02]),
    };
  };
  const dupEndRaw = count > 1 ? BASE.dupStart + (count - 1) * BASE.dupLen : BASE.pill[1];
  const toHeading: Window = scw([dupEndRaw + 0.01, dupEndRaw + 0.05]);
  const headingClick = sc(dupEndRaw + 0.065);
  const toLead: Window = scw([dupEndRaw + 0.105, dupEndRaw + 0.145]);
  const leadClick = sc(dupEndRaw + 0.16);
  const cta = sc(dupEndRaw + 0.18);
  const toCards: Window = scw([dupEndRaw + 0.2, dupEndRaw + 0.24]);
  const draw: Window = scw([dupEndRaw + 0.24, dupEndRaw + 0.33]);
  const cardsIn = draw[1] - 0.006;
  // Lišta: myš odjede za pravý okraj, chytí lištu a dotáhne ji na místo.
  const toBar: Window = [draw[1] + 0.008, draw[1] + 0.028];
  const barDrag: Window = [toBar[1], toBar[1] + 0.03];
  // Volný čas (~75vh): myš jen „přemýšlí", karty se dají ovládat.
  const rest: Window = [barDrag[1] + 0.005, barDrag[1] + 0.13];
  // Mazání: lišta, karty, výběr tažením přes levý sloupec, smazání.
  const delBar = { to: [rest[1], rest[1] + 0.015] as Window, select: rest[1] + 0.02, remove: rest[1] + 0.03 };
  const delCards = {
    to: [delBar.remove + 0.008, delBar.remove + 0.023] as Window,
    select: delBar.remove + 0.028,
    remove: delBar.remove + 0.038,
  };
  const marquee = {
    to: [delCards.remove + 0.008, delCards.remove + 0.023] as Window,
    drag: [delCards.remove + 0.023, delCards.remove + 0.053] as Window,
    select: delCards.remove + 0.055,
    remove: delCards.remove + 0.068,
  };
  // Portrét: myš ho chytí a nese do Procesu.
  const toPortrait: Window = [marquee.remove + 0.008, marquee.remove + 0.028];
  const grab = toPortrait[1] + 0.005;
  return {
    dup,
    release: scw(BASE.release),
    toPill: scw(BASE.toPill),
    pill: scw(BASE.pill),
    dupStart: sc(BASE.dupStart),
    toHeading,
    headingClick,
    toLead,
    leadClick,
    cta,
    toCards,
    draw,
    cardsIn,
    toBar,
    barDrag,
    rest,
    delBar,
    delCards,
    marquee,
    toPortrait,
    grab,
  };
};

export type Flow = ReturnType<typeof flowFor>;

// Let portrétu do Procesu: v Info (od chycení do konce) urazí FLIGHT_LIFT
// cesty, zbytek během vyjíždění Procesu.
const FLIGHT_LIFT = 0.15;

/* ---------- Pomůcky ---------- */

export const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
export const within = ([a, b]: Window) => (p: number) => clamp01((p - a) / (b - a));
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** Krátký stisk kolem okamžiku `at` (klik). */
export const click = (p: number, at: number, len = 0.006) => (Math.abs(p - at) < len ? 1 - Math.abs(p - at) / len : 0);
export const near = (p: number, at: number, before = 0.004, after = 0.01) => p >= at - before && p <= at + after;

export type Pt = [number, number];
export type Rect = { left: number; top: number; width: number; height: number; right: number; bottom: number };
export type Box = { r: Rect; label: string; o: number } | null;

export const move = (a: Pt, b: Pt, t: number): Pt => [mix(a[0], b[0], ease(t)), mix(a[1], b[1], ease(t))];
const mixRect = (a: Rect, b: Rect, t: number): Rect => {
  const left = mix(a.left, b.left, t);
  const top = mix(a.top, b.top, t);
  const width = mix(a.width, b.width, t);
  const height = mix(a.height, b.height, t);
  return { left, top, width, height, right: left + width, bottom: top + height };
};
export const rectFrom = (a: Pt, b: Pt): Rect => {
  const left = Math.min(a[0], b[0]);
  const top = Math.min(a[1], b[1]);
  const width = Math.abs(b[0] - a[0]);
  const height = Math.abs(b[1] - a[1]);
  return { left, top, width, height, right: left + width, bottom: top + height };
};
export const center = (r: Rect): Pt => [r.left + r.width / 2, r.top + r.height / 2];

/** Výběr / najetí / letící obraz jako MotionValues. */
export function useBoxValues() {
  return {
    x: useMotionValue(0),
    y: useMotionValue(0),
    width: useMotionValue(0),
    height: useMotionValue(0),
    opacity: useMotionValue(0),
    label: useMotionValue(""),
  };
}

/* ---------- Hook ---------- */

type Refs = {
  list: RefObject<HTMLElement | null>;
  heading: RefObject<HTMLElement | null>;
  lead: RefObject<HTMLElement | null>;
  cards: RefObject<HTMLElement | null>;
  stats: RefObject<HTMLElement | null>;
  intro: RefObject<HTMLElement | null>;
};

type Options = {
  stage: MotionValue<number>;
  /** Názvy pilulek (nástroje) v pořadí. */
  names: string[];
  refs: Refs;
  /** Odsazení rámečku karet (px) — kurzor kreslí jeho roh. */
  cardsPad: number;
  enabled: boolean;
};

export type Typing = { heading: boolean; lead: boolean; cards: boolean };
export type Shortcut = "duplicate" | "delete" | "select" | "text" | "send" | null;

export function useDesigner({ stage, names, refs, cardsPad, enabled }: Options) {
  const registry = useRefRegistry();
  const flow = useMemo(() => flowFor(names.length), [names.length]);

  const cursor = {
    x: useMotionValue(-200),
    y: useMotionValue(-200),
    opacity: useMotionValue(0),
    press: useMotionValue(0),
    duplicate: useMotionValue(0),
  };
  // Kontextová nabídka nad 3D scénou v heru (designer.tsx ContextMenu);
  // `hot` = zvýraznění položky „Smazat" pod myší.
  const menu = {
    x: useMotionValue(0),
    y: useMotionValue(0),
    opacity: useMotionValue(0),
    hot: useMotionValue(0),
  };
  /** Bod položky „Smazat" — myš na něm zůstane i po zavření nabídky. */
  const deletePtRef = useRef<Pt | null>(null);
  const selection = useBoxValues();
  const hover = useBoxValues();
  const marqueeBox = useBoxValues();
  const flight = useBoxValues();
  /** 1 = portrét v Info je vidět, 0 = letí (kopie). */
  const infoPortrait = useMotionValue(1);
  const panelOpacity = useMotionValue(0);
  const panelScale = useMotionValue(0);
  /** Posun panelů (px). Na tabletu na výšku stojí panel v Info vlevo pod
   *  textem — v úvodu Procesu by ležel přes nadpis, proto při přechodu
   *  odjede doprava nahoru, na místo panelu Procesu (process/styles). */
  const panelX = useMotionValue(0);
  const panelY = useMotionValue(0);
  const tabletQuery = useRef<MediaQueryList | null>(null);
  const [layers, setLayers] = useState<{ rows: LayerRow[]; active: string | null }>({ rows: [], active: null });
  const [typing, setTyping] = useState<Typing>({ heading: false, lead: false, cards: false });
  const [shortcut, setShortcut] = useState<Shortcut>(null);
  // Psaní: textový kurzor, dokud TypeText nedopíše (home/typing.ts) nebo
  // dokud myš nejde dál. Na psaní se nečeká.
  const [textCursor, setTextCursor] = useState(false);
  const stateKey = useRef("");
  const processHidden = useRef<HTMLElement | null>(null);

  const writeBox = (target: ReturnType<typeof useBoxValues>, value: Box) => {
    if (value && value.o > 0.001) {
      target.x.set(value.r.left);
      target.y.set(value.r.top);
      target.width.set(value.r.width);
      target.height.set(value.r.height);
      target.label.set(
        value.label ? `${value.label} · ${Math.round(value.r.width)} × ${Math.round(value.r.height)}` : "",
      );
      target.opacity.set(value.o);
    } else {
      target.opacity.set(0);
    }
  };

  // Portrét v Procesu je během letu schovaný (nese ho kopie).
  const hideProcess = (el: HTMLElement | null) => {
    if (processHidden.current === el) return;
    if (processHidden.current) processHidden.current.style.opacity = "";
    if (el) el.style.opacity = "0";
    processHidden.current = el;
  };

  const update = (h: number, p: number, pe: number, ps: number, processImg: HTMLElement | null) => {
    const info = registry.get("info-portrait")?.getBoundingClientRect();
    // Bez portrétu v Info (úzká obrazovka) i ve Studiu se myš nehraje.
    if (!enabled || !info || !info.width) {
      cursor.opacity.set(0);
      menu.opacity.set(0);
      selection.opacity.set(0);
      hover.opacity.set(0);
      marqueeBox.opacity.set(0);
      flight.opacity.set(0);
      panelOpacity.set(0);
      panelScale.set(0);
      infoPortrait.set(1);
      hideProcess(null);
      return;
    }
    // Rám obsahu (strop 2560 × 1440, lib/fluid): fx / fy jeho levý a horní
    // okraj, vw / vh jeho rozměr.
    const frame = viewFrame();
    const fx = frame.x;
    const fy = frame.y;
    const vw = frame.w;
    const vh = frame.h;
    const grabOf = (r: Rect): Pt => [r.left + r.width * 0.46, r.top + r.height * 0.42];
    const pills = Array.from(refs.list.current?.children ?? []) as HTMLElement[];
    const pillRect = (i: number) => pills[i]?.getBoundingClientRect();
    const pillPt = (i: number): Pt => {
      const r = pillRect(i);
      return r ? [r.left + r.width * 0.8, r.top + r.height * 0.62] : grabOf(info);
    };
    const heading = refs.heading.current?.getBoundingClientRect();
    const lead = refs.lead.current?.getBoundingClientRect();
    // Myš u textu: vpravo dole za koncem bloku (nezakrývá psaní).
    const textPt = (r: Rect | undefined): Pt => (r ? [r.right + 14, r.bottom - r.height * 0.25] : grabOf(info));
    const cards = refs.cards.current?.getBoundingClientRect();
    const cardsTL: Pt = cards ? [cards.left - cardsPad, cards.top - cardsPad] : [fx + vw * 0.6, fy + vh * 0.2];
    const cardsWH: Pt = cards ? [cards.width + cardsPad * 2, cards.height + cardsPad * 2] : [0, 0];
    const cardsEnd: Pt = [cardsTL[0] + cardsWH[0], cardsTL[1] + cardsWH[1]];
    const cardsBox: Rect | null = cards
      ? rectFrom(cardsTL, cardsEnd)
      : null;
    const stats = refs.stats.current?.getBoundingClientRect();
    const intro = refs.intro.current?.getBoundingClientRect();
    const last = names.length - 1;
    const target = processImg?.getBoundingClientRect();

    let pos: Pt;
    let press = 0;
    let duplicate = 0;
    let opacity = 1;
    let select: Box = null;
    let hovered: Box = null;
    let marquee: Box = null;
    let flying: Rect | null = null;
    let active: string | null = null;
    let key: Shortcut = null;
    let menuShown = 0;
    let menuHot = 0;
    let menuPos: Pt | null = null;

    if (p <= 0) {
      // ---- Hero: scéna označit a smazat, pak portrét. ----
      const heroPortrait = registry.get("hero-portrait")?.getBoundingClientRect() ?? info;
      const gallery = registry.get("hero-gallery")?.getBoundingClientRect();
      const galleryPt: Pt | null = gallery && gallery.width ? [gallery.left + gallery.width * 0.35, gallery.top + gallery.height * 0.5] : null;
      const portraitPt = grabOf(heroPortrait);
      // Délky jako rozdíl dvou bodů (heroAt přepočítává body tempem úseku).
      opacity = within([HERO.arrive[0], heroAt(380.5)])(h);
      // Nabídka se otevře u špičky kurzoru; „Smazat" se měří z DOMu (po
      // zavření zůstává poslední bod — myš odtud jde pro portrét).
      if (galleryPt) {
        menuShown = h >= HERO.menu && h < HERO.remove ? within([HERO.menu, heroAt(409)])(h) : 0;
        menuPos = [galleryPt[0] + 6, galleryPt[1] + 6];
        const item = document.querySelector<HTMLElement>("[data-context-delete]")?.getBoundingClientRect();
        if (item && item.width) deletePtRef.current = [item.left + item.width * 0.32, item.top + item.height * 0.58];
      }
      const deletePt = deletePtRef.current ?? galleryPt;
      if (galleryPt && deletePt && gallery && h < HERO.toPortrait[0]) {
        if (h < HERO.arrive[1]) pos = move([fx + vw + 40, fy + vh * 0.62], galleryPt, within(HERO.arrive)(h));
        else pos = move(galleryPt, deletePt, within(HERO.toDelete)(h));
        press = Math.max(
          click(h, HERO.select, heroAt(406) - HERO.select),
          click(h, HERO.menu, heroAt(409) - HERO.menu),
          click(h, HERO.deleteClick, heroAt(421) - HERO.deleteClick),
        );
        menuHot = h < HERO.remove ? within([HERO.toDelete[1] - 0.002, HERO.toDelete[1]])(h) : 0;
        if (h >= HERO.select && h < HERO.remove) select = { r: gallery, label: "3D scéna", o: 1 };
        active = h >= HERO.select && h < HERO.remove ? "gallery" : null;
        if (near(h, HERO.remove, HERO.remove - HERO.deleteClick, heroAt(428) - HERO.remove)) key = "delete";
      } else if (galleryPt && deletePt && h < HERO.portrait) {
        pos = move(deletePt, portraitPt, within(HERO.toPortrait)(h));
        const grabbed = within([heroAt(480), HERO.portrait])(h);
        press = grabbed;
        select = { r: heroPortrait, label: "Portrét", o: grabbed };
      } else {
        // Drží portrét (přelet).
        const grip: Window = [HERO.toPortrait[1], HERO.portrait];
        pos = galleryPt ? portraitPt : move([fx + vw + 40, fy + vh * 0.62], portraitPt, within(HERO.toPortrait)(h));
        press = galleryPt ? 1 : within(grip)(h);
        select = { r: heroPortrait, label: "Portrét", o: galleryPt ? 1 : within(grip)(h) };
        active = "portrait";
      }
    } else if (p < flow.toPill[0]) {
      // ---- Puštění portrétu na místě. ----
      pos = grabOf(info);
      press = 1 - within([0, 0.02])(p);
      select = { r: info, label: "Portrét", o: 1 - within([0.012, 0.035])(p) };
      active = "portrait";
    } else if (p < flow.toPill[1]) {
      pos = move(grabOf(info), pillPt(0), within(flow.toPill)(p));
      select = { r: info, label: "Portrét", o: 1 - within([0.012, 0.035])(p) };
      active = "pill-0";
    } else if (p < flow.dupStart || (last < 1 && p < flow.toHeading[0])) {
      // ---- První pilulka: myš na ní, uprostřed stavby klik (výběr). ----
      const mid = (flow.pill[0] + flow.pill[1]) / 2;
      const r = pillRect(0);
      pos = pillPt(0);
      press = click(p, mid);
      if (r && p < flow.pill[1]) select = { r, label: names[0], o: within([mid, mid + 0.01])(p) };
      active = "pill-0";
    } else if (last >= 1 && p < flow.dup(last).b) {
      // ---- Duplikáty (Ctrl/⌘ + D): kopie z předchozí pilulky na své místo. ----
      let i = 1;
      while (i < last && p >= flow.dup(i).b) i++;
      const d = flow.dup(i);
      const r = pillRect(i);
      pos = pillPt(i);
      const dragging = p < d.drop;
      press = dragging ? 1 : 0;
      duplicate = dragging ? within([d.a, d.a + 0.005])(p) : 0;
      if (r) select = { r, label: dragging ? `${names[i - 1]} kopie` : names[i], o: 1 };
      active = `pill-${i}`;
      if (dragging) key = "duplicate";
    } else if (p < flow.toHeading[1]) {
      pos = move(pillPt(last), textPt(heading), within(flow.toHeading)(p));
      if (heading) hovered = { r: heading, label: "Nadpis", o: within([flow.toHeading[1] - 0.008, flow.toHeading[1]])(p) };
      active = "heading";
    } else if (p < flow.toLead[0]) {
      // ---- Nadpis: najetí (rámeček), klik → píše se. ----
      pos = textPt(heading);
      press = click(p, flow.headingClick);
      if (heading) {
        if (p >= flow.headingClick) select = { r: heading, label: "Nadpis", o: 1 };
        else hovered = { r: heading, label: "Nadpis", o: 1 };
      }
      if (p >= flow.headingClick) key = "text";
      active = "heading";
    } else if (p < flow.toLead[1]) {
      pos = move(textPt(heading), textPt(lead), within(flow.toLead)(p));
      if (lead) hovered = { r: lead, label: "Text", o: within([flow.toLead[1] - 0.008, flow.toLead[1]])(p) };
      active = "lead";
    } else if (p < flow.toCards[0]) {
      pos = textPt(lead);
      press = click(p, flow.leadClick);
      if (lead) {
        if (p >= flow.leadClick) select = { r: lead, label: "Text", o: 1 };
        else hovered = { r: lead, label: "Text", o: 1 };
      }
      if (p >= flow.leadClick) key = "text";
      active = "lead";
    } else if (p < flow.toCards[1]) {
      pos = move(textPt(lead), cardsTL, within(flow.toCards)(p));
      active = "cards";
    } else if (p < flow.draw[1]) {
      // ---- Rámeček karet tahem z rohu do rohu. ----
      const d = ease(within(flow.draw)(p));
      pos = [cardsTL[0] + cardsWH[0] * d, cardsTL[1] + cardsWH[1] * d];
      press = 1;
      active = "cards";
    } else if (p < flow.barDrag[0]) {
      // ---- Za pravý okraj pro lištu statistik. ----
      const barPt: Pt = [fx + vw + 40, stats ? stats.top + stats.height / 2 : fy + vh - 20];
      pos = move(cardsEnd, barPt, within(flow.toBar)(p));
      active = "cards";
    } else if (p < flow.rest[0]) {
      // ---- Lišta se dotáhne zprava na místo (jede s myší za levý okraj
      // lišty, který myš drží). ----
      pos = stats ? [Math.min(stats.left + vw * 0.08, fx + vw + 40), stats.top + stats.height / 2] : [fx + vw * 0.5, fy + vh - 20];
      press = 1 - within([flow.barDrag[1], flow.barDrag[1] + 0.004])(p);
      if (stats) select = { r: stats, label: "Statistiky", o: 1 - within([flow.barDrag[1], flow.rest[0]])(p) };
      active = "stats";
    } else if (p < flow.delBar.to[0]) {
      // ---- Volný čas: myš „přemýšlí" — pomalu krouží, karty jsou volné. ----
      const t = performance.now() / 1000;
      const park: Pt = [fx + vw * 0.58, fy + vh * 0.62];
      const settle = within([flow.rest[0], flow.rest[0] + 0.02])(p);
      const wander: Pt = [
        park[0] + Math.sin(t * 0.55) * 46 + Math.sin(t * 1.7) * 9,
        park[1] + Math.cos(t * 0.43) * 30 + Math.sin(t * 2.1) * 6,
      ];
      pos = move(stats ? center(stats) : park, wander, settle);
      active = null;
    } else if (p < flow.delCards.to[0]) {
      // ---- Smazat lištu: označit, Delete. ----
      const barPt: Pt = stats ? center(stats) : [fx + vw * 0.5, fy + vh - 20];
      pos = move([fx + vw * 0.58, fy + vh * 0.62], barPt, within(flow.delBar.to)(p));
      press = click(p, flow.delBar.select);
      if (stats && p >= flow.delBar.select && p < flow.delBar.remove) select = { r: stats, label: "Statistiky", o: 1 };
      if (near(p, flow.delBar.remove)) key = "delete";
      active = p < flow.delBar.remove ? "stats" : null;
    } else if (p < flow.marquee.to[0]) {
      // ---- Smazat karty. ----
      const barPt: Pt = stats ? center(stats) : [fx + vw * 0.5, fy + vh - 20];
      const cardsPt: Pt = cardsBox ? [cardsBox.left + cardsBox.width * 0.3, cardsBox.top + cardsBox.height * 0.4] : [fx + vw * 0.7, fy + vh * 0.4];
      pos = move(barPt, cardsPt, within(flow.delCards.to)(p));
      press = click(p, flow.delCards.select);
      if (cardsBox && p >= flow.delCards.select && p < flow.delCards.remove) select = { r: cardsBox, label: "Karty služeb", o: 1 };
      if (near(p, flow.delCards.remove)) key = "delete";
      active = p < flow.delCards.remove ? "cards" : null;
    } else if (p < flow.toPortrait[0]) {
      // ---- Výběr tažením přes celý levý sloupec (jako ve Figmě), smazat. ----
      const cardsPt: Pt = cardsBox ? [cardsBox.left + cardsBox.width * 0.3, cardsBox.top + cardsBox.height * 0.4] : [fx + vw * 0.7, fy + vh * 0.4];
      const pad = 18;
      const from: Pt = intro ? [intro.left - pad, intro.top - pad] : [fx + vw * 0.04, fy + vh * 0.15];
      const to: Pt = intro ? [intro.right + pad, intro.bottom + pad] : [fx + vw * 0.25, fy + vh * 0.85];
      if (p < flow.marquee.drag[0]) {
        pos = move(cardsPt, from, within(flow.marquee.to)(p));
      } else {
        const d = ease(within(flow.marquee.drag)(p));
        pos = [mix(from[0], to[0], d), mix(from[1], to[1], d)];
        if (p < flow.marquee.select) {
          press = 1;
          marquee = { r: rectFrom(from, pos), label: "", o: 1 };
          key = "select";
        }
      }
      if (intro && p >= flow.marquee.select && p < flow.marquee.remove) {
        select = { r: intro, label: `Výběr · ${names.length + 4} vrstev`, o: 1 };
        key = "select";
      }
      if (near(p, flow.marquee.remove)) key = "delete";
      active = p >= flow.marquee.select && p < flow.marquee.remove ? "selection" : null;
    } else if (p < flow.grab) {
      // ---- Pro portrét. ----
      const end: Pt = intro ? [intro.right + 18, intro.bottom + 18] : [fx + vw * 0.25, fy + vh * 0.85];
      pos = move(end, grabOf(info), within(flow.toPortrait)(p));
      press = within([flow.grab - 0.004, flow.grab])(p);
      select = { r: info, label: "Portrét", o: press };
      active = "portrait";
    } else if (pe < 1 || ps < PROCESS.flightEnd) {
      // ---- Let portrétu do Procesu: kopie ve fixed, myš ji nese. Dosedne
      // až v PROCESS.flightEnd (vyjíždění + kus přišpendleného Procesu). ----
      const vhPe = 100;
      const vhEnd = PROCESS.flightEnd * PROCESS_PINNED;
      const rest = clamp01((pe * vhPe + ps * PROCESS_PINNED) / (vhPe + vhEnd));
      const t = p < 1 ? within([flow.grab, 1])(p) * FLIGHT_LIFT : FLIGHT_LIFT + (1 - FLIGHT_LIFT) * rest;
      const to: Rect = target && target.width ? target : info;
      flying = mixRect(info, to, ease(clamp01(t)));
      pos = grabOf(flying);
      press = 1 - within([0.94, 0.99])(rest);
      if (rest < 0.99) select = { r: flying, label: "Portrét", o: 1 - within([0.94, 0.99])(rest) };
      active = "portrait";
    } else {
      // ---- Proces: napsat nadpis a text, přidat nápovědu, odejít. ----
      const headline = registry.get("process-headline")?.getBoundingClientRect();
      const plead = registry.get("process-lead")?.getBoundingClientRect();
      const hint = registry.get("process-hint")?.getBoundingClientRect();
      const start: Pt = target ? grabOf(target) : [fx + vw * 0.6, fy + vh * 0.5];
      if (ps < PROCESS.toLead[0]) {
        pos = move(start, textPt(headline), within(PROCESS.toHeadline)(ps));
        press = click(ps, PROCESS.headlineClick, 0.004);
        if (headline) {
          if (ps >= PROCESS.headlineClick) select = { r: headline, label: "Nadpis", o: 1 };
          else hovered = { r: headline, label: "Nadpis", o: within([PROCESS.toHeadline[1] - 0.004, PROCESS.toHeadline[1]])(ps) };
        }
        if (ps >= PROCESS.headlineClick) key = "text";
        active = "p-headline";
      } else if (ps < PROCESS.toHint[0]) {
        pos = move(textPt(headline), textPt(plead), within(PROCESS.toLead)(ps));
        press = click(ps, PROCESS.leadClick, 0.004);
        if (plead) {
          if (ps >= PROCESS.leadClick) select = { r: plead, label: "Text", o: 1 };
          else hovered = { r: plead, label: "Text", o: within([PROCESS.toLead[1] - 0.004, PROCESS.toLead[1]])(ps) };
        }
        if (ps >= PROCESS.leadClick) key = "text";
        active = "p-lead";
      } else if (ps < PROCESS.leave[0]) {
        const hintPt: Pt = hint ? [hint.left + 20, hint.top + hint.height / 2] : textPt(plead);
        pos = move(textPt(plead), hintPt, within(PROCESS.toHint)(ps));
        press = click(ps, PROCESS.hintClick, 0.004);
        if (hint && ps >= PROCESS.hintClick) select = { r: hint, label: "Nápověda", o: 1 };
        active = "p-hint";
      } else {
        const hintPt: Pt = hint ? [hint.left + 20, hint.top + hint.height / 2] : [fx + vw * 0.3, fy + vh * 0.8];
        pos = move(hintPt, [fx + vw + 60, hintPt[1] - vh * 0.2], within(PROCESS.leave)(ps));
        opacity = 1 - within(PROCESS.leave)(ps);
      }
    }

    // ---- Psaní: textový kurzor od kliknutí do textu do dopsání (nebo než
    // myš jde dál). ----
    const inProcess = pe >= 1;
    const typingKeys = [
      { key: "heading", from: p >= flow.headingClick, until: p < flow.toLead[0], reset: p < flow.headingClick },
      { key: "lead", from: p >= flow.leadClick, until: p < flow.toCards[0], reset: p < flow.leadClick },
      {
        key: "p-headline",
        from: inProcess && ps >= PROCESS.headlineClick,
        until: ps < PROCESS.toLead[0],
        reset: !inProcess || ps < PROCESS.headlineClick,
      },
      {
        key: "p-lead",
        from: inProcess && ps >= PROCESS.leadClick,
        until: ps < PROCESS.toHint[0],
        reset: !inProcess || ps < PROCESS.leadClick,
      },
    ];
    let typingText = false;
    for (const t of typingKeys) {
      if (t.reset) resetTyped(t.key);
      else if (t.from && t.until && !isTyped(t.key)) typingText = true;
    }

    cursor.x.set(pos[0]);
    cursor.y.set(pos[1]);
    cursor.opacity.set(opacity);
    cursor.press.set(press);
    cursor.duplicate.set(duplicate);
    menu.opacity.set(menuShown);
    menu.hot.set(menuHot);
    if (menuPos) {
      menu.x.set(menuPos[0]);
      menu.y.set(menuPos[1]);
    }
    writeBox(selection, select);
    writeBox(hover, hovered);
    writeBox(marqueeBox, marquee);

    // Letící kopie: originály schované, dokud letí.
    const inFlight = Boolean(flying);
    writeBox(flight, inFlight && flying ? { r: flying, label: "", o: 1 } : null);
    infoPortrait.set(flying || pe >= 1 ? 0 : 1);
    hideProcess(inFlight && processImg ? processImg : null);

    // ---- Panel vrstev a zkratek: měřítko vede, průhlednost následuje; při
    // odchodu (myš odejde z Procesu) obráceně. ----
    const shown = within(HERO.panel)(h) * (1 - within(PROCESS.leave)(ps));
    panelScale.set(ease(clamp01(shown / 0.45)));
    panelOpacity.set(clamp01((shown - 0.3) / 0.7));
    tabletQuery.current ??= window.matchMedia(PORTRAIT_TABLET);
    if (tabletQuery.current.matches) {
      // Z left 5vw / top 27,5vh (info/styles, xs-v) pod logo hlavičky:
      // left 3vh (odsazení hlavičky) / top 1vh pod ní (process/styles).
      const move = ease(within([0.25, 0.85])(pe));
      panelX.set(move * (vh * 0.03 - vw * 0.05));
      panelY.set(move * -0.265 * vh);
    } else {
      panelX.set(0);
      panelY.set(0);
    }

    // Řádky panelu vrstev v pořadí vzniku; smazané (`until`) odjedou.
    const T = pe >= 1 && ps > 0 ? 2 + ps : p > 0 ? 1 + p : h;
    const leftGone = 1 + flow.marquee.remove;
    const events: { t: number; until?: number; row: LayerRow }[] = [
      { t: HERO.select, until: HERO.remove, row: { id: "gallery", kind: "frame", name: "3D scéna" } },
      { t: HERO.portrait, row: { id: "portrait", kind: "image", name: "Portrét" } },
      { t: 1 + flow.pill[0], until: leftGone, row: { id: "pill-0", kind: "pill", name: names[0] ?? "Nástroj" } },
      ...names.slice(1).map((name, k) => {
        const d = flow.dup(k + 1);
        return {
          t: 1 + d.a,
          until: leftGone,
          row: { id: `pill-${k + 1}`, kind: "pill" as const, name: p < d.drop ? `${names[k]} kopie` : name },
        };
      }),
      { t: 1 + flow.toHeading[1], until: leftGone, row: { id: "heading", kind: "text", name: "Nadpis" } },
      { t: 1 + flow.toLead[1], until: leftGone, row: { id: "lead", kind: "text", name: "Text" } },
      { t: 1 + flow.draw[0], until: 1 + flow.delCards.remove, row: { id: "cards", kind: "frame", name: "Karty služeb" } },
      { t: 1 + flow.barDrag[0], until: 1 + flow.delBar.remove, row: { id: "stats", kind: "bar", name: "Statistiky" } },
      { t: 2 + PROCESS.toHeadline[1], row: { id: "p-headline", kind: "text", name: "Nadpis procesu" } },
      { t: 2 + PROCESS.toLead[1], row: { id: "p-lead", kind: "text", name: "Text" } },
      { t: 2 + PROCESS.hintClick, row: { id: "p-hint", kind: "bar", name: "Objevujte posunutím" } },
    ];
    const rows = events
      .filter((event) => T >= event.t && (event.until === undefined || T < event.until))
      .sort((a, b) => a.t - b.t)
      .map((event) => event.row);
    const nextTyping: Typing = {
      heading: p >= flow.headingClick,
      lead: p >= flow.leadClick,
      cards: p >= flow.cardsIn,
    };
    const stamp = `${rows.map((row) => `${row.id}:${row.name}`).join("|")}#${active}#${key}#${nextTyping.heading}${nextTyping.lead}${nextTyping.cards}#${typingText}`;
    if (stamp !== stateKey.current) {
      stateKey.current = stamp;
      setLayers({ rows, active });
      setTyping(nextTyping);
      setShortcut(key);
      setTextCursor(typingText);
    }
  };

  // Jen v dosahu: od příletu myši v heru po odchod z Procesu (a jednou za
  // hranicí, ať se vše schová).
  const live = useRef(false);
  useAnimationFrame(() => {
    const h = heroProgress.get();
    // Před příletem myši v heru nic neměřit (dřív se rám Procesu četl
    // každý snímek celé stránky — vynucený layout, na iPhonu znatelný).
    if (h <= HERO.arrive[0] - 0.02 && !live.current) return;
    const p = stage.get();
    const processImg = registry.get("process-portrait");
    const section = processImg?.closest("section");
    const box = section?.getBoundingClientRect();
    // Výška bez lišty Safari — innerHeight by při jejím schování poskočil.
    const vh = viewportHeight();
    const pe = box ? clamp01(1 - box.top / vh) : 0;
    const ps = box ? clamp01(-box.top / Math.max(1, box.height - vh)) : 0;
    const inRange = h > HERO.arrive[0] - 0.02 && ps < PROCESS.leave[1] + 0.01;
    if (!inRange && !live.current) return;
    live.current = inRange;
    update(h, p, pe, ps, processImg);
  });

  return {
    flow,
    cursor,
    menu,
    selection,
    hover,
    marquee: marqueeBox,
    flight,
    infoPortrait,
    panelOpacity,
    panelScale,
    panelX,
    panelY,
    layers,
    typing,
    shortcut,
    /** Myš právě píše (textový kurzor). */
    textCursor,
  };
}
