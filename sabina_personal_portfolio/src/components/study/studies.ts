// Případové studie dalších projektů — ZÁLOHA v kódu (stejný tvar jako
// STUDY_TEMPLATE v content.ts). Ve Studiu je totéž v záložce „Případová
// studie" projektu (scripts/cms-studies.mjs); bez dat ve Studiu stránka
// projektu kreslí tuhle zálohu.
//
//   Vlněné zboží   texty ze Sabininy studie (Figma)
//   VIKIO          texty ze Sabininy studie (Figma)
//   Jordan         texty NAVRŽENÉ podle bannerů — Sabina je ověří
//
// Poznámky přes díla (asides) jsou krátké postřehy podle bannerů.
// NDA: žádné kódy barev ani názvy písem klienta — ani v datech.

import { STUDY_TEMPLATE, type StudyContent, type StudyImage, type StudyOutput, type StudyWork } from "./content.ts";

const banner = (brand: string, alt: string) => (n: number, name: string, width: number, height: number): StudyImage => ({
  src: `/assets/banners/${brand}_banner${n}.png`,
  alt: `${alt} — ${name}`,
  width,
  height,
});

const work = (image: StudyImage, tag: string, name: string): StudyWork => ({ image, tag, name });

const output = (image: StudyImage, caption: string): StudyOutput => ({
  image,
  caption,
  format: `${image.width === image.height ? "Post" : image.height / image.width > 1.6 ? "Story" : "Banner"} · ${image.width} × ${image.height}`,
});

const cta = (brand: string): StudyContent["cta"] => ({
  lead: [
    [`${brand} — hotovo.`, false],
    ["Další studie může být ta vaše.", true],
  ],
  button: "Začněme spolu",
  status: [
    ["Odpovím do", false],
    ["24 hodin", true],
  ],
});

/* ------------------------------------------------------- Vlněné zboží -- */

const vz = banner("vlnenezbozi", "Banner Vlněné zboží");
const VZ = {
  ponozky: vz(1, "Kvalitní ponožky z ovčí vlny", 1080, 1350),
  plysak: vz(2, "Přes den plyšák, večer polštářek", 1080, 1350),
  pelisek: vz(3, "Měkký pelíšek z pravé ovčí vlny", 1483, 1853),
  polstare: vz(4, "Celoroční polštáře a přikrývky", 1483, 1853),
  posezeni: vz(5, "Letní posezení s podsedákem", 1483, 1853),
  soutez: vz(6, "Jarní soutěž — nakup záhon, vyhraj hnojivo", 1423, 1778),
  jiniVyrobci: vz(7, "Rozdíl poznáte hned — srovnání záhonů", 1501, 1876),
  predsezonni: vz(8, "Předsezónní nabídka — vyvýšené záhony", 1501, 1877),
  zahony: vz(9, "Vyvýšené záhony", 1501, 1877),
  sauna: vz(10, "Saunové doplňky", 1501, 1877),
  dekujeme: vz(11, "Děkujeme za důvěru", 1501, 1877),
  pantofle: vz(12, "Oblíbené pantofle", 1501, 1876),
  merino: vz(13, "100% evropské merino", 1501, 1877),
  hrejive: vz(14, "Měkké a hřejivé ponožky", 1501, 1877),
};

