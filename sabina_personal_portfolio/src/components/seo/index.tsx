// SEO stránky nad knihovnou (@c3studium/valecms/seo, 0.1.56).
//
// Hodnoty webu (jméno, výchozí popis, náhled, ikony) jsou ve Studiu —
// dokument „SEO a ikony" — a cestují v `pageProps.globals.seo`; bez něj
// platí SEO_FALLBACK (src/lib/seo.ts). _app je dá do kontextu a vykreslí
// <SiteHead />; stránka dává jen <Seo … />.
//
// Instagram náhledy z odkazů nečte — v bio / stories se ukáže jen adresa.

import { createContext, useContext, type ReactNode } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { SeoHead, SiteIcons, envSiteUrl } from "@c3studium/valecms/seo";
import type { PageSeo, SiteSeo } from "@c3studium/valecms/server/site";
import { SEO_FALLBACK } from "@/lib/seo";

const SeoContext = createContext<SiteSeo>(SEO_FALLBACK);

/** Kořen webu bez lomítka na konci; prázdný = jen relativní adresy. */
export const siteUrl = () => envSiteUrl();

export function SeoProvider({ seo, children }: { seo: SiteSeo | null | undefined; children: ReactNode }) {
  return <SeoContext.Provider value={seo ?? SEO_FALLBACK}>{children}</SeoContext.Provider>;
}

export const useSiteSeo = () => useContext(SeoContext);

type SeoProps = {
  /** Titulek stránky (bez jména webu); `null` = „Jméno — podtitul". */
  title?: string | null;
  description?: string;
  image?: { src: string; width?: number | null; height?: number | null; alt?: string } | null;
  /** Přepis z dokumentu (pole `seo` ve Studiu) — má přednost. */
  page?: PageSeo | null;
  type?: "website" | "article" | "profile";
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | null;
};

export default function Seo({ title = null, description = "", image = null, page = null, type = "website", noindex = false, jsonLd = null }: SeoProps) {
  const site = useSiteSeo();
  const { asPath } = useRouter();
  const path = asPath.split(/[?#]/)[0] || "/";
  const img = image ? { src: image.src, width: image.width ?? null, height: image.height ?? null, alt: image.alt ?? "" } : null;
  return <SeoHead site={site} title={title} description={description} image={img} page={page} path={path} type={type} noindex={noindex} jsonLd={jsonLd} />;
}

/** Společné značky všech stránek (v _app): ikony ze Studia + soubory z /public. */
export function SiteHead() {
  const site = useSiteSeo();
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" key="viewport" />
        <link rel="icon" href="/favicon.ico" sizes="48x48" key="icon-ico" />
        <meta name="author" content={site.siteName} key="author" />
      </Head>
      <SiteIcons site={site} manifest="/site.webmanifest" />
    </>
  );
}

/** Osoba pro vyhledávače (úvodní stránka). */
export const personJsonLd = (site: SiteSeo) => {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: site.siteName,
    jobTitle: site.tagline,
    description: site.description,
    ...(base ? { url: base, ...(site.shareImage ? { image: /^https?:/.test(site.shareImage.src) ? site.shareImage.src : base + site.shareImage.src } : {}) } : {}),
    knowsAbout: ["Grafický design", "Reklamní bannery", "Online kampaně", "Vizuální komunikace"],
  };
};
