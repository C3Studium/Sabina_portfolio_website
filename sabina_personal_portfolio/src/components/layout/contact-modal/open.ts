// Otevření kontaktního modalu odkudkoli na stránce. Stav modalu žije
// v _app.tsx (poslouchá tuhle událost); tlačítko v hlavičce ho otevírá
// přímo, ostatní výzvy (CTA) přes `openContact()`.

export const CONTACT_OPEN_EVENT = "contact:open";

export function openContact() {
  window.dispatchEvent(new Event(CONTACT_OPEN_EVENT));
}

/** Zavři modal (odkaz v hlavičce nad ním — sekce, jiná stránka). */
export const CONTACT_CLOSE_EVENT = "contact:close";
