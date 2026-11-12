import type { SectionKey } from "./section-popup/open";

// Položky hlavní navigace. Sdílené, protože je vykresluje hlavička
// i horní lišta kontaktního modalu — dvě kopie by se rozešly.
//
// `popup`: odkaz neskočí na místo, ale otevře sekci úvodní stránky jako
// samostatné okno (layout/section-popup). `href` zůstává jako záloha bez
// JavaScriptu a pro otevření v nové kartě.
export const NAV_ITEMS: { label: string; href: string; popup?: SectionKey }[] = [
  { label: "Portfolio", href: "/projects" },
  { label: "Reference", href: "/#spoluprace", popup: "references" },
  { label: "O mně", href: "/about" },
  { label: "Služby", href: "/#sluzby", popup: "services" },
  { label: "Spolupráce", href: "/#proces", popup: "process" },
];
