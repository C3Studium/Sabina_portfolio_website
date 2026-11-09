// Registr prvků, se kterými má kurzor (a další globální efekty) pracovat.
//
// Sekce si prvek zaregistrují pod klíčem, kurzor si ho pod týmž klíčem vyzvedne.
// Bez registru by si kurzor musel prvky hledat po DOMu (querySelector) nebo by
// každá sekce držela vlastní odkaz na kurzor — obojí je svázání na dálku.
//
// Prvek může k sobě přidat `rect()` — obdélník, na který se má kurzor nad ním
// „rozložit" (čtyři tečky do rohů). Bez něj platí box prvku. MeasureText tak
// kurzoru hlásí box písmene pod myší, ne celé slovo.
//
// Mapa žije v `useRef`, ne ve stavu: registrace prvku NESMÍ překreslit celou
// aplikaci. Kdo potřebuje reagovat na změnu, čte mapu uvnitř své smyčky
// nebo v efektu — kurzor přesně tak.

import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import type { ReactNode } from "react";

/** Obdélník v souřadnicích okna (clientX/clientY). */
export type SnapRect = { left: number; top: number; right: number; bottom: number };

export type RefTarget = {
  element: HTMLElement;
  /** Kam se má kurzor nad prvkem rozložit; `null` = zůstat jednou tečkou. */
  rect?: () => SnapRect | null;
  /** Okraj kolem boxu prvku v px (stejný, nebo zvlášť do stran a nahoru/dolů), když nemá vlastní `rect()`. */
  pad?: Pad;
  /** `false` = prvek je v registru jen k nalezení (umělá myš), kurzor webu se na něj nerozkládá. */
  snap?: boolean;
};

export type Pad = number | { x: number; y: number };

export type RegisterOptions = Pick<RefTarget, "rect" | "pad" | "snap">;

export type RefRegistry = {
  /** Uloží prvek pod klíčem; `null` ho zase odebere (React to volá při odmountování). */
  register: (key: string, element: HTMLElement | null, options?: RegisterOptions) => void;
  /** Prvek pod klíčem, nebo `null`, když zrovna není připojený. */
  get: (key: string) => HTMLElement | null;
  /** Všechny zaregistrované cíle. */
  entries: () => [string, RefTarget][];
  /** Nejvnitřnější zaregistrovaný cíl, který obsahuje daný uzel (typicky `event.target`). */
  hit: (node: Node | null) => RefTarget | null;
};

const RefContext = createContext<RefRegistry | null>(null);

export function RefProvider({ children }: { children: ReactNode }) {
  const map = useRef(new Map<string, RefTarget>());

  const register = useCallback<RefRegistry["register"]>((key, element, options) => {
    if (element) map.current.set(key, { element, rect: options?.rect, pad: options?.pad, snap: options?.snap });
    else map.current.delete(key);
  }, []);

  const get = useCallback((key: string) => map.current.get(key)?.element ?? null, []);
  const entries = useCallback(() => Array.from(map.current.entries()), []);

  const hit = useCallback((node: Node | null) => {
    if (!node) return null;
    let best: RefTarget | null = null;
    for (const target of map.current.values()) {
      if (target.snap === false || !target.element.contains(node)) continue;
      // Vnořené cíle: vyhrává ten uvnitř.
      if (!best || best.element.contains(target.element)) best = target;
    }
    return best;
  }, []);

  const value = useMemo(() => ({ register, get, entries, hit }), [register, get, entries, hit]);
  return <RefContext.Provider value={value}>{children}</RefContext.Provider>;
}

// Mimo poskytovatele vrací prázdný registr, ne chybu: komponenta na stránce bez
// něj (404, Studio) se má vykreslit a jen nic nenahlásit.
const EMPTY: RefRegistry = {
  register: () => {},
  get: () => null,
  entries: () => [],
  hit: () => null,
};

/** `const refs = useRefRegistry()` a pak `refs.get('hero.portrait')`. */
export function useRefRegistry(): RefRegistry {
  return useContext(RefContext) ?? EMPTY;
}

/**
 * Callback ref, který prvek zaregistruje pod klíčem:
 *
 *     const ref = useRegisterRef('hero.portrait')
 *     <div ref={ref} />
 *
 * Kurzor se nad takovým prvkem rozloží do rohů jeho boxu (s okrajem `pad`
 * px). Klíče drž ve tvaru `<sekce>.<prvek>`, aby se nepotkaly dvě sekce na
 * témže jméně.
 */
export function useRegisterRef(key: string, options?: { pad?: Pad }) {
  const { register } = useRefRegistry();
  // Rozložené na čísla, ať objekt `{ x, y }` z renderu neruší memo.
  const pad = options?.pad;
  const padX = typeof pad === "number" ? pad : pad?.x;
  const padY = typeof pad === "number" ? pad : pad?.y;
  return useCallback(
    (element: HTMLElement | null) =>
      register(key, element, {
        pad: padX === undefined || padY === undefined ? undefined : { x: padX, y: padY },
      }),
    [key, register, padX, padY],
  );
}
