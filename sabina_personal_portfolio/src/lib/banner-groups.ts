// Seskupení surových vrstev banneru do vrstev jako ve Figmě — čistá logika
// bez prohlížeče (jde spustit i v nástrojích). Popis skupin v banner-layers.ts.

import type { LayerInfo } from "@/motion/intro/layered";

export type GroupKind = "background" | "shape" | "object" | "text" | "button";

export type LayerGroup = {
  name: string;
  kind: GroupKind;
  /** Indexy surových vrstev (hodnota R v mapě). */
  members: number[];
  /** Box 0–1 vůči banneru: x, y, šířka, výška. */
  box: [number, number, number, number];
};

type Box = [number, number, number, number];

const union = (boxes: Box[]): Box => {
  const x0 = Math.min(...boxes.map((b) => b[0]));
  const y0 = Math.min(...boxes.map((b) => b[1]));
  const x1 = Math.max(...boxes.map((b) => b[0] + b[2]));
  const y1 = Math.max(...boxes.map((b) => b[1] + b[3]));
  return [x0, y0, x1 - x0, y1 - y0];
};

const inside = (x: number, y: number, b: Box) => x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3];

const capitalize = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text);

/** Surové vrstvy → skupiny, seřazené odzadu dopředu. */
export function groupLayers(layers: LayerInfo[]): LayerGroup[] {
  const indexed = layers.map((info, index) => ({ info, index }));
  const texts = indexed.filter((l) => l.info.kind === "text");
  const shapes = indexed.filter((l) => l.info.kind === "shape");
  const objects = indexed.filter((l) => l.info.kind === "object");
  const background = indexed.filter((l) => l.info.kind === "background");
  const groups: (LayerGroup & { order: number })[] = [];
  const add = (name: string, kind: GroupKind, members: { info: LayerInfo; index: number }[]) => {
    if (!members.length) return;
    groups.push({
      name,
      kind,
      members: members.map((m) => m.index),
      box: union(members.map((m) => m.info.box)),
      order: Math.max(...members.map((m) => m.index)),
    });
  };

  // Tlačítka: popisek, jehož střed leží v malém tvaru, i s tím tvarem.
  const usedShapes = new Set<number>();
  const usedTexts = new Set<number>();
  for (const shape of shapes) {
    const [, , w, h] = shape.info.box;
    if (w * h > 0.08) continue;
    const labels = texts.filter((t) => {
      const [x, y, tw, th] = t.info.box;
      return !usedTexts.has(t.index) && tw <= w * 1.05 && inside(x + tw / 2, y + th / 2, shape.info.box);
    });
    if (!labels.length) continue;
    usedShapes.add(shape.index);
    labels.forEach((t) => usedTexts.add(t.index));
    add("Tlačítko", "button", [shape, ...labels]);
  }

  // Text: řádky pod sebou s podobnou výškou písma a překryvem do strany
  // tvoří jeden blok.
  const lines = texts.filter((t) => !usedTexts.has(t.index)).sort((a, b) => a.info.box[1] - b.info.box[1]);
  const blocks: (typeof lines)[] = [];
  for (const line of lines) {
    const last = blocks[blocks.length - 1];
    const prev = last?.[last.length - 1];
    if (prev) {
      const [px, py, pw, ph] = prev.info.box;
      const [x, y, w, h] = line.info.box;
      const ratio = h / ph;
      const gap = y - (py + ph);
      const overlap = Math.min(px + pw, x + w) - Math.max(px, x);
      if (ratio > 0.62 && ratio < 1.6 && gap < 1.3 * Math.max(h, ph) && overlap > 0) {
        last.push(line);
        continue;
      }
    }
    blocks.push([line]);
  }
  const height = (block: typeof lines) => Math.max(...block.map((l) => l.info.box[3]));
  const top = (block: typeof lines) => Math.min(...block.map((l) => l.info.box[1]));
  // Nadpis: blok s největší plochou písma (výška × šířka řádků).
  const weight = (block: typeof lines) => block.reduce((sum, l) => sum + l.info.box[2] * l.info.box[3], 0);
  const headline = blocks.reduce<(typeof lines) | null>((best, b) => (!best || weight(b) > weight(best) ? b : best), null);
  const headlineBottom = headline ? Math.max(...headline.map((l) => l.info.box[1] + l.info.box[3])) : 0;
  // Podnadpis: první blok pod nadpisem s čitelným písmem.
  const subtitle = blocks
    .filter((b) => b !== headline && top(b) >= headlineBottom - 0.005 && top(b) - headlineBottom < 0.12 && height(b) >= 0.015)
    .sort((a, b) => top(a) - top(b))[0];
  const rest: typeof lines = [];
  for (const block of blocks) {
    if (block === headline) add("Nadpis", "text", block);
    else if (block === subtitle) add("Podnadpis", "text", block);
    else if (top(block) < 0.1 && height(block) < 0.035 && (!headline || top(block) < top(headline))) add("Logo", "text", block);
    else rest.push(...block);
  }
  add("Detaily", "text", rest);

  // Objekty dohromady, zbylé tvary dohromady, pozadí.
  const largest = objects.reduce<(typeof objects)[number] | null>(
    (best, o) => (!best || o.info.area > best.info.area ? o : best),
    null,
  );
  // Jeden převažující objekt (osoba s drobností) nese jeho název, jinak „Produkty".
  const objectArea = objects.reduce((sum, o) => sum + o.info.area, 0);
  const dominant = largest && largest.info.area > objectArea * 0.7;
  add(dominant || objects.length === 1 ? capitalize(largest?.info.label ?? "Objekt") : "Produkty", "object", objects);
  add("Tvary", "shape", shapes.filter((s) => !usedShapes.has(s.index)));
  add("Pozadí", "background", background);

  // Pozadí vždy vzadu, jinak podle nejpřednější surové vrstvy skupiny.
  return groups
    .sort((a, b) => (a.kind === "background" ? -1 : b.kind === "background" ? 1 : a.order - b.order))
    .map((group) => ({ name: group.name, kind: group.kind, members: group.members, box: group.box }));
}