export const STUDY_VLNENE_ZBOZI: StudyContent = {
  index: "02",
  kind: "Reklamní bannery",
  title: "Vlněné zboží",
  meta: [
    { label: "Klient", value: "Vlněné zboží" },
    { label: "Rok", value: "2025–2026" },
    { label: "Rozsah", value: "14 vizuálů" },
    { label: "Formáty", value: "Post · Banner" },
  ],
  chapters: {
    cover: {
      label: "Titulní",
      heading: [["Vlněné zboží", true]],
      text: [
        [
          ["Vizuální komunikace", "bold"],
          ["značky Vlněné zboží postavená kolem jednoho výjimečného materiálu – ovčí vlny.", false],
        ],
      ],
      asides: [[["14 vizuálů", "bold"], ["– ponožky, polštáře, záhony i sauna.", false]]],
      works: [
        work(VZ.posezeni, "Post", "Letní posezení"),
        work(VZ.plysak, "Post", "Přes den plyšák"),
        work(VZ.ponozky, "Post", "Kvalitní ponožky"),
      ],
    },
    play: {
      label: "Hodnota",
      heading: [
        ["Nejen ukázat produkt.", false],
        ["Vysvětlit jeho hodnotu.", true],
      ],
      text: [
        [
          ["Vlněné produkty mají řadu přirozených benefitů", "bold"],
          [", které ale", false],
          ["zákazník nemusí na první pohled znát", "bold"],
          [". Zvlášť ve chvíli, kdy je porovnává s levnějšími alternativami.", false],
        ],
        [
          ["Cílem vizuální komunikace proto nebylo pouze produkt ukázat, ale také rychle a", false],
          ["jednoduše vysvětlit, proč dává ovčí vlna smysl a v čem spočívá její přidaná hodnota.", "bold"],
        ],
      ],
      asides: [
        [["Benefit v obraze:", "bold"], ["vnitřní vrstva ze 100% ovčí vlny.", false]],
        [["Hodnocení zákazníků", "bold"], ["u každého produktu.", false]],
      ],
      works: [
        work(VZ.polstare, "Domov", "Celoroční polštáře"),
        work(VZ.pantofle, "Obuv", "Oblíbené pantofle"),
        work(VZ.hrejive, "Ponožky", "Měkké a hřejivé ponožky"),
        work(VZ.merino, "Ponožky", "100% evropské merino"),
      ],
    },
    campaigns: {
      label: "Sezona",
      heading: [
        ["Jeden materiál.", false],
        ["Jiná sezona.", true],
      ],
      text: [
        [
          ["S příchodem jara a léta se změnil nejen sortiment, ale i způsob komunikace.", "bold"],
          ["Teplé ponožky a zimní produkty ustoupily produktům, kde ovčí vlna plní úplně jinou funkci.", false],
        ],
        [
          ["Výraznou část komunikace tvořily například vyvýšené záhony, pro které", false],
          ["vznikla řada odlišných kreativních konceptů určených k testování.", "bold"],
        ],
      ],
      asides: [[["Tři koncepty", "bold"], ["záhonů k testování.", false]]],
      works: [
        work(VZ.predsezonni, "Záhony", "Předsezónní nabídka"),
        work(VZ.zahony, "Záhony", "Vyvýšené záhony"),
        work(VZ.jiniVyrobci, "Záhony", "Rozdíl poznáte hned"),
        work(VZ.sauna, "Sauna", "Saunové doplňky"),
        work(VZ.pelisek, "Mazlíčci", "Měkký pelíšek"),
      ],
    },
    trust: {
      label: "Důvěra",
      heading: [
        ["Důvěra, soutěže", true],
        ["a přelepky", true],
      ],
      text: [
        [
          [
            "Ne každý vizuál musí přímo prodávat. Recenze a ocenění pomáhaly budovat důvěru, soutěže zapojovaly zákazníky a tematické přelepky propojovaly jednotlivé produkty s charakterem značky a ovčí vlnou.",
            false,
          ],
        ],
      ],
      asides: [[["Soutěž:", "bold"], ["nakup záhon, vyhraj hnojivo.", false]]],
      works: [
        work(VZ.dekujeme, "Recenze", "Děkujeme za důvěru"),
        work(VZ.merino, "Značka", "100% evropské merino"),
        work(VZ.soutez, "Soutěž", "Jarní soutěž"),
        work(VZ.ponozky, "Hodnocení", "Kvalitní ponožky"),
      ],
    },
  },
  outputs: [
    output(VZ.ponozky, "Kvalitní ponožky"),
    output(VZ.plysak, "Přes den plyšák"),
    output(VZ.pelisek, "Měkký pelíšek"),
    output(VZ.polstare, "Celoroční polštáře"),
    output(VZ.posezeni, "Letní posezení"),
    output(VZ.soutez, "Jarní soutěž"),
    output(VZ.jiniVyrobci, "Rozdíl poznáte hned"),
    output(VZ.predsezonni, "Předsezónní nabídka"),
    output(VZ.zahony, "Vyvýšené záhony"),
    output(VZ.sauna, "Saunové doplňky"),
    output(VZ.dekujeme, "Děkujeme za důvěru"),
    output(VZ.pantofle, "Oblíbené pantofle"),
    output(VZ.merino, "100% evropské merino"),
    output(VZ.hrejive, "Měkké a hřejivé ponožky"),
  ],
  cta: cta("Vlněné zboží"),
};

