// Vlna procesu (zelená křivka s uzly 01–05) z doby horizontálního tracku.
// Proces teď jede jako DollyGallery do hloubky a plochá vlna přes 455vw
// v něm nemá kde ležet — data jsou tu schovaná pro 3D verzi linky.
//
// Uzly: x/y jsou zlomky původního tracku (455vw) a výšky sekce, přeměřené
// z Figmy (screeny 150 + 135 + 170vw).
export const NODES = [
  { x: 21, y: 64 },
  { x: 37, y: 65 },
  { x: 51, y: 52 },
  { x: 68, y: 81 },
  { x: 85, y: 52 },
];

// Vlna přes celý track. viewBox 4550x1000 => 10 jednotek = 1vw.
// Uzly leží na souřadnicích (x*45.5, y*10) z NODES.
//
// DVA kvadratické segmenty na úsek, ne jeden. Jeden Q má jediný kontrolní
// bod, takže tečna na začátku i na konci segmentu je tímtéž bodem svázaná —
// nelze je zadat nezávisle a v uzlech vznikaly rohy (naměřeno až 17,4° u
// uzlu 04). Dvojice Q dává dva stupně volnosti, takže tečna z obou stran
// uzlu sedí a napojení je C1 spojité.
//
// Sklony tečen jsou z monotónní (Fritsch–Carlson) interpolace: kde sekanty
// mění znaménko, je uzel lokální extrém a tečna vyjde vodorovná.
//   P0(0,800) −0.166 | P1(965,640) 0 | P2(1688,650) 0 | P3(2312,520) 0
//   P4(3110,810) 0 | P5(3845,520) −0.297 | P6(4550,380) −0.199
export const WAVE_PATH = [
  "M 0 800",
  "Q 321 746, 482 693 Q 643 640, 965 640", // náběh k uzlu 01 (vrchol)
  "Q 1206 640, 1326 645 Q 1447 650, 1688 650", // k uzlu 02 (údolí)
  "Q 1896 650, 2000 585 Q 2104 520, 2312 520", // vzhůru k uzlu 03 (vrchol)
  "Q 2578 520, 2711 665 Q 2844 810, 3110 810", // dolů k uzlu 04 (údolí)
  "Q 3355 810, 3477 701 Q 3600 592, 3845 520", // vzhůru k uzlu 05
  "Q 4080 450, 4197 438 Q 4315 426, 4550 380", // doběh
].join(" ");

/** Zaškrtnutí v posledním uzlu. */
export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
