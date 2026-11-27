// Otevření sekce úvodní stránky jako samostatného okna (popup) odkudkoli.
// Stav žije v _app.tsx (SectionPopups poslouchá tuhle událost); odkazy
// v hlavičce, menu a kontaktním modalu ho otevírají přes `openSection()`
// místo skoku na kotvu.
//
// Když sekce na aktuální stránce už je (úvodní stránka, nebo jiná stránka
// se stejnou sekcí), okno se neotevře — stránka na ni jen doscrolluje.
// Kotvy mají jen sekce na stránce; jejich kopie v okně id nenesou.
//
// Z hamburger menu na dotykovém zařízení (`fromMenu`): po zavření okna se
// menu otevře znovu (MENU_OPEN_EVENT — poslouchá hlavička).

import { CONTACT_CLOSE_EVENT } from "../contact-modal/open";

export type SectionKey = "references" | "services" | "process";

export const SECTION_OPEN_EVENT = "section:open";
/** Otevři znovu hamburger menu (layout/header). */
export const MENU_OPEN_EVENT = "menu:open";

/** Kotva sekce na stránce (id prvku). */
const ANCHORS: Record<SectionKey, string> = {
  // CTA s recenzemi — místo ve scrollu Procesu, kde dorazí výzva.
  references: "spoluprace",
  services: "sluzby",
  process: "proces",
};

// Okno sekce v DOMu (layout/section-popup: role="dialog" s data-section).
const POPUP = "[role='dialog'][data-section]";

/**
 * Kam v přišpendlené sekci doscrollovat: podíl její choreografie (0 = začátek
 * tracku, 1 = konec). Sekce ho může říct sama atributem `data-scroll-at`
 * (Služby: klidová chvíle po stavbě, z choreografie — info/index.tsx);
 * tohle je záloha. Dřív Služby natvrdo 0,9 — to už sekce mizela (mazání,
 * portrét odnesený do Procesu) a odkaz vypadal, že nefunguje; celá je
 * zhruba 0,49–0,62.
 * Počítá se v PIXELECH z výšky tracku a okna (ne ve vh ani %, ty se na
 * telefonu a monitoru liší): průběh `p` sekce (useScroll „start start" →
 * „end end") je scrollY = top + p × (výška − výška okna).
 */
const SECTION_AT: Partial<Record<SectionKey, number>> = {
  services: 0.5,
};

/** Cílový scrollY (px) pro sekci — její horní okraj, u přišpendlených podíl choreografie. */
function scrollTargetOf(target: HTMLElement, key: SectionKey): number {
  const rect = target.getBoundingClientRect();
  const top = rect.top + window.scrollY;
  const own = Number(target.dataset.scrollAt);
  const fraction = Number.isFinite(own) && own > 0 ? own : SECTION_AT[key] ?? 0;
  // Krátká sekce (telefon, zjednodušená verze) nemá co „přehrát" — jen okraj.
  const pinned = Math.max(0, rect.height - window.innerHeight);
  return Math.round(top + pinned * fraction);
}

/** Doscrolluje na sekci, je-li na stránce. Vrací, jestli tam byla. */
function scrollToSection(key: SectionKey) {
  const target = document.getElementById(ANCHORS[key]);
  if (!target) return false;
  // O snímek později: menu / modal, ze kterého se kliklo, se mezitím zavře
  // a pustí scroll stránky (force — Lenis by jinak zastavený příkaz zahodil).
  requestAnimationFrame(() => {
    const y = scrollTargetOf(target, key);
    const lenis = window.lenisInstance;
    if (lenis) lenis.scrollTo(y, { duration: 1.6, force: true });
    else window.scrollTo({ top: y, behavior: "smooth" });
  });
  return true;
}

/** Až se okno sekce objeví a po zavření zmizí, otevře znovu menu. */
function returnToMenuAfterPopup() {
  let seen = false;
  const observer = new MutationObserver(() => {
    const open = Boolean(document.querySelector(POPUP));
    if (open) seen = true;
    else if (seen) {
      observer.disconnect();
      window.dispatchEvent(new Event(MENU_OPEN_EVENT));
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  // Pojistka: okno se do pár vteřin neotevřelo — přestat hlídat.
  window.setTimeout(() => {
    if (!seen) observer.disconnect();
  }, 4000);
}

export function openSection(key: SectionKey, { fromMenu = false }: { fromMenu?: boolean } = {}) {
  // Hlavička stojí nad otevřeným kontaktním modalem — odkaz z ní ho zavře.
  window.dispatchEvent(new Event(CONTACT_CLOSE_EVENT));
  if (scrollToSection(key)) return;
  const touch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  if (fromMenu && touch) returnToMenuAfterPopup();
  window.dispatchEvent(new CustomEvent<SectionKey>(SECTION_OPEN_EVENT, { detail: key }));
}
