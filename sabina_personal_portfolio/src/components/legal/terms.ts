// Texty právních stránek — /cookies a /ochrana-soukromi. Převzaté doslova
// z webu Procházka Group (src/constants/cookiesTerms.js); jediná změna jsou
// kontaktní e-maily (gdpr@ / dpo@prochazkagroup.cz → e-mail Sabiny).
//
// Ve Studiu je totéž v blocích textů `cookies.*` a `ochrana-soukromi.*`
// (src/lib/cms/legal.ts, seed scripts/seed/legal.mjs); tohle je záloha a
// zároveň seznam oddílů — `id` je kotva v obsahu (#rights), pořadí je kód.
//
// POZOR: obecné znění. Před spuštěním ho má ověřit právník a doplnit
// skutečné údaje správce (jméno, IČO, adresa) — upravuje se ve Studiu.

export type LegalSection = { id: string; title: string; content?: string };

/** Kontaktní e-mail pro uplatnění práv (zatím e-mail z kontaktu webu). */
export const LEGAL_EMAIL = "ahoj@sabinahudrmentova.cz";

export const CookiesSections: LegalSection[] = [
  {
    id: "about",
    title: "O souborech cookies",
    content:
      "Soubory cookie jsou malé textové soubory, které webové stránky, které navštívíte, ukládají do vašeho počítače. Webové stránky používají soubory cookie, aby uživatelům umožnily efektivně se orientovat a provádět určité funkce. Soubory cookie, které jsou vyžadovány pro správné fungování webových stránek, je možné nastavovat bez Vašeho svolení. Všechny ostatní soubory cookie je nutné před nastavením v prohlížeči schválit. Svůj souhlas s používáním souborů cookie můžete na naší stránce Zásady ochrany osobních údajů kdykoli změnit na konci této stránky.",
  },
  {
    id: "overall",
    title: "Prohlášení o souborech cookie",
  },
  {
    id: "performance",
    title: "Cookies",
    content:
      "Cookies jsou malé textové soubory, které jsou umístěny na vašem počítači webovými stránkami, které navštěvujete. Jsou hojně používány, aby webové stránky fungovaly nebo fungovaly efektivněji, a také k poskytování informací vlastníkům stránek.",
  },
  {
    id: "analytics",
    title: "Jak používáme cookies",
    content:
      "Používáme cookies, abychom zlepšili vaši zkušenost s webovými stránkami. Tato politika cookies je součástí naší politiky ochrany soukromí a pokrývá používání cookies mezi vaším zařízením a naším webem. Také poskytujeme základní informace o službách třetích stran, které můžeme používat, a které mohou také používat cookies jako součást své služby, i když nejsou kryty naší politikou.",
  },
  {
    id: "marketing",
    title: "Typy cookies",
    content:
      "Existuje několik různých typů cookies, nicméně naše webové stránky používají: Funkční - Naše společnost používá tyto cookies, aby vás rozpoznala na našich webových stránkách a zapamatovala si vaše dříve vybrané preference. To může zahrnovat jazyk, který preferujete, a místo, kde se nacházíte. Používáme mix cookies první a třetí strany.",
  },
  {
    id: "uncategorized",
    title: "Jak ovládat cookies",
    content:
      "Cookies můžete ovládat a/nebo mazat podle svého uvážení – podrobnosti naleznete na aboutcookies.org. Můžete smazat všechny cookies, které jsou již na vašem počítači, a můžete nastavit většinu prohlížečů, aby zabránily jejich umístění. Pokud tak učiníte, možná budete muset při každé návštěvě webu ručně upravovat některé preference a některé služby a funkce nemusí fungovat.",
  },
  {
    id: "Uses",
    title: "Použití cookies",
    content:
      "Cookie je malý textový dokument, který je kopírován na Váš hard disk z webové stránky. Cookies nezpůsobují žádné poškození Vašeho počítače, ani neobsahují žádné viry. Cookies z naší stránky nesbírají žádná Vaše osobní data. Používání cookies můžete kdykoli zakázat v nastavení Vašeho prohlížeče. Cookies na našich stránkách jsou používány pouze po dobu Vaší návštěvy pro zaručení anonymity, statistické potřeby a zlepšení rozhraní pro uživatele. Tyto stránky využívají pouze cookies, které slouží k zajištění funkčnosti stránek a ke zvýšení Vašeho uživatelského komfortu. Prostřednictvím cookies nesbíráme jakákoli data o uživatelích stránek, zejména pak nedochází ke sběru osobních údajů. V případě, že nebudete s nahráním cookies do vašeho počítače souhlasit, můžete odmítnou instalaci cookies nastavením Vašeho internetového prohlížeče, standardně v kartě Nastavení / nastavení obsahu / soubory cookie.",
  },
  {
    id: "necessary",
    title: "Nezbytné cookies",
    content:
      "Tyto cookies jsou nezbytné pro fungování webových stránek. Zahrnují například cookies, které umožňují přihlášení do zabezpečených částí webu. Tyto cookies nemohou být vypnuty.",
  },
  {
    id: "preferences",
    title: "Preferenční cookies",
    content:
      "Tyto cookies umožňují webové stránce zapamatovat si volby, které jste učinili (například preferovaný jazyk nebo region) a poskytnout vylepšené, personalizovanější funkce. Doba uchovávání těchto cookies je 6 měsíců.",
  },
  {
    id: "third-party",
    title: "Cookies třetích stran",
    content:
      "Náš web používá služby třetích stran jako Google Analytics a sociální média. Tyto služby mohou ukládat cookies pro analytické účely a měření výkonu. Kompletní seznam třetích stran a jejich cookies je k dispozici v nastavení cookies.",
  },
];

