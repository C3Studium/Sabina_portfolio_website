// SEO stránky: titulek, popis, kanonická adresa a náhled pro sdílení
// (Open Graph — Facebook, LinkedIn, Messenger, WhatsApp; Twitter / X karta).
// Instagram náhledy z odkazů nečte — v bio / stories se ukáže jen adresa.
//
// Absolutní adresy (kanonická, og:url, og:image) staví z NEXT_PUBLIC_SITE_URL
// — na produkci musí být skutečná doména, jinak sítě obrázek nenajdou.
//
// Společné značky (ikony, manifest, barva, jméno webu) jsou v <SiteHead />
// v _app; stránka dává jen <Seo … />.

import Head from "next/head";
import { useRouter } from "next/router";

export const SITE = {
  name: "Sabina Hudrmentová",
  role: "Grafická designérka",
  description:
    "Grafická designérka Sabina Hudrmentová — reklamní bannery, kampaně a vizuály pro e-shopy, které zaujmou a prodávají.",
  image: { src: "/og-image.jpg", width: 1200, height: 630, alt: "Sabina Hudrmentová — grafika pro lepší výsledky" },
  locale: "cs_CZ",
  themeColor: "#262626",
};

/** Kořen webu bez lomítka na konci; prázdný = jen relativní adresy. */
export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");

const absolute = (path: string) => (/^https?:\/\//.test(path) ? path : `${siteUrl()}${path.startsWith("/") ? "" : "/"}${path}`);

type SeoProps = {
  /** Celý titulek (bez přípony); `null` = jen jméno webu. */
  title?: string | null;
  description?: string;
  /** Obrázek náhledu (adresa); bez něj společný og-image. */
  image?: { src: string; width?: number; height?: number; alt?: string } | null;
  /** `article` u případových studií, jinak `website`. */
  type?: "website" | "article" | "profile";
  /** Nezařazovat do vyhledávačů (šablony, testovací stránky). */
  noindex?: boolean;
  /** Strukturovaná data (JSON-LD), např. Person na úvodní stránce. */
  jsonLd?: Record<string, unknown> | null;
};

export default function Seo({ title = null, description = SITE.description, image = null, type = "website", noindex = false, jsonLd = null }: SeoProps) {
  const { asPath } = useRouter();
  const path = asPath.split(/[?#]/)[0] || "/";
  const fullTitle = title ? `${title} | ${SITE.name}` : `${SITE.name} — ${SITE.role}`;
  const img = image ?? SITE.image;
  const imgUrl = absolute(img.src);
  const url = absolute(path);
  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} key="description" />
      {siteUrl() ? <link rel="canonical" href={url} key="canonical" /> : null}
      {noindex ? <meta name="robots" content="noindex, follow" key="robots" /> : null}

      <meta property="og:type" content={type} key="og:type" />
      <meta property="og:title" content={fullTitle} key="og:title" />
      <meta property="og:description" content={description} key="og:description" />
      {siteUrl() ? <meta property="og:url" content={url} key="og:url" /> : null}
      <meta property="og:image" content={imgUrl} key="og:image" />
      {img.width ? <meta property="og:image:width" content={String(img.width)} key="og:image:width" /> : null}
      {img.height ? <meta property="og:image:height" content={String(img.height)} key="og:image:height" /> : null}
      <meta property="og:image:alt" content={img.alt || fullTitle} key="og:image:alt" />

      <meta name="twitter:card" content="summary_large_image" key="twitter:card" />
      <meta name="twitter:title" content={fullTitle} key="twitter:title" />
      <meta name="twitter:description" content={description} key="twitter:description" />
      <meta name="twitter:image" content={imgUrl} key="twitter:image" />
      <meta name="twitter:image:alt" content={img.alt || fullTitle} key="twitter:image:alt" />

      {jsonLd ? <script type="application/ld+json" key="jsonld" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
    </Head>
  );
}

/** Společné značky všech stránek (v _app). */
export function SiteHead() {
  return (
    <Head>
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" key="viewport" />
      <link rel="icon" href="/favicon.ico" sizes="48x48" key="icon-ico" />
      <link rel="icon" type="image/png" sizes="32x32" href="/icon.png" key="icon-png" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" key="apple-touch-icon" />
      <link rel="manifest" href="/site.webmanifest" key="manifest" />
      <meta name="theme-color" content={SITE.themeColor} key="theme-color" />
      <meta name="author" content={SITE.name} key="author" />
      <meta property="og:site_name" content={SITE.name} key="og:site_name" />
      <meta property="og:locale" content={SITE.locale} key="og:locale" />
    </Head>
  );
}

/** Osoba pro vyhledávače (úvodní stránka). */
export const personJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "Person",
  name: SITE.name,
  jobTitle: SITE.role,
  description: SITE.description,
  ...(siteUrl() ? { url: siteUrl(), image: absolute(SITE.image.src) } : {}),
  knowsAbout: ["Grafický design", "Reklamní bannery", "Online kampaně", "Vizuální komunikace"],
});
