// Obsah případové studie — tvar, který plní Studio (záložka „Případová
// studie" v projektu, převod v src/lib/site/study.ts), a ZÁLOHA Věciček
// pro web bez databáze (components/projects/fallback.ts).
//
// Šablona: Věcičky. Nadpisy a texty kapitol jsou Sabininy (návrh studie
// ve Figmě) — text se pod nadpisem vypisuje. Poznámky přes díla (asides)
// jsou krátké postřehy navíc, odvozené z bannerů — Sabina je ověří.
//
// NDA: žádné kódy barev ani názvy písem klienta — ani v datech.

export type StudyImage = { src: string; alt: string; width: number; height: number };

/** Úsek textu: `true` = zelené zvýraznění, "bold" = tučně. */
export type StudyPart = [string, boolean | "bold"];

export type StudyOutput = { image: StudyImage; format: string; caption: string };

/** Dílo v kapitole: obrázek, krátký štítek (druh) a název. */
export type StudyWork = { image: StudyImage; tag: string; name: string };

/**
 * Kapitola: nadpis (zelená část `true`, zbytek světlý), text pod nadpisem
 * (odstavce), krátké poznámky nalepené přes díla a díla, která ji nesou.
 * Na výšku se text pod nadpis nevejde — jde do poznámek místo nich.
 */
export type StudyChapter = { label: string; heading: StudyPart[]; text: StudyPart[][]; asides: StudyPart[][]; works: StudyWork[] };

export type StudyBoard = "cover" | "play" | "campaigns" | "trust" | "outputs";

export type StudyContent = {
  /** Pořadí projektu („01") a druh práce. */
  index: string;
  kind: string;
  title: string;
  meta: { label: string; value: string }[];
  /** Kapitoly v pořadí cesty kamery (Výstupy jsou editor). */
  chapters: Record<Exclude<StudyBoard, "outputs">, StudyChapter>;
  /** Výstupy — libovolné tvary, rozměry a názvy. */
  outputs: StudyOutput[];
  /** Závěrečná výzva (po oddálení na celé plátno): věta, tlačítko, stav. */
  cta: { lead: StudyPart[]; button: string; status: StudyPart[] };
};

const vecicky = (n: number, alt: string, width: number, height: number): StudyImage => ({
  src: `/assets/banners/vecicky_banner${n}.png`,
  alt: `Banner Věcičky — ${alt}`,
  width,
  height,
});

const V = {
  sleva52: vecicky(1, "Sleva 52 % na kraťasy", 1317, 1640),
  let25: vecicky(2, "25 let s dětmi", 1048, 1305),
  novaKolekce: vecicky(3, "Nová kolekce", 959, 1195),
  zimniKolekceCtverec: vecicky(4, "Nová zimní kolekce", 1175, 1175),
  blackFriday: vecicky(5, "Black Friday", 751, 751),
  heureka: vecicky(6, "Ověřený e-shop", 751, 751),
  jarniNovinky: vecicky(7, "Jarní novinky", 1273, 1586),
  posledniDen: vecicky(8, "Poslední den, sleva 25 %", 1061, 1322),
  overenoRodici: vecicky(9, "Ověřeno rodiči", 1059, 1319),
  dekujeme: vecicky(10, "Děkujeme, že se vracíte", 1059, 1319),
  jarniKolekce: vecicky(11, "Jarní kolekce", 1061, 1322),
  jarniNovinky2: vecicky(12, "Jarní novinky, funkční oblečení", 1061, 1322),
  sleva30: vecicky(13, "Sleva 30 %", 837, 1043),
  vyprodej: vecicky(14, "Zimní výprodej 30 %", 1143, 1424),
  blackFridayStory: vecicky(15, "Black Friday, story", 1351, 2380),
  zimniKolekce: vecicky(16, "Nová zimní kolekce, story", 1468, 2587),
  podzim: vecicky(17, "Podzim 2025, nová kolekce", 1447, 2549),
  teplo: vecicky(18, "Teplo bez kompromisů", 1143, 1424),
};

const work = (image: StudyImage, tag: string, name: string): StudyWork => ({ image, tag, name });

const output = (image: StudyImage, caption: string): StudyOutput => ({
  image,
  caption,
  format: `${image.width === image.height ? "Post" : image.height / image.width > 1.6 ? "Story" : "Banner"} · ${image.width} × ${image.height}`,
});

