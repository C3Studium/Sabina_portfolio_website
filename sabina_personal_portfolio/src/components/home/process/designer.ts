// Proces — umělá myš „Sabina" v krocích dolly (časy: steps.ts).
//
// Stejný jazyk jako v Info (info/choreography.ts): myš jezdí k prvkům,
// kliká, píše, kreslí rámeček, dotahuje vrstvy zpoza okraje, duplikuje
// (Ctrl/⌘ + D) a mění rozměr za úchyty; panel Vrstvy ukazuje vrstvy právě
// editovaného kroku, toast zkratku, kterou myš zrovna používá, a v kroku 04
// se u obrázku otevře panel Text (velikost písma).
//
// PSANÍ: když myš píše (TypeText), přepne se na textový kurzor — dokud text
// nedopíše (TypeText `onDone` → `doneFor(klíč)`) nebo dokud myš nejde dál.
// Na psaní nečeká, jede se scrollem.
//
// Všechno se počítá každý snímek ze živých obdélníků prvků v dlaždicích
// (registr `elements` v Procesu) — kamera i prvky se hýbou, výběr jede
// s nimi. Mezi kroky, když kamera letí, myš čeká zaparkovaná dole vpravo.

import { useRef, useState } from "react";
import { useAnimationFrame, useMotionValue, type MotionValue } from "framer-motion";
import {
  center,
  clamp01,
  click,
  ease,
  mix,
  move,
  useBoxValues,
  within,
  type Pt,
  type Rect,
  type Shortcut,
} from "@/components/home/info/choreography";
import type { LayerRow } from "@/components/home/info/designer";
import {
  S1,
  S2,
  S3,
  S4,
  S5,
  S6,
  STORY,
  TEXT_PANEL_OFFSET,
  briefRow,
  chipDup,
  swatchDup,
  type DupWindows,
} from "./steps";
import { viewFrame } from "@/lib/fluid";

/** Co myš napsala / kde právě píše (TypeText `play`, aktivní pole). */
export type StepTyped = {
  s1: boolean;
  /** Karta zadání: kolik polí už se píše (0 nadpis, pak popisek a hodnota řádků). */
  brief: number;
  s2: boolean;
  s5: boolean;
  s6: boolean;
  slide: boolean;
  client: boolean;
  me: boolean;
  /** Pole velikosti písma v panelu Text: označené a přepsané. */
  sizeFocus: boolean;
  size: boolean;
};

type TypingKey = string;

type Options = {
  /** Průběh úseků dolly (0 → SEGMENTS). */
  seg: MotionValue<number>;
  /** Prvky kroků podle klíče (s1-text, s1-card, …). */
  elements: Record<string, HTMLElement | null>;
  enabled: boolean;
  /** Barvy palety kroku 02 (názvy vrstev). */
  palette: string[];
  /** Kolik řádků má karta zadání (krok 01). */
  briefRows: number;
  /** Kolik barev má identita značky (krok 06). */
  brandColors: number;
};

/** Výběr: obdélník, popisek, viditelnost; `size` nahradí rozměr v popisku. */
type Sel = { r: Rect; label: string; o: number; size?: string } | null;

/* ---------- Nastavení ---------- */

// Kde myš čeká, když kamera letí (podíl okna).
const PARK: readonly [number, number] = [0.64, 0.84];
// Odsazení rámečku tahem (DrawFrame) (px).
const DRAW_PAD = 10;
// Myš se ukazuje do konce kroku 06; při letu k výzvě zmizí.
const LAST_STEP = 6;
// Psaní: od kdy do kdy (průběh úseků) má myš textový kurzor — od kliknutí
// do textu, dokud text nedopíše, nejdéle dokud myš nejde dál.
type Typing = { at: number; until: number };
const typingFor = (briefRows: number): Record<string, Typing> => {
  const rows: Record<string, Typing> = {};
  for (let i = 0; i < briefRows; i++) {
    const r = briefRow(i);
    rows[`brief-${i}`] = { at: r.label, until: r.end };
  }
  return {
    s1: { at: S1.textClick, until: S1.toCard[0] },
    "brief-title": { at: S1.titleClick, until: S1.rowsStart },
    ...rows,
    s2: { at: 1 + S2.textClick, until: 1 + S2.toSwatch[0] },
    me: { at: 3 + S4.meType, until: 3 + S4.toTitle[0] },
    size: { at: 3 + S4.sizeType, until: 3 + S4.leave[0] },
    s5: { at: 4 + S5.textClick, until: 4 + S5.toHandle[0] },
    s6: { at: 5 + S6.textClick, until: 5 + S6.toBanner[0] },
    slide: { at: 5 + S6.slideTitleClick, until: 5 + S6.toLogo[0] },
  };
};

