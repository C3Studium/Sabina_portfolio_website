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

// Sekce úvodní stránky v pořadí, jak jdou pod sebou: kotva → položka menu.
const HOME_SECTIONS: [string, SectionKey][] = [
  ["sluzby", "services"],
  ["proces", "process"],
  ["spoluprace", "references"],
];

/**
 * Index položky, na které návštěvník je: stránka, nebo sekce úvodní stránky
 * ve výhledu (horní hrana sekce nad polovinou okna). Čte ho menu („Jste
 * tady") i hlavička (aktivní odkaz má rámeček jako při najetí).
 */
export function currentNavIndex(pathname: string) {
  const byHref = NAV_ITEMS.findIndex((item) => !item.popup && item.href !== "/" && pathname.startsWith(item.href));
  if (byHref >= 0) return byHref;
  if (pathname !== "/" || typeof document === "undefined") return -1;
  let key: SectionKey | null = null;
  for (const [id, section] of HOME_SECTIONS) {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.5) key = section;
  }
  return key ? NAV_ITEMS.findIndex((item) => item.popup === key) : -1;
}