export const PrivacySections: LegalSection[] = [
  {
    id: "privacy",
    title: "Zásady ochrany osobních údajů",
    content:
      "Jsme společnost, která bere ochranu dat a soukromí velmi vážně. Jsme odhodláni chránit vaše osobní údaje a být transparentní ohledně toho, jaké informace o vás máme.",
  },
  {
    id: "data",
    title: "Jaké údaje shromažďujeme?",
    content:
      "Shromažďujeme osobní údaje od vás, když nám je přímo poskytujete, a také prostřednictvím vašeho využívání našich služeb. Tyto informace mohou zahrnovat: Informace, které nám poskytnete, když používáte naše služby nebo se registrujete k účtu. Informace, které poskytnete při účasti na jakýchkoli interaktivních funkcích služeb. Korespondenci nebo jiné informace, které nám zasíláte. Informace shromážděné při používání našich služeb.",
  },
  {
    id: "use",
    title: "Jak používáme vaše údaje?",
    content:
      "Vaše údaje používáme k poskytování, podpoře, personalizaci a rozvoji našich služeb. Jak používáme vaše osobní údaje, závisí na tom, jakým způsobem interagujete s našimi službami a na volbách, které děláte. Používáme údaje, které máme o vás, k poskytování a personalizaci našich služeb, aby byly relevantnější a užitečnější pro vás i ostatní.",
  },
  {
    id: "sharing",
    title: "Sdílíme vaše údaje?",
    content:
      "Vaše údaje budeme sdílet s třetími stranami pouze způsoby uvedenými v těchto zásadách ochrany osobních údajů. Můžeme zpřístupnit třetím stranám údaje, které byly anonymizovány tak, aby nemohly být použity k vaší identifikaci. Můžeme sdílet vaše údaje s: Společnostmi v rámci naší skupiny, Našimi poskytovateli služeb třetích stran, Našimi obchodními partnery.",
  },
  {
    id: "legal-basis",
    title: "Právní základ zpracování",
    content:
      "Vaše osobní údaje zpracováváme na základě: Vašeho souhlasu, Plnění smlouvy, Našich oprávněných zájmů, Plnění právních povinností. Pro každý účel zpracování vždy určujeme odpovídající právní základ.",
  },
  {
    id: "retention",
    title: "Doba uchovávání údajů",
    content:
      "Vaše osobní údaje uchováváme pouze po dobu nezbytně nutnou k naplnění účelů uvedených v těchto zásadách, obvykle po dobu trvání vašeho účtu plus 24 měsíců, nebo dokud neodvoláte svůj souhlas.",
  },
  {
    id: "rights",
    title: "Vaše práva",
    content: `Podle GDPR máte právo na: Přístup k vašim údajům, Opravu údajů, Výmaz údajů, Přenositelnost údajů, Vznesení námitky, Odvolání souhlasu. Pro uplatnění těchto práv nás kontaktujte na ${LEGAL_EMAIL}.`,
  },
  {
    id: "international",
    title: "Mezinárodní přenosy",
    content:
      "Pokud přenášíme vaše údaje mimo EU/EHP, zajišťujeme odpovídající úroveň ochrany pomocí standardních smluvních doložek schválených Evropskou komisí nebo jiných vhodných záruk.",
  },
  {
    id: "dpo",
    title: "Kontakt na DPO",
    content: `Máte-li jakékoliv dotazy týkající se zpracování vašich osobních údajů, můžete kontaktovat našeho pověřence pro ochranu osobních údajů (DPO) na email: ${LEGAL_EMAIL}`,
  },
];