/* -------------------------------------------------------------- VIKIO -- */

const vk = banner("vikio", "Banner VIKIO");
const VK = {
  recenze: vk(1, "Více než 3 500 ověřených recenzí", 1546, 1547),
  recenze2: vk(2, "Více než 3 500 ověřených recenzí, křesla", 1547, 1547),
  podzim: vk(4, "Podzimní sleva", 1546, 1546),
  vanoce: vk(5, "Garance dodání do Vánoc", 1546, 1547),
  trhaky: vk(6, "Povánoční cenové trháky", 1546, 1547),
  domacnosti: vk(7, "Mnoho domácností už sedí s námi", 1056, 1876),
  stovky: vk(8, "Nechali jsme sednout už stovky domácností", 1055, 1876),
  pracovni: vk(9, "Pracovní židle", 1502, 1877),
  zahrada: vk(10, "Židle pro každou zahradu i terasu", 1055, 1876),
  povanocni50: vk(11, "Povánoční výprodej až −50 %", 1056, 1876),
  povanocni65: vk(12, "Povánoční výprodej až −65 %", 1056, 1876),
  akcni: vk(13, "Akční výprodej až −50 %", 1501, 1876),
  denDeti: vk(14, "Pohodlí u každého úkolu", 1547, 1546),
};

