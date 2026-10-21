import { createElement, Fragment } from "react";

// Společný tvar toho, co sekcím úvodní stránky chodí z CMS (viz src/lib/cms/home.ts).

/** Jeden řádek dekódovaného textu: dvojice [text, zvýrazněno]. */
export type Run = [string, boolean];
export type MarkedLine = Run[];

/** Obrázek, jak ho tvaruje `f.image()` — `src` je povinné, rozměry nese knihovna médií. */
export type CmsImage = {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
};

/** Je v odpovědi vůbec co kreslit? Prázdný blok se dekóduje na jeden prázdný řádek. */
export const hasLines = (lines: unknown): lines is MarkedLine[] =>
  Array.isArray(lines) &&
  lines.some((parts) => Array.isArray(parts) && parts.length > 0);

/** Prázdný řetězec z CMS je „nic nenapsáno", ne hodnota — spadne na zálohu. */
export const text = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value : fallback;

/** Obrázek z CMS, nebo záloha z kódu. Rozměry se berou z CMS jen, když je nese. */
export const picture = (
  value: unknown,
  fallback: { src: string; alt: string; width: number; height: number },
) => {
  const own = value as CmsImage | null | undefined;
  if (!own?.src) return fallback;
  return {
    src: own.src,
    alt: typeof own.alt === "string" ? own.alt : fallback.alt,
    width: own.width ?? fallback.width,
    height: own.height ?? fallback.height,
  };
};

/** Galerie z CMS jako pole; `f.text('gallery')` odpovídá '' , když je prázdná. */
export const pictures = (value: unknown): CmsImage[] =>
  Array.isArray(value) ? value.filter((entry) => entry?.src) : [];

// Třída, kterou schéma deklaruje pro své jediné zvýraznění (HIGHLIGHT v balíčku).
// Překryv Studia podle ní pozná zvýrazněný úsek; vzhled dodává třída sekce
// (`markClass`), takže úsek nese obě — deklarovanou čte editor, vlastní je vidět.
const ACCENT = "hl";

// Koncová interpunkce, která v návrhu stojí mimo zvýraznění: „*výsledky*." má
// tečku bílou, „*ZNAČKU*," má čárku v barvě textu. Dekodér zvýrazňuje po
// slovech, takže by ji vtáhl dovnitř — tady se zase odděluje.
const TRAIL = /([.,;:!?…]+)$/;

type LinesProps = {
  lines: MarkedLine[];
  /** Třída sekce pro zvýrazněný úsek, vedle deklarované `hl`. */
  markClass?: string;
  /** Prvek zvýrazněného úseku — `strong` tam, kde návrh zvýrazňuje tučně. */
  markTag?: "span" | "strong";
  /**
   * Když je zadané (i prázdné), koncová interpunkce zvýrazněného úseku se
   * vykreslí mimo něj, s touhle třídou. Nezadané = zůstává uvnitř.
   */
  trailClass?: string;
};

/**
 * Uložený text s natvrdo zalomenými řádky, nakreslený tak, jak ho kreslil JSX
 * literál: jeden <br /> mezi řádky, jedna mezera mezi úseky, ŽÁDNÝ obal —
 * anotace jde na prvek, který tohle drží. Co se vrátí, musí být znak po znaku
 * to, co dával literál; překryv to čte zpátky z DOMu.
 */
export default function Lines({ lines, markClass, markTag = "span", trailClass }: LinesProps) {
  const accent = [ACCENT, markClass].filter(Boolean).join(" ");

  return lines.map((parts, line) => (
    <Fragment key={line}>
      {line > 0 ? <br /> : null}
      {parts.map(([run, marked], index) => {
        // Oddělovač jede na úseku před sebou: řádek bez zvýraznění je JEDEN
        // textový uzel, jako v literálu.
        const tail = index < parts.length - 1 ? " " : "";
        if (!marked) return <Fragment key={index}>{run + tail}</Fragment>;

        const split = trailClass !== undefined ? run.match(TRAIL) : null;
        const word = split ? run.slice(0, -split[1].length) : run;
        return (
          <Fragment key={index}>
            {createElement(markTag, { className: accent }, word)}
            {split ? (
              trailClass ? <span className={trailClass}>{split[1]}</span> : split[1]
            ) : null}
            {tail}
          </Fragment>
        );
      })}
    </Fragment>
  ));
}
