// Jména ikon karet poptávky — sdílí je Studio (výběr u možnosti v typu
// `briefStep`, lib/valecms.types.ts) a kresba (brief-icons.tsx). Bez Reactu,
// aby šel soubor načíst i na serveru a v seedu.

export const BRIEF_ICON_CHOICES = [
  { value: "auto", title: "Podle názvu (automaticky)" },
  { value: "firma", title: "Firma (budova)" },
  { value: "eshop", title: "E-shop (košík)" },
  { value: "startup", title: "Startup (raketa)" },
  { value: "agentura", title: "Agentura (lidé)" },
  { value: "osobni", title: "Osobní značka (člověk)" },
  { value: "banner", title: "Banner" },
  { value: "socialni", title: "Sociální sítě (bublina)" },
  { value: "vizualy", title: "Vizuály pro e-shop (taška)" },
  { value: "identita", title: "Vizuální identita (krystal)" },
  { value: "logo", title: "Logo a barvy (paleta)" },
  { value: "fotky", title: "Fotky (fotoaparát)" },
  { value: "texty", title: "Texty (písmeno)" },
  { value: "inspirace", title: "Inspirace (žárovka)" },
  { value: "nic", title: "Od nuly (prázdný rám)" },
  { value: "nejdriv", title: "Co nejdřív (blesk)" },
  { value: "tydny", title: "Týdny (kalendář)" },
  { value: "mesic", title: "Měsíc (kalendář s tečkami)" },
  { value: "nespecha", title: "Nespěchá (hrnek)" },
  { value: "nevim", title: "Nevím (otazník)" },
  { value: "penize", title: "Peníze (mince)" },
  { value: "hvezda", title: "Hvězda (obecná)" },
] as const;

export type BriefIconName = (typeof BRIEF_ICON_CHOICES)[number]["value"];