export const STUDY_VIKIO: StudyContent = {
  index: "03",
  kind: "Reklamní bannery",
  title: "VIKIO",
  meta: [
    { label: "Klient", value: "VIKIO" },
    { label: "Rok", value: "2025" },
    { label: "Rozsah", value: "14 vizuálů" },
    { label: "Formáty", value: "Post · Story · Banner" },
  ],
  chapters: {
    cover: {
      label: "Titulní",
      heading: [["VIKIO", true]],
      text: [
        [
          ["Série", false],
          ["reklamních bannerů", "bold"],
          ["pro značku VIKIO s nábytkem. Od sezónních výprodejů a produktových kampaní až po vizuály zaměřené na budování důvěry ve značku.", false],
        ],
      ],
      asides: [[["14 vizuálů", "bold"], ["– post, story i banner.", false]]],
      works: [
        work(VK.povanocni50, "Story", "Povánoční výprodej"),
        work(VK.stovky, "Story", "Nechali jsme sednout"),
        work(VK.zahrada, "Story", "Židle pro každou zahradu"),
      ],
    },
    play: {
      label: "Výrazný prvek",
      heading: [
        ["Jak nezapadnout", true],
        ["mezi ostatní.", false],
      ],
      text: [
        [
          ["Nábytek je z pohledu reklamní grafiky specifický segment.", "bold"],
          ["Produkty i způsob jejich prezentace mohou napříč e-shopy působit velmi podobně.", false],
        ],
        [
          ["Prvním krokem proto bylo", false],
          ["podívat se na komunikaci konkurence", "bold"],
          ["a najít prostor, kde může být VIKIO výraznější a snadněji rozpoznatelné.", false],
        ],
      ],
      asides: [
        [
          ["Zastavit. Zaujmout. Předat sdělení.", "bold"],
          ["Člověk při procházení obsahu věnuje reklamě jen velmi krátkou pozornost.", false],
        ],
        [
          ["Banner proto", false],
          ["potřebuje výrazný prvek", "bold"],
          [", který dokáže pohled zastavit.", false],
        ],
      ],
      works: [
        work(VK.akcni, "Výprodej", "Akční výprodej"),
        work(VK.pracovni, "Produkt", "Pracovní židle"),
        work(VK.podzim, "Sleva", "Podzimní sleva"),
      ],
    },
    campaigns: {
      label: "Kampaně",
      heading: [
        ["Od Vánoc až po", true],
        ["letní výprodej", false],
      ],
      text: [
        [
          ["Vznikaly vizuály pro", false],
          ["vánoční, zimní výprodeje, Den dětí, letní slevové akce i kampaně zaměřené na bestsellery.", "bold"],
        ],
        [
          ["Každá událost potřebovala vlastní atmosféru", "bold"],
          [", ale zároveň muselo být stále patrné, že jde o komunikaci jedné značky.", false],
        ],
      ],
      asides: [[["Jedna značka,", "bold"], ["šest různých nálad.", false]]],
      works: [
        work(VK.vanoce, "Vánoce", "Garance dodání do Vánoc"),
        work(VK.povanocni65, "Povánoční výprodej", "Až −65 %"),
        work(VK.trhaky, "Povánoční výprodej", "Cenové trháky"),
        work(VK.povanocni50, "Povánoční výprodej", "Až −50 %"),
        work(VK.podzim, "Podzim", "Podzimní sleva"),
        work(VK.denDeti, "Den dětí", "Pohodlí u každého úkolu"),
      ],
    },
    trust: {
      label: "Důvěra",
      heading: [
        ["Nejen prodávat.", false],
        ["Budovat důvěru.", true],
      ],
      text: [
        [
          ["Důležitou roli hrály také", false],
          ["vizuály založené na sociálním důkazu", "bold"],
          ["– hodnocení zákazníků, recenze nebo ocenění Heureka.", false],
        ],
        [
          ["Tyto bannery mají jinou úlohu. Nemusí zákazníkovi pouze říkat „nakup teď“, ale pomáhají ukázat, že", false],
          ["za značkou stojí skuteční spokojení zákazníci.", "bold"],
        ],
      ],
      asides: [[["Reklama s recenzemi", false], ["už běží přes rok.", "bold"]]],
      works: [
        work(VK.recenze, "Recenze", "Více než 3 500 recenzí"),
        work(VK.domacnosti, "Hodnocení", "Mnoho domácností už sedí s námi"),
        work(VK.recenze2, "Recenze", "Ověření zákazníci"),
        work(VK.stovky, "Hodnocení", "Nechali jsme sednout"),
      ],
    },
  },
  outputs: [
    output(VK.recenze, "Více než 3 500 recenzí"),
    output(VK.recenze2, "Ověření zákazníci"),
    output(VK.podzim, "Podzimní sleva"),
    output(VK.vanoce, "Garance dodání do Vánoc"),
    output(VK.trhaky, "Cenové trháky"),
    output(VK.domacnosti, "Mnoho domácností"),
    output(VK.stovky, "Nechali jsme sednout"),
    output(VK.pracovni, "Pracovní židle"),
    output(VK.zahrada, "Židle pro každou zahradu"),
    output(VK.povanocni50, "Povánoční výprodej −50 %"),
    output(VK.povanocni65, "Povánoční výprodej −65 %"),
    output(VK.akcni, "Akční výprodej"),
    output(VK.denDeti, "Pohodlí u každého úkolu"),
  ],
  cta: cta("VIKIO"),
};

/* ------------------------------------------------------------- Jordan -- */

// Texty navržené podle bannerů (Sabina je ověří a upraví ve Studiu).
const jd = banner("jordan", "Banner Jordan");
const JD = {
  pistacie: jd(1, "Intenzivně hořká & prémiově pistáciová", 293, 366),
  dubajska: jd(2, "Dubajská čokoláda z Děčína", 200, 249),
  rucne: jd(3, "Ručně vyráběná čokoláda", 205, 256),
  pistacieVelky: jd(4, "Intenzivně hořká & prémiově pistáciová, banner", 305, 381),
  ctverec: jd(5, "Intenzivně hořká & prémiově pistáciová, čtverec", 194, 194),
  story: jd(6, "Intenzivně hořká & prémiově pistáciová, story", 231, 410),
};

