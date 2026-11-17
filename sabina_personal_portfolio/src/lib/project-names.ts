// Jména projektů pro přechod stránek: závoj (motion/PageTransition) zná
// jen cílovou cestu `/projects/<slug>` a slug je bez diakritiky. Kdo
// projekty vykresluje (scéna Portfolio, karusel hera), si jejich jména
// zapíše sem a přechod pak ukáže „Věcičky" místo obecného „Případová studie".
// Jen paměť stránky — po plném načtení začíná prázdná, závoj má zálohu.

const names = new Map<string, string>();

const slugOf = (path: string) => path.match(/^\/projects\/([^/?#]+)/)?.[1] ?? null;

/** Zapamatuje jméno projektu k jeho odkazu (`/projects/<slug>`). */
export const rememberProjectName = (href: string | null | undefined, title: string | null | undefined) => {
  const slug = href ? slugOf(href) : null;
  const name = title?.trim();
  if (slug && name) names.set(slug, name);
};

/** Jméno projektu pro cestu, nebo null, když ho stránka ještě neviděla. */
export const projectNameFor = (path: string): string | null => {
  const slug = slugOf(path);
  return slug ? (names.get(slug) ?? null) : null;
};
