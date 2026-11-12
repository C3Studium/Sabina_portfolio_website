import type { Project } from "@/lib/site/projects";

// Záloha nemá vlastní SEO — stránka vezme název a výchozí hodnoty webu.
const NO_SEO = { title: "", description: "", image: null, noindex: false };
import { STUDY_TEMPLATE } from "@/components/study/content";
import { STUDY_JORDAN, STUDY_VIKIO, STUDY_VLNENE_ZBOZI } from "@/components/study/studies";

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
    goals: [],
    shared: [],
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
    featured: true,
    cardCta: "Zjistit víc",
    study: null,
    seo: NO_SEO,
  },
  {
    slug: "vecicky",
    title: "Věcičky",
    tagline: "Sezónní kampaň",
    perex: "",
    goals: [],
    shared: [],
    body: "",
    bodyText: "",
    cover: picture(
      "/assets/banners/vecicky_banner16.png",
      "Sezónní kampaň pro e-shop s dětskou módou Věcičky",
      1468,
      2587,
    ),
    gallery: [],
    tone: "light",
    order: 2,
    featured: true,
    cardCta: "Zjistit víc",
    // Případová studie Věciček — záloha bez databáze (ve Studiu záložka „Případová studie").
    study: STUDY_TEMPLATE,
    seo: NO_SEO,
  },
  {
    slug: "bruzek",
    title: "Bruzek",
    tagline: "Digitální kampaň",
    perex: "",
    goals: [],
    shared: [],
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
    featured: true,
    cardCta: "Zjistit víc",
    study: null,
    seo: NO_SEO,
  },
  {
    slug: "wooline",
    title: "Wooline",
    tagline: "Obsah pro e-shop",
    perex: "",
    goals: [],
    shared: [],
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
    featured: false,
    cardCta: "",
    study: null,
    seo: NO_SEO,
  },
  {
    slug: "mistr-pet",
    title: "Mistr Pet",
    tagline: "Promo vizuály",
    perex: "",
    goals: [],
    shared: [],
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
    featured: false,
    cardCta: "",
    study: null,
    seo: NO_SEO,
  },
  {
    slug: "samurai",
    title: "Samurai",
    tagline: "Uvedení produktu",
    perex: "",
    goals: [],
    shared: [],
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
    featured: true,
    cardCta: "Chci vědět víc",
    study: null,
    seo: NO_SEO,
  },
  // Další případové studie — jen v záloze (a ve Studiu po scripts/cms-studies.mjs).
  {
    slug: "vlnene-zbozi",
    title: "Vlněné zboží",
    tagline: "Reklamní bannery",
    perex: "",
    goals: [],
    shared: [],
    body: "",
    bodyText: "",
    cover: picture("/assets/banners/vlnenezbozi_banner2.png", "Reklamní bannery pro e-shop s výrobky z ovčí vlny Vlněné zboží", 1080, 1350),
    gallery: [],
    tone: "dark",
    order: 7,
    featured: false,
    cardCta: "",
    study: STUDY_VLNENE_ZBOZI,
    seo: NO_SEO,
  },
  {
    slug: "vikio",
    title: "VIKIO",
    tagline: "Reklamní bannery",
    perex: "",
    goals: [],
    shared: [],
    body: "",
    bodyText: "",
    cover: picture("/assets/banners/vikio_banner8.png", "Reklamní bannery pro e-shop s nábytkem VIKIO", 1055, 1876),
    gallery: [],
    tone: "light",
    order: 8,
    featured: false,
    cardCta: "",
    study: STUDY_VIKIO,
    seo: NO_SEO,
  },
  {
    slug: "jordan",
    title: "Jordan",
    tagline: "Reklamní bannery",
    perex: "",
    goals: [],
    shared: [],
    body: "",
    bodyText: "",
    cover: picture("/assets/banners/jordan_banner3.png", "Reklamní vizuály pro čokoládovnu Jordan", 205, 256),
    gallery: [],
    tone: "dark",
    order: 9,
    featured: false,
    cardCta: "",
    study: STUDY_JORDAN,
    seo: NO_SEO,
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