// Obchodní podmínky — Procházka Group je nemá, tohle je NÁVRH obecných
// podmínek grafické designérky na volné noze (stejné rozvržení jako ochrana
// soukromí). PŘED SPUŠTĚNÍM je musí ověřit právník a doplnit údaje
// (jméno, IČO, sídlo) — upravují se ve Studiu.
export const TermsSections: LegalSection[] = [
  {
    id: "uvod",
    title: "Úvodní ustanovení",
    content:
      "Tyto obchodní podmínky upravují vztah mezi Sabinou Hudrmentovou jako poskytovatelkou grafických služeb a objednatelem. Objednáním služby objednatel potvrzuje, že se s podmínkami seznámil a souhlasí s nimi. Odchylná ujednání v individuální nabídce nebo smlouvě mají před těmito podmínkami přednost.",
  },
  {
    id: "objednavka",
    title: "Objednávka a nabídka",
    content:
      "Spolupráce začíná poptávkou, na kterou objednatel obdrží nabídku s rozsahem práce, cenou a předpokládaným termínem. Objednávka je závazná okamžikem jejího potvrzení e-mailem nebo podpisem smlouvy. Změny rozsahu po potvrzení se řeší dodatečnou dohodou.",
  },
  {
    id: "cena",
    title: "Cena a platební podmínky",
    content:
      "Cena se řídí potvrzenou nabídkou. U rozsáhlejších zakázek může být požadována záloha ve výši 50 % ceny, zbytek je splatný po předání výstupů. Faktury jsou splatné do 14 dnů od vystavení, pokud není dohodnuto jinak.",
  },
  {
    id: "spoluprace",
    title: "Průběh spolupráce a korektury",
    content:
      "Objednatel dodá potřebné podklady (texty, loga, fotografie) včas a v dohodnuté kvalitě. Cena zahrnuje dvě kola korektur, pokud nabídka neuvádí jinak; další úpravy nebo změny zadání se účtují zvlášť. Zpoždění podkladů nebo zpětné vazby posouvá termín dodání.",
  },
  {
    id: "predani",
    title: "Předání a termíny",
    content:
      "Výstupy se předávají elektronicky ve formátech uvedených v nabídce. Termín dodání je orientační a závisí na včasné součinnosti objednatele. Za převzaté se dílo považuje okamžikem jeho schválení, nebo pokud objednatel nevznese připomínky do 7 dnů od předání.",
  },
  {
    id: "prava",
    title: "Autorská práva a licence",
    content:
      "Po úplném zaplacení ceny získává objednatel licenci k užití výstupů v rozsahu uvedeném v nabídce. Zdrojová data a nepoužité návrhy zůstávají majetkem autorky, pokud se strany nedohodnou jinak. Autorka si vyhrazuje právo uvádět dílo ve svém portfoliu, nebrání-li tomu dohoda o mlčenlivosti.",
  },
  {
    id: "mlcenlivost",
    title: "Mlčenlivost",
    content:
      "Informace a podklady, které objednatel v rámci spolupráce poskytne, jsou považovány za důvěrné a nejsou bez jeho souhlasu předávány třetím stranám. Na přání objednatele lze uzavřít samostatnou dohodu o mlčenlivosti.",
  },
  {
    id: "odpovednost",
    title: "Odpovědnost",
    content:
      "Objednatel odpovídá za to, že dodané podklady neporušují práva třetích osob. Autorka neodpovídá za obsahovou a jazykovou správnost textů dodaných objednatelem ani za škody vzniklé jejich užitím.",
  },
  {
    id: "zaver",
    title: "Závěrečná ustanovení",
    content: `Tyto podmínky se řídí právním řádem České republiky. Případné spory se strany pokusí vyřešit nejprve dohodou. Dotazy k podmínkám můžete posílat na ${LEGAL_EMAIL}.`,
  },
];
