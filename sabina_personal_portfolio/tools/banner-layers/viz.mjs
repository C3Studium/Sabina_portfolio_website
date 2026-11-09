// Náhled rozkladu pro kontrolu: originál | vrstvy (barvy, rámečky, popisky) |
// postup | linky skici. Zapíše probe/<jméno>.png. `npm run viz [jméno…]`
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
const dir = "../../public/assets/banners/layers";
fs.mkdirSync("probe", { recursive: true });
const names = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
for (const name of names) {
  const json = JSON.parse(fs.readFileSync(path.join(dir, name + ".json"), "utf8"));
  const { data, info } = await sharp(path.join(dir, name + ".png")).raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const hue = (k) => { const h = (k * 137.508) % 360, s = 0.65, l = 0.55; const f = (q) => { const t = (q + h / 30) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(t - 3, 9 - t, 1)); }; return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)); };
  const layers = Buffer.alloc(n * 3), prog = Buffer.alloc(n * 3), lines = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) {
    const k = data[i * 4], p = data[i * 4 + 1], e = data[i * 4 + 2];
    const c = k === 0 ? [40, 40, 40] : hue(k);
    layers.set(c, i * 3);
    prog.set([p, p, p], i * 3);
    lines.set([255 - e, 255 - e, 255 - e], i * 3);
  }
  const W = 300, H = Math.round((300 * info.height) / info.width);
  const tile = (buf) => sharp(buf, { raw: { width: info.width, height: info.height, channels: 3 } }).resize(W, H).png().toBuffer();
  const orig = await sharp(path.join("../../public", json.source)).resize(W, H, { fit: "fill" }).png().toBuffer();
  const tiles = [orig, await tile(layers), await tile(prog), await tile(lines)];
  // popisky vrstev přes mapu
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${json.layers.map((l, k) => k ? `<rect x="${l.box[0] * W}" y="${l.box[1] * H}" width="${l.box[2] * W}" height="${l.box[3] * H}" fill="none" stroke="white" stroke-dasharray="3 2"/><text x="${l.box[0] * W + 2}" y="${l.box[1] * H + 9}" font-size="9" fill="white" font-family="sans-serif">${k} ${l.kind}:${l.label.replace(/[<&]/g, "")}</text>` : "").join("")}</svg>`;
  tiles[1] = await sharp(tiles[1]).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
  await sharp({ create: { width: W * 4 + 30, height: H, channels: 3, background: "#111" } })
    .composite(tiles.map((input, i) => ({ input, left: i * (W + 10), top: 0 })))
    .png().toFile(`probe/${name}.png`);
  console.log("probe/" + name + ".png");
}