const NONE: StepTyped = {
  s1: false,
  brief: 0,
  s2: false,
  s5: false,
  s6: false,
  slide: false,
  client: false,
  me: false,
  sizeFocus: false,
  size: false,
};

export function useStepDesigner({ seg, elements, enabled, palette, briefRows, brandColors }: Options) {
  const TYPING = typingFor(briefRows);
  const cursor = {
    x: useMotionValue(-200),
    y: useMotionValue(-200),
    opacity: useMotionValue(0),
    press: useMotionValue(0),
    duplicate: useMotionValue(0),
  };
  const selection = useBoxValues();
  const hover = useBoxValues();
  const marqueeBox = useBoxValues();
  const panelOpacity = useMotionValue(0);
  const panelScale = useMotionValue(0);
  const textPanel = {
    opacity: useMotionValue(0),
    scale: useMotionValue(0),
    x: useMotionValue(0),
    y: useMotionValue(0),
  };
  const [ui, setUi] = useState<{ rows: LayerRow[]; active: string | null; shortcut: Shortcut; text: boolean }>({
    rows: [],
    active: null,
    shortcut: null,
    text: false,
  });
  const [typed, setTyped] = useState<StepTyped>(NONE);
  const stamp = useRef("");

  // Dopsané texty (TypeText onDone); stálé funkce na klíč.
  const [done] = useState(() => {
    const keys = new Set<TypingKey>();
    const fns: Partial<Record<TypingKey, () => void>> = {};
    return {
      keys,
      fn: (key: TypingKey) =>
        (fns[key] ??= () => {
          keys.add(key);
        }),
    };
  });
  const writeBox = (target: ReturnType<typeof useBoxValues>, value: Sel) => {
    if (value && value.o > 0.001) {
      target.x.set(value.r.left);
      target.y.set(value.r.top);
      target.width.set(value.r.width);
      target.height.set(value.r.height);
      const size = value.size ?? `${Math.round(value.r.width)} × ${Math.round(value.r.height)}`;
      target.label.set(value.label ? `${value.label} · ${size}` : "");
      target.opacity.set(value.o);
    } else {
      target.opacity.set(0);
    }
  };

  const hide = () => {
    cursor.opacity.set(0);
    selection.opacity.set(0);
    hover.opacity.set(0);
    marqueeBox.opacity.set(0);
    panelOpacity.set(0);
    panelScale.set(0);
    textPanel.opacity.set(0);
    textPanel.scale.set(0);
  };

  // Panel: měřítko vede, průhlednost následuje (a při odchodu obráceně).
  const showPanel = (opacity: MotionValue<number>, scale: MotionValue<number>, shown: number) => {
    scale.set(ease(clamp01(shown / 0.45)));
    opacity.set(clamp01((shown - 0.3) / 0.7));
  };

  const update = (v: number) => {
    // Rám obsahu (strop 2560 × 1440, lib/fluid).
    const frame = viewFrame();
    const park: Pt = [frame.x + frame.w * PARK[0], frame.y + frame.h * PARK[1]];
    const rectOf = (key: string): Rect | undefined => {
      const r = elements[key]?.getBoundingClientRect();
      return r && r.width ? r : undefined;
    };
    const textPt = (r: Rect | undefined): Pt => (r ? [r.right + 14, r.bottom - r.height * 0.25] : park);
    const grabOf = (r: Rect | undefined): Pt => (r ? [r.left + r.width * 0.46, r.top + r.height * 0.42] : park);
    const mid = (r: Rect | undefined): Pt => (r ? center(r) : park);
    const corner = (r: Rect | undefined): Pt => (r ? [r.right, r.bottom] : park);
    const bottomMid = (r: Rect | undefined): Pt => (r ? [r.left + r.width / 2, r.bottom] : park);
    // Úchop prvku, který je ještě za okrajem okna — myš čeká u okraje.
    const edgeGrab = (r: Rect | undefined): Pt => {
      const [x, y] = grabOf(r);
      return [Math.min(Math.max(x, frame.x - 40), frame.x + frame.w + 40), y];
    };
    const drawCorners = (r: Rect | undefined): [Pt, Pt] =>
      r
        ? [
            [r.left - DRAW_PAD, r.top - DRAW_PAD],
            [r.right + DRAW_PAD, r.bottom + DRAW_PAD],
          ]
        : [park, park];

    // Krok, v jehož úseku jsme (1–6; dál myš není), a průběh v něm.
    const k = Math.min(Math.floor(v) + 1, LAST_STEP + 1);
    const s = clamp01(v - (k - 1));

    let pos: Pt = park;
    let press = 0;
    let duplicate = 0;
    let select: Sel = null;
    let hovered: Sel = null;
    let key: Shortcut = null;
    let active: string | null = null;
    let textPanelShown = 0;
    let events: { t: number; row: LayerRow }[] = [];

    // Najetí na text, klik, psaní (jako nadpis v Info).
    const typeAt = (
      r: Rect | undefined,
      w: { toText: readonly [number, number]; textClick: number },
      from: Pt = park,
      label = "Text",
    ) => {
      pos = move(from, textPt(r), within(w.toText)(s));
      press = click(s, w.textClick, 0.008);
      if (r) {
        if (s >= w.textClick) select = { r, label, o: 1 };
        else hovered = { r, label, o: within([w.toText[1] - 0.01, w.toText[1]])(s) };
      }
      if (s >= w.textClick) key = "text";
      active = "text";
    };

    // Duplikát (Ctrl/⌘ + D): k originálu, kopie se táhne na své místo, pak
    // myš chytí úchyt a změní jí rozměr. `size` = popisek rozměru při změně.
    const dupFlow = (
      source: Rect | undefined,
      copy: Rect | undefined,
      w: DupWindows,
      labels: { source: string; copy: string; done: string },
      handle: (r: Rect | undefined) => Pt,
      from: Pt,
      size?: string,
    ) => {
      if (s < w.drag[0]) {
        pos = move(from, mid(source), within(w.toSource)(s));
        if (source && s >= w.toSource[1]) select = { r: source, label: labels.source, o: 1 };
      } else if (s < w.toHandle[0]) {
        pos = mid(copy);
        press = 1;
        duplicate = within([w.drag[0], w.drag[0] + 0.006])(s);
        key = "duplicate";
        if (copy) select = { r: copy, label: labels.copy, o: 1 };
      } else if (s < w.resize[0]) {
        pos = move(mid(copy), handle(copy), within(w.toHandle)(s));
        if (copy) select = { r: copy, label: labels.copy, o: 1 };
      } else {
        pos = handle(copy);
        press = s < w.resize[1] ? 1 : 0;
        if (copy) select = { r: copy, label: s < w.resize[1] ? labels.copy : labels.done, o: 1, size };
      }
    };

    if (k === 1) {
      const text = rectOf("s1-text");
      const card = rectOf("s1-card");
      const title = rectOf("s1-title");
      const note = rectOf("s1-note");
      const [tl, br] = drawCorners(card);
      const lastRow = Math.max(0, briefRows - 1);
      const rowsEnd = briefRow(lastRow).end;
      const field = (i: number, part: "label" | "value") => rectOf(`s1-row-${i}-${part}`);
      if (s < S1.toText[0]) pos = park;
      else if (s < S1.toCard[0]) typeAt(text, S1);
      else if (s < S1.draw[1]) {
        // Rámeček karty zadání tahem z rohu do rohu (nástroj Rámeček).
        if (s < S1.toCard[1]) pos = move(textPt(text), tl, within(S1.toCard)(s));
        else {
          const d = ease(within(S1.draw)(s));
          pos = [mix(tl[0], br[0], d), mix(tl[1], br[1], d)];
          press = 1;
        }
        active = "card";
      } else if (s < S1.toTitle[0]) {
        pos = br;
        if (card) select = { r: card, label: "Zadání grafiky", o: 1 };
        active = "card";
      } else if (s < S1.rowsStart) {
        // Nadpis karty: klik, píše se.
        typeAt(title, { toText: S1.toTitle, textClick: S1.titleClick }, br, "Nadpis");
        active = "card";
      } else if (s < rowsEnd) {
        // Řádky: popisek, pak hodnota — myš jede po kartě dolů.
        let i = lastRow;
        while (i > 0 && s < briefRow(i).line[0]) i--;
        const row = briefRow(i);
        const label = field(i, "label");
        const value = field(i, "value");
        const before = i === 0 ? textPt(title) : textPt(field(i - 1, "value"));
        if (s < row.value - 0.012) {
          pos = move(before, textPt(label), within([row.line[0], row.label])(s));
          press = click(s, row.label, 0.006);
          if (label && s >= row.label) select = { r: label, label: "Popisek", o: 1 };
        } else {
          pos = move(textPt(label), textPt(value), within([row.value - 0.012, row.value])(s));
          press = click(s, row.value, 0.006);
          if (value && s >= row.value) select = { r: value, label: "Hodnota", o: 1 };
        }
        key = "text";
        active = "card";
      } else if (s < S1.toNote[0]) {
        pos = textPt(field(lastRow, "value"));
      } else if (s < S1.noteDrag[0]) {
        pos = move(textPt(field(lastRow, "value")), edgeGrab(note), within(S1.toNote)(s));
      } else if (s < S1.leave[0]) {
        // Lístek se dotáhne zprava (jede s myší).
        pos = edgeGrab(note);
        press = s < S1.noteDrag[1] ? 1 : 0;
        if (note) select = { r: note, label: "Poznámka", o: 1 };
        active = "note";
      } else pos = move(grabOf(note), park, within(S1.leave)(s));
      events = [
        { t: S1.textClick, row: { id: "text", kind: "text", name: "Text" } },
        { t: S1.toCard[1], row: { id: "card", kind: "frame", name: "Zadání grafiky" } },
        { t: S1.titleClick, row: { id: "title", kind: "text", name: "Nadpis" } },
        { t: S1.rowsStart, row: { id: "rows", kind: "text", name: `Řádky zadání` } },
        { t: S1.photo[0], row: { id: "photo", kind: "image", name: "Fotka" } },
        { t: S1.noteDrag[0], row: { id: "note", kind: "frame", name: "Poznámka" } },
      ];
    } else if (k === 2) {
      const text = rectOf("s2-text");
      const swatch = (i: number) => rectOf(`s2-swatch-${i}`);
      const last = Math.min(3, palette.length - 1);
      if (s < S2.toText[0]) pos = park;
      else if (s < S2.toSwatch[0]) typeAt(text, S2);
      else if (s < S2.dupStart) {
        // První barva: najetí, klik, postaví se.
        pos = move(textPt(text), mid(swatch(0)), within(S2.toSwatch)(s));
        press = click(s, S2.swatchClick, 0.008);
        const r = swatch(0);
        if (r && s >= S2.swatchClick) select = { r, label: "Barva", o: 1 };
        active = "swatch-0";
      } else if (last >= 1 && s < swatchDup(last).b) {
        // Duplikáty (Ctrl/⌘ + D): kopie z předchozí barvy na své místo.
        let i = 1;
        while (i < last && s >= swatchDup(i).b) i++;
        const d = swatchDup(i);
        const r = swatch(i);
        pos = mid(r);
        const dragging = s < d.drop;
        press = dragging ? 1 : 0;
        duplicate = dragging ? within([d.a, d.a + 0.006])(s) : 0;
        if (r) select = { r, label: dragging ? "Barva kopie" : "Barva", o: 1 };
        if (dragging) key = "duplicate";
        active = `swatch-${i}`;
      } else if (s < S2.leave[0]) {
        pos = mid(swatch(last));
      } else pos = move(mid(swatch(last)), park, within(S2.leave)(s));
      events = [
        { t: S2.textClick, row: { id: "text", kind: "text", name: "Text" } },
        { t: S2.type[0], row: { id: "type", kind: "frame", name: "Typografie" } },
        { t: S2.swatchClick, row: { id: "swatch-0", kind: "pill", name: `Barva ${palette[0] ?? ""}`.trim() } },
        ...palette.slice(1, last + 1).map((color, n) => {
          const d = swatchDup(n + 1);
          return {
            t: d.a,
            row: { id: `swatch-${n + 1}`, kind: "pill" as const, name: s < d.drop ? "Barva kopie" : `Barva ${color}` },
          };
        }),
      ];
    } else if (k === 3) {
      // Hlavní vizuál: klik na místo, postaví se. Pak dva duplikáty, které
      // myš dotáhne a za roh změní na rozměr varianty.
      const main = rectOf("s3-main");
      const top = rectOf("s3-top");
      const bottom = rectOf("s3-bottom");
      if (s < S3.toMain[0]) pos = park;
      else if (s < S3.top.toSource[0]) {
        pos = move(park, mid(main), within(S3.toMain)(s));
        press = click(s, S3.mainClick, 0.008);
        if (main && s >= S3.mainClick) select = { r: main, label: "Hlavní vizuál", o: 1 };
        active = "s3-main";
      } else if (s < S3.bottom.toSource[0]) {
        dupFlow(main, top, S3.top, { source: "Hlavní vizuál", copy: "Hlavní vizuál kopie", done: "Varianta" }, corner, mid(main));
        active = "s3-top";
      } else if (s < S3.leave[0]) {
        dupFlow(main, bottom, S3.bottom, { source: "Hlavní vizuál", copy: "Hlavní vizuál kopie", done: "Varianta 2" }, corner, corner(top));
        active = "s3-bottom";
      } else pos = move(corner(bottom), park, within(S3.leave)(s));
      const copyName = (w: DupWindows, name: string) => (s < w.resize[1] ? "Hlavní vizuál kopie" : name);
      events = [
        { t: S3.text[0], row: { id: "text", kind: "text", name: "Text" } },
        { t: S3.mainClick, row: { id: "s3-main", kind: "image", name: "Hlavní vizuál" } },
        { t: S3.top.drag[0], row: { id: "s3-top", kind: "image", name: copyName(S3.top, "Varianta") } },
        { t: S3.bottom.drag[0], row: { id: "s3-bottom", kind: "image", name: copyName(S3.bottom, "Varianta 2") } },
      ];
    } else if (k === 4) {
      const clientMsg = rectOf("s4-client");
      const me = rectOf("s4-me");
      const title = rectOf("s4-title");
      const size = rectOf("s4-size");
      const shot = rectOf("s4-shot");
      if (s < S4.toClient[0]) pos = park;
      else if (s < S4.toMe[0]) {
        // Zpráva klienta: najetí a označení (čte ji).
        pos = move(park, textPt(clientMsg), within(S4.toClient)(s));
        press = click(s, S4.clientClick, 0.008);
        if (clientMsg) {
          if (s >= S4.clientClick) select = { r: clientMsg, label: "Klient", o: 1 };
          else hovered = { r: clientMsg, label: "Klient", o: within([S4.toClient[1] - 0.01, S4.toClient[1]])(s) };
        }
        active = "client";
      } else if (s < S4.toTitle[0]) {
        // Bublina Já: klik, napíše odpověď.
        pos = move(textPt(clientMsg), textPt(me), within(S4.toMe)(s));
        press = click(s, S4.meClick, 0.008);
        if (me) {
          if (s >= S4.meClick) select = { r: me, label: "Já", o: 1 };
          else hovered = { r: me, label: "Já", o: within([S4.toMe[1] - 0.01, S4.toMe[1]])(s) };
        }
        if (s >= S4.meType) key = "text";
        active = "me";
      } else if (s < S4.toSize[0]) {
        // Nadpis ve vizuálu: klik → u obrázku panel Text.
        pos = move(textPt(me), mid(title), within(S4.toTitle)(s));
        press = click(s, S4.titleClick, 0.008);
        if (title) {
          if (s >= S4.titleClick) select = { r: title, label: "T · Nadpis", o: 1 };
          else hovered = { r: title, label: "T · Nadpis", o: within([S4.toTitle[1] - 0.01, S4.toTitle[1]])(s) };
        }
        active = "title";
      } else if (s < S4.leave[0]) {
        // Pole velikosti: klik, nové číslo — nadpis se zvětší.
        pos = move(mid(title), mid(size), within(S4.toSize)(s));
        press = click(s, S4.sizeClick, 0.008);
        if (title) select = { r: title, label: "T · Nadpis", o: 1 };
        if (s >= S4.sizeType && s < S4.grow[1]) key = "text";
        active = "title";
      } else pos = move(mid(size), park, within(S4.leave)(s));
      textPanelShown = within(S4.panel)(s) * (1 - within(S4.panelOut)(s));
      // Panel Text u obrázku: nad jeho horní hranou, vpravo od něj — na
      // užší obrazovce (notebook) ale nikdy přes pravý okraj, raději
      // přes kraj obrázku. offsetWidth měřítko z animace nezahrnuje.
      if (shot) {
        const panelWidth = document.querySelector<HTMLElement>("[data-text-panel]")?.offsetWidth ?? 0;
        const box = viewFrame();
        const edge = box.x + box.w - panelWidth - TEXT_PANEL_OFFSET.right;
        textPanel.x.set(Math.min(shot.right + TEXT_PANEL_OFFSET.right, edge));
        textPanel.y.set(shot.top - TEXT_PANEL_OFFSET.above);
      }
      events = [
        { t: S4.text[0], row: { id: "text", kind: "text", name: "Text" } },
        { t: S4.shot[0], row: { id: "shot", kind: "image", name: "Vizuál" } },
        { t: S4.client[0], row: { id: "client", kind: "bar", name: "Klient" } },
        { t: S4.meClick, row: { id: "me", kind: "bar", name: "Já" } },
        { t: S4.titleClick, row: { id: "title", kind: "text", name: "Nadpis vizuálu" } },
      ];
    } else if (k === 5) {
      const text = rectOf("s5-text");
      const story = rectOf("s5-story");
      const portrait = rectOf("s5-portrait");
      const square = rectOf("s5-square");
      const exportBtn = rectOf("s5-export");
      const send = rectOf("s5-send");
      const formats = [story, portrait, square];
      const storyH = Math.round(mix(STORY.from, STORY.to, ease(within(S5.stretch)(s))));
      const squareH = Math.round(mix(1350, 1080, ease(within(S5.square.resize)(s))));
      if (s < S5.toText[0]) pos = park;
      else if (s < S5.story[0]) typeAt(text, S5);
      else if (s < S5.toHandle[0]) pos = textPt(text);
      else if (s < S5.toPortrait[0]) {
        // Story: spodní úchyt, natažení na 1080 × 1920.
        const handle = bottomMid(story);
        pos = s < S5.toHandle[1] ? move(textPt(text), handle, within(S5.toHandle)(s)) : handle;
        press = s >= S5.toHandle[1] && s < S5.stretch[1] ? 1 : 0;
        if (story && s >= S5.toHandle[1] - 0.01) select = { r: story, label: "Story", o: 1, size: `${STORY.width} × ${storyH}` };
        active = "story";
      } else if (s < S5.square.toSource[0]) {
        // Formát na výšku se dotáhne zprava.
        if (s < S5.portraitDrag[0]) pos = move(bottomMid(story), edgeGrab(portrait), within(S5.toPortrait)(s));
        else {
          pos = edgeGrab(portrait);
          press = s < S5.portraitDrag[1] ? 1 : 0;
          if (portrait) select = { r: portrait, label: "Na výšku", o: 1, size: "1080 × 1350" };
        }
        active = "portrait";
      } else if (s < S5.captions[0][0]) {
        // Duplikát dolů a stažení na čtverec.
        dupFlow(
          portrait,
          square,
          S5.square,
          { source: "Na výšku", copy: "Na výšku kopie", done: "Čtverec" },
          bottomMid,
          grabOf(portrait),
          `1080 × ${squareH}`,
        );
        active = "square";
      } else if (s < S5.marks[0].to[0]) {
        // Popisky se píšou — myš počká u čtverce.
        pos = bottomMid(square);
      } else if (s < S5.toExport[0]) {
        // Klik na formáty: fialový rámeček ořezu (styles v Procesu).
        let i = S5.marks.length - 1;
        while (i > 0 && s < S5.marks[i].to[0]) i--;
        const from = i === 0 ? bottomMid(square) : mid(formats[i - 1]);
        pos = move(from, mid(formats[i]), within(S5.marks[i].to)(s));
        press = click(s, S5.marks[i].click, 0.008);
        active = ["story", "portrait", "square"][i];
      } else if (s < S5.toSend[0]) {
        pos = move(mid(square), mid(exportBtn), within(S5.toExport)(s));
        press = click(s, S5.exportClick, 0.008);
        active = "export";
      } else if (s < S5.leave[0]) {
        pos = move(mid(exportBtn), mid(send), within(S5.toSend)(s));
        press = click(s, S5.sendClick, 0.008);
        if (s >= S5.sendClick - 0.006 && s < S5.fly[1]) key = "send";
      } else pos = move(mid(send ?? exportBtn), park, within(S5.leave)(s));
      events = [
        { t: S5.textClick, row: { id: "text", kind: "text", name: "Text" } },
        { t: S5.story[0], row: { id: "story", kind: "image", name: `Story ${STORY.width} × ${storyH}` } },
        { t: S5.portraitDrag[0], row: { id: "portrait", kind: "image", name: "Na výšku 1080 × 1350" } },
        {
          t: S5.square.drag[0],
          row: { id: "square", kind: "image", name: s < S5.square.resize[1] ? "Na výšku kopie" : "Čtverec 1080 × 1080" },
        },
      ];
    } else if (k === 6) {
      const text = rectOf("s6-text");
      const banner = rectOf("s6-banner");
      const slide = rectOf("s6-slide");
      const slideTitle = rectOf("s6-slide-title");
      const logo = rectOf("s6-logo");
      const chip = (i: number) => rectOf(`s6-chip-${i}`);
      const lastChip = Math.min(3, brandColors - 1);
      const [tl, br] = drawCorners(slide);
      if (s < S6.toText[0]) pos = park;
      else if (s < S6.toBanner[0]) typeAt(text, S6);
      else if (s < S6.toSlide[0]) {
        // Banner: klik na místo, postaví se.
        pos = move(textPt(text), mid(banner), within(S6.toBanner)(s));
        press = click(s, S6.bannerClick, 0.008);
        if (banner && s >= S6.bannerClick) select = { r: banner, label: "Banner", o: 1 };
        active = "banner";
      } else if (s < S6.draw[1]) {
        // Snímek prezentace nástrojem Rámeček.
        if (s < S6.toSlide[1]) pos = move(mid(banner), tl, within(S6.toSlide)(s));
        else {
          const d = ease(within(S6.draw)(s));
          pos = [mix(tl[0], br[0], d), mix(tl[1], br[1], d)];
          press = 1;
        }
        active = "slide";
      } else if (s < S6.toSlideTitle[0]) {
        pos = br;
        if (slide) select = { r: slide, label: "Prezentace 16:9", o: 1 };
        active = "slide";
      } else if (s < S6.toLogo[0]) {
        typeAt(slideTitle, { toText: S6.toSlideTitle, textClick: S6.slideTitleClick }, br, "Nadpis snímku");
        active = "slide";
      } else if (s < S6.toChip[0]) {
        pos = move(textPt(slideTitle), mid(logo), within(S6.toLogo)(s));
        press = click(s, S6.logoClick, 0.008);
        if (logo && s >= S6.logoClick) select = { r: logo, label: "Logo", o: 1 };
        active = "brand";
      } else if (s < S6.dupStart) {
        // První barva identity: najetí, klik, postaví se.
        pos = move(mid(logo), mid(chip(0)), within(S6.toChip)(s));
        press = click(s, S6.chipClick, 0.008);
        const r = chip(0);
        if (r && s >= S6.chipClick) select = { r, label: "Barva", o: 1 };
        active = "chip-0";
      } else if (lastChip >= 1 && s < chipDup(lastChip).b) {
        // Další barvy: duplikáty (Ctrl/⌘ + D) z předchozí na své místo.
        let i = 1;
        while (i < lastChip && s >= chipDup(i).b) i++;
        const d = chipDup(i);
        const r = chip(i);
        pos = mid(r);
        const dragging = s < d.drop;
        press = dragging ? 1 : 0;
        duplicate = dragging ? within([d.a, d.a + 0.005])(s) : 0;
        if (r) select = { r, label: dragging ? "Barva kopie" : "Barva", o: 1 };
        if (dragging) key = "duplicate";
        active = `chip-${i}`;
      } else if (s < S6.leave[0]) {
        pos = mid(chip(lastChip));
      } else pos = move(mid(chip(lastChip)), park, within(S6.leave)(s));
      events = [
        { t: S6.textClick, row: { id: "text", kind: "text", name: "Text" } },
        { t: S6.bannerClick, row: { id: "banner", kind: "image", name: "Banner" } },
        { t: S6.toSlide[1], row: { id: "slide", kind: "frame", name: "Prezentace 16:9" } },
        { t: S6.brand[0], row: { id: "brand", kind: "frame", name: "Identita značky" } },
        { t: S6.chipClick, row: { id: "chip-0", kind: "pill", name: "Barva" } },
        ...Array.from({ length: lastChip }, (_, n) => {
          const d = chipDup(n + 1);
          return { t: d.a, row: { id: `chip-${n + 1}`, kind: "pill" as const, name: s < d.drop ? "Barva kopie" : "Barva" } };
        }),
      ];
    }

    // ---- Psaní: textový kurzor od kliknutí do textu, dokud text nedopíše
    // (nebo myš nejde dál). Na psaní se nečeká. ----
    let typing = false;
    for (const name of Object.keys(TYPING)) {
      const t = TYPING[name];
      // Před začátkem psaní se text vrátí na zástupný — příště se píše znovu.
      if (v < t.at) done.keys.delete(name);
      else if (v < t.until && !done.keys.has(name)) typing = true;
    }

    // Myš se ukáže, když kamera dorazí ke kroku 01, a zmizí při letu k výzvě.
    const shown = within([0.3, 0.36])(v) * (1 - within([LAST_STEP, LAST_STEP + 0.06])(v));
    cursor.x.set(pos[0]);
    cursor.y.set(pos[1]);
    cursor.opacity.set(shown);
    cursor.press.set(press);
    cursor.duplicate.set(duplicate);
    writeBox(selection, select);
    writeBox(hover, hovered);
    marqueeBox.opacity.set(0);

    showPanel(panelOpacity, panelScale, within([0.34, 0.4])(v) * (1 - within([LAST_STEP, LAST_STEP + 0.06])(v)));
    showPanel(textPanel.opacity, textPanel.scale, k === 4 ? textPanelShown : 0);

    const rows = events.filter((e) => s >= e.t).map((e) => e.row);
    // Karta zadání: kolik polí se už píše (nadpis, pak popisek a hodnota).
    let brief = v >= S1.titleClick ? 1 : 0;
    for (let i = 0; i < briefRows; i++) {
      const r = briefRow(i);
      if (v >= r.label) brief++;
      if (v >= r.value) brief++;
    }
    const nextTyped: StepTyped = {
      s1: v >= TYPING.s1.at,
      brief,
      s2: v >= TYPING.s2.at,
      s5: v >= TYPING.s5.at,
      s6: v >= TYPING.s6.at,
      slide: v >= TYPING.slide.at,
      client: v >= 3 + S4.clientType,
      me: v >= TYPING.me.at,
      sizeFocus: v >= 3 + S4.sizeClick && v < 3 + S4.grow[1],
      size: v >= TYPING.size.at,
    };
    const next = `${k}|${rows.map((r) => `${r.id}:${r.name}`).join(",")}#${active}#${key}#${typing}#${Object.values(nextTyped).join("")}`;
    if (next !== stamp.current) {
      stamp.current = next;
      setUi({ rows, active, shortcut: key, text: typing });
      setTyped(nextTyped);
    }
  };

  // Jen v dosahu kroků (a jednou za hranicí, ať se vše schová).
  const live = useRef(false);
  useAnimationFrame(() => {
    const v = seg.get();
    const inRange = enabled && v > 0.25 && v < LAST_STEP + 0.1;
    if (!inRange) {
      if (live.current) hide();
      live.current = false;
      return;
    }
    live.current = true;
    update(v);
  });

  return {
    cursor,
    selection,
    hover,
    marquee: marqueeBox,
    panelOpacity,
    panelScale,
    textPanel,
    ui,
    typed,
    /** TypeText `onDone` pro klíč psaní — myš pak přestane čekat. */
    doneFor: done.fn,
  };
}