export const STUDY_JORDAN: StudyContent = {
  index: "04",
  kind: "Reklamní bannery",
  title: "Jordan",
  meta: [
    { label: "Klient", value: "Jordan" },
    { label: "Rok", value: "2025" },
    { label: "Rozsah", value: "6 vizuálů" },
    { label: "Formáty", value: "Banner · Post · Story" },
  ],
  chapters: {
    cover: {
      label: "Titulní",
      heading: [["Jordan", true]],
      text: [
        [
          ["Série", false],
          ["reklamních vizuálů pro čokoládovnu Jordan", "bold"],
          ["– ručně vyráběnou čokoládu z Děčína, od nových příchutí až po příběh výroby.", false],
        ],
      ],
      asides: [[["6 vizuálů", "bold"], ["– banner, čtverec i story.", false]]],
      works: [
        work(JD.dubajska, "Banner", "Dubajská čokoláda"),
        work(JD.rucne, "Banner", "Ručně vyráběná čokoláda"),
        work(JD.story, "Story", "Hořká & pistáciová"),
      ],
    },
    play: {
      label: "Chuť",
      heading: [
        ["Chuť, kterou", true],
        ["je vidět.", false],
      ],
      text: [
        [
          ["Čokoládu nejde ochutnat přes obrazovku.", "bold"],
          ["Vizuály proto musely chuť přenést do obrazu – lom tabulky, náplň a barvy, které napoví dřív, než si zákazník přečte text.", false],
        ],
        [
          ["Hořká čokoláda a pistáciový krém dostaly", false],
          ["vlastní barevný svět", "bold"],
          [", který se opakuje na každém formátu a dělá kampaň poznatelnou na první pohled.", false],
        ],
      ],
      asides: [
        [["Lom tabulky", "bold"], ["ukáže náplň dřív než text.", false]],
        [["Ruční výroba v Děčíně", "bold"], ["jako podpis.", false]],
      ],
      works: [
        work(JD.pistacieVelky, "Banner", "Hořká & pistáciová"),
        work(JD.pistacie, "Banner", "Prémiově pistáciová"),
        work(JD.ctverec, "Post", "Hořká & pistáciová"),
      ],
    },
    campaigns: {
      label: "Formáty",
      heading: [
        ["Jeden motiv,", true],
        ["každý formát.", false],
      ],
      text: [
        [
          ["Hlavní motiv vznikl jednou a pak se", false],
          ["přeskládal do všech formátů kampaně", "bold"],
          ["– od čtverce po story.", false],
        ],
        [
          ["Nadpis, tabulka i podpis značky si drží své místo, aby byla kampaň", false],
          ["poznat v každém rozměru.", "bold"],
        ],
      ],
      asides: [[["Stejná kostra,", "bold"], ["jiný poměr stran.", false]]],
      works: [
        work(JD.ctverec, "Čtverec", "Hořká & pistáciová"),
        work(JD.pistacie, "Banner", "Hořká & pistáciová"),
        work(JD.pistacieVelky, "Banner", "Hořká & pistáciová"),
        work(JD.story, "Story", "Hořká & pistáciová"),
      ],
    },
    trust: {
      label: "Příběh",
      heading: [
        ["Ruční výroba", true],
        ["v Děčíně.", false],
      ],
      text: [
        [
          ["Vedle produktových bannerů vznikaly i vizuály, které", false],
          ["vyprávějí příběh značky", "bold"],
          ["– ruční výroba, místní původ a dubajská čokoláda z Děčína.", false],
        ],
        [
          ["Pomáhají ukázat, že", false],
          ["za každou tabulkou stojí skutečná řemeslná práce.", "bold"],
        ],
      ],
      asides: [[["Místo výroby", "bold"], ["jako argument.", false]]],
      works: [
        work(JD.rucne, "Příběh", "Ručně vyráběná čokoláda"),
        work(JD.dubajska, "Příběh", "Dubajská čokoláda z Děčína"),
        work(JD.pistacieVelky, "Produkt", "Hořká & pistáciová"),
      ],
    },
  },
  outputs: [
    output(JD.pistacie, "Prémiově pistáciová"),
    output(JD.dubajska, "Dubajská čokoláda"),
    output(JD.rucne, "Ručně vyráběná čokoláda"),
    output(JD.pistacieVelky, "Hořká & pistáciová"),
    output(JD.ctverec, "Hořká & pistáciová"),
    output(JD.story, "Hořká & pistáciová"),
  ],
  cta: cta("Jordan"),
};

/** Zálohy studií podle adresy projektu. */
export const STUDIES: Record<string, StudyContent> = {
  vecicky: STUDY_TEMPLATE,
  "vlnene-zbozi": STUDY_VLNENE_ZBOZI,
  vikio: STUDY_VIKIO,
  jordan: STUDY_JORDAN,
};
