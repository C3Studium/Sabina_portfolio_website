import type { Project } from "@/lib/site/projects";

// Šest projektů, jak stály v kódu před napojením na Studio — a stojí tu dál
// jako záloha: bez databáze (nebo s prázdnou) web vypadá stejně. Řadu karet
// i detaily z toho čte totéž, co by četlo z CMS, takže jde o jeden tvar.
//
// Značky jsou SKUTEČNÉ klientky z public/assets/banners — návrh má na kartách
// Sportisimo, Notino, About You, Billu a Samsung, což jsou cizí firmy a na
// portfoliu by tvrdily spolupráci, která neexistuje.
//
// `tone` řídí, jestli je karta tmavá nebo světlá — návrh je střídá.
// Rozměry obrázků jsou skutečné rozměry souborů, kvůli rezervaci místa.
//
// Texty musí zůstat doslova ty, co zakládá scripts/seed/projects.mjs.
const picture = (src: string, alt: string, width: number, height: number) => ({
  src,
  url: src,
  alt,
  width,
  height,
});

export const FALLBACK_PROJECTS: Project[] = [
  {
    slug: "gummylife",
    title: "Gummylife",
    tagline: "Bannerová kampaň",
    perex: "",
    body: "",
    bodyText: "",
    cover: picture(
      "/assets/banners/gummylife_banner1.png",
      "Bannerová kampaň pro doplňky stravy Gummylife",
      1440,
      2560,
    ),
    gallery: [],
    tone: "dark",
    order: 1,
  },
  {
    slug: "vecicky",
    title: "Věcicky",
    tagline: "Sezónní kampaň",
    perex: "",
    body: "",
    bodyText: "",
    cover: picture(
      "/assets/banners/vecicky_banner16.png",
      "Sezónní kampaň pro e-shop s dětskou módou Věcicky",
      1468,
      2587,
    ),
    gallery: [],
    tone: "light",
    order: 2,
  },
  {
    slug: "bruzek",
    title: "Bruzek",
    tagline: "Digitální kampaň",
    perex: "",
    body: "",
    bodyText: "",
    cover: picture(
      "/assets/banners/bruzek_banner1.png",
      "Digitální kampaň pro realitní značku Bruzek",
      973,
      1216,
    ),
    gallery: [],
    tone: "dark",
    order: 3,
  },
  {
    slug: "wooline",
    title: "Wooline",
    tagline: "Obsah pro e-shop",
    perex: "",
    body: "",
    bodyText: "",
    cover: picture(
      "/assets/banners/vlnenezbozi_banner3.png",
      "Vizuály pro e-shop s vlněnými ponožkami Wooline",
      1483,
      1853,
    ),
    gallery: [],
    tone: "light",
    order: 4,
  },
  {
    slug: "mistr-pet",
    title: "Mistr Pet",
    tagline: "Promo vizuály",
    perex: "",
    body: "",
    bodyText: "",
    cover: picture(
      "/assets/banners/mistrpet_banner1.png",
      "Promo vizuály pro chovatelské potřeby Mistr Pet",
      1118,
      1397,
    ),
    gallery: [],
    tone: "dark",
    order: 5,
  },
  {
    slug: "samurai",
    title: "Samurai",
    tagline: "Uvedení produktu",
    perex: "",
    body: "",
    bodyText: "",
    cover: picture(
      "/assets/banners/samurai_banner1.png",
      "Kampaň k uvedení nealkoholických nápojů Samurai",
      536,
      954,
    ),
    gallery: [],
    tone: "light",
    order: 6,
  },
];

/**
 * Co se má vykreslit: projekty z CMS, a když žádné nejsou, záloha z kódu.
 *
 * Prázdný seznam se bere jako „databáze nic nemá", ne jako „nic nezobrazuj":
 * web bez CMS má vypadat jako web s ním. Jakmile je v CMS byť jeden projekt,
 * vede on — záloha se nemíchá s obsahem, protože by karta z kódu tvrdila
 * projekt, který editor třeba schválně smazal.
 */
export const projectsOrFallback = (projects: Project[] | null | undefined): Project[] =>
  projects && projects.length ? projects : FALLBACK_PROJECTS;
