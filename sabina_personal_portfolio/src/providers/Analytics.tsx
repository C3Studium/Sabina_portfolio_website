// Google Tag Manager (GA4 je uvnitř kontejneru) — načte se až po souhlasu
// s analytickými cookies z lišty (CookiesProvider, kategorie `analytics`).
// Bez souhlasu neodejde na Google ani jeden požadavek: lišta slibuje „bez
// souhlasu zůstanou jen ty nezbytné" a tohle je to, co ten slib drží.
//
// Režim souhlasu (Consent Mode v2): před načtením kontejneru se zapíší
// výchozí hodnoty „denied", po souhlasu „granted" pro měření; reklamní
// souhlas sleduje kategorii `marketing`. Změna volby v liště se promítne
// hned (update), odvolání souhlasu platí od dalšího načtení (skript už
// v okně je — kontejner se nedá „odnačíst").
//
// ID kontejneru z prostředí: NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX. Bez něj se
// nevykreslí nic. V editačním rámu Studia se neměří (návštěvy redaktora).

import { useEffect } from "react";
import Script from "next/script";
import { useCookies } from "@/providers/CookiesProvider";
import { inStudio } from "@/lib/editing";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID?.trim() || "";

type ConsentState = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

const consentOf = (allowed: boolean): ConsentState => (allowed ? "granted" : "denied");

function push(...args: unknown[]) {
  window.dataLayer = window.dataLayer || [];
  // gtag() musí předat `arguments`, ne pole — GTM čte objekt Arguments.
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
  void args;
}

export default function Analytics() {
  const { ready, allows } = useCookies();
  const analytics = ready && allows("analytics");
  const marketing = ready && allows("marketing");
  const editing = inStudio();
  const load = Boolean(GTM_ID) && analytics && !editing;

  // Výchozí stav souhlasu jednou, dřív než kontejner (skript je `afterInteractive`,
  // efekt běží před ním). Pak každá změna volby jako update.
  useEffect(() => {
    if (!GTM_ID || !ready) return;
    push("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      functionality_storage: "granted",
      security_storage: "granted",
      wait_for_update: 500,
    });
  }, [ready]);

  useEffect(() => {
    if (!GTM_ID || !ready) return;
    push("consent", "update", {
      analytics_storage: consentOf(analytics),
      ad_storage: consentOf(marketing),
      ad_user_data: consentOf(marketing),
      ad_personalization: consentOf(marketing),
    });
  }, [ready, analytics, marketing]);

  if (!load) return null;
  return (
    <>
      <Script id="gtm-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];window.dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});`}
      </Script>
      <Script id="gtm" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`} />
    </>
  );
}