export const STUDY_TEMPLATE: StudyContent = {
  index: "01",
  kind: "Reklamní bannery",
  title: "Věcičky",
  meta: [
    { label: "Klient", value: "Věcičky" },
    { label: "Rok", value: "2025" },
    { label: "Rozsah", value: "18 vizuálů" },
    { label: "Formáty", value: "Story · Post · Banner" },
  ],
  chapters: {
    cover: {
      label: "Titulní",
      heading: [
        ["Věcičky", true],
        ["Reklamní bannery", false],
      ],
      text: [
        [
          ["Série", false],
          ["reklamních vizuálů pro Věcičky", "bold"],
          ["– od prezentace nových kolekcí přes sezónní kampaně až po slevové a brandové bannery.", false],
        ],
      ],
      asides: [[["18 vizuálů", "bold"], ["ve třech formátech – story, post a banner.", false]]],
      works: [
        work(V.blackFridayStory, "Story", "Black Friday"),
        work(V.zimniKolekce, "Story", "Nová zimní kolekce"),
        work(V.podzim, "Story", "Podzim 2025"),
      ],
    },
    play: {
      label: "Pro rodiče",
      heading: [
        ["Hravé,", true],
        ["ale pro rodiče", false],
      ],
      text: [
        [
          ["Dětský sortiment přirozeně nabízí prostor pro hravější vizuální komunikaci.", "bold"],
          ["Zároveň ale bylo důležité", false],
          ["nezapomínat na to, že skutečným zákazníkem je především rodič.", "bold"],
        ],
        [
          ["Cílem proto bylo najít rovnováhu mezi hravostí, barevností a čistou prodejní komunikací,", "bold"],
          ["která dokáže zaujmout, ale nepůsobí přeplácaně nebo příliš dětsky.", false],
        ],
      ],
      asides: [
        [["Hravost:", "bold"], ["fotka v pohybu, barvy a tvary.", false]],
        [["Prodej:", "bold"], ["nadpis, nabídka a jedno tlačítko.", false]],
      ],
      works: [
        work(V.jarniNovinky, "Kolekce", "Jarní novinky"),
        work(V.jarniKolekce, "Kolekce", "Jarní kolekce"),
        work(V.teplo, "Kolekce", "Teplo bez kompromisů"),
        work(V.jarniNovinky2, "Kolekce", "Jarní novinky"),
      ],
    },
    campaigns: {
      label: "Kampaně",
      heading: [
        ["Od nové kolekce", true],
        ["po Black Friday", false],
      ],
      text: [
        [
          ["Vedle nových kolekcí vznikala také řada prodejních kampaní –", false],
          ["od klasických slevových akcí a Black Friday až po speciální promo,", "bold"],
          ["při kterém se každý den měnil zvýhodněný produkt.", false],
        ],
      ],
      asides: [[["Stejná kostra,", "bold"], ["jiná nabídka – kolekce, sleva, Black Friday.", false]]],
      works: [
        work(V.novaKolekce, "Kolekce", "Nová kolekce"),
        work(V.jarniNovinky, "Kolekce", "Jarní novinky"),
        work(V.zimniKolekceCtverec, "Kolekce", "Nová zimní kolekce"),
        work(V.sleva30, "Sleva", "Sleva 30 %"),
        work(V.vyprodej, "Sleva", "Zimní výprodej"),
        work(V.posledniDen, "Sleva", "Poslední den"),
        work(V.sleva52, "Denní promo", "Pouze dnes"),
        work(V.blackFriday, "Black Friday", "Black Friday"),
        work(V.blackFridayStory, "Black Friday", "Black Friday · story"),
      ],
    },
    trust: {
      label: "Důvěra",
      heading: [
        ["Důvěra", true],
        ["v českou značku", false],
      ],
      text: [
        [
          ["Součástí komunikace byly také", false],
          ["bannery zaměřené na budování důvěry.", "bold"],
          ["Využívala jsem v nich", false],
          ["silné přednosti značky", "bold"],
          ["– výrobu v Česku, vlastní prodejny, zákaznická hodnocení nebo ocenění Heureka.", false],
        ],
      ],
      asides: [[["Fakta místo slibů:", "bold"], ["hodnocení, tradice, ocenění.", false]]],
      works: [
        work(V.overenoRodici, "Hodnocení", "Ověřeno rodiči"),
        work(V.let25, "Tradice", "25 let s dětmi"),
        work(V.dekujeme, "Hodnocení", "Děkujeme, že se vracíte"),
        work(V.heureka, "Heureka", "Ověřený e-shop"),
      ],
    },
  },
  outputs: [
    output(V.podzim, "Podzim 2025"),
    output(V.zimniKolekce, "Nová zimní kolekce"),
    output(V.blackFridayStory, "Black Friday"),
    output(V.jarniNovinky, "Jarní novinky"),
    output(V.sleva52, "Sleva 52 %"),
    output(V.posledniDen, "Poslední den"),
    output(V.jarniKolekce, "Jarní kolekce"),
    output(V.jarniNovinky2, "Jarní novinky"),
    output(V.novaKolekce, "Nová kolekce"),
    output(V.zimniKolekceCtverec, "Nová zimní kolekce"),
    output(V.teplo, "Teplo bez kompromisů"),
    output(V.sleva30, "Sleva 30 %"),
    output(V.vyprodej, "Zimní výprodej"),
    output(V.blackFriday, "Black Friday"),
    output(V.overenoRodici, "Ověřeno rodiči"),
    output(V.let25, "25 let s dětmi"),
    output(V.dekujeme, "Děkujeme"),
    output(V.heureka, "Ověřený e-shop"),
  ],
  cta: {
    lead: [
      ["Věcičky jsou hotové.", false],
      ["Další studie může být ta vaše.", true],
    ],
    button: "Začněme spolu",
    status: [
      ["Odpovím do", false],
      ["24 hodin", true],
    ],
  },
};
