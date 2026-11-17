// Souhlas pro Google Tag Manager (Consent Mode v2).
//
// Kontejner GTM (GA4 uvnitř) se načítá v <head> (_document) — Google jinak
// značku na webu „nevidí". Před jeho načtením tam stojí výchozí stav
// souhlasu „denied": bez souhlasu nevzniknou žádné měřicí cookies. Tahle
// komponenta po rozhodnutí v liště cookies (CookiesProvider) pošle update:
// měření podle kategorie `analytics`, reklamní signály podle `marketing`.
// Odvolání souhlasu se promítne hned (update na „denied"); cookies, které
// GA stihlo zapsat, se smažou.
//
// V editačním rámu Studia se neměří (návštěvy redaktora): GA se vypne
// přepínačem `ga-disable-<ID>` na všechna měřicí ID v kontejneru nejde
// sáhnout, proto se tam souhlas nikdy neudělí.

import { useEffect } from "react";
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

function consentUpdate(state: Record<string, ConsentState>) {
  window.dataLayer = window.dataLayer || [];
  // gtag() musí předat objekt `arguments`, ne pole — GTM čte jen ten.
  const gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  } as (...args: unknown[]) => void;
  gtag("consent", "update", state);
}

function clearAnalyticsCookies() {
  const names = document.cookie
    .split(";")
    .map((c) => c.split("=")[0]?.trim())
    .filter((n): n is string => Boolean(n) && (/^_ga/.test(n) || n === "_gid" || /^_gat/.test(n)));
  if (!names.length) return;
  const host = window.location.hostname;
  const parent = host.split(".").slice(-2).join(".");
  for (const name of names) {
    for (const domain of ["", host, `.${parent}`]) {
      document.cookie = `${name}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}`;
    }
  }
}

export default function Analytics() {
  const { ready, allows } = useCookies();
  const editing = inStudio();
  const analytics = ready && !editing && allows("analytics");
  const marketing = ready && !editing && allows("marketing");

  useEffect(() => {
    if (!GTM_ID || !ready) return;
    consentUpdate({
      analytics_storage: consentOf(analytics),
      ad_storage: consentOf(marketing),
      ad_user_data: consentOf(marketing),
      ad_personalization: consentOf(marketing),
    });
    if (!analytics) clearAnalyticsCookies();
  }, [ready, analytics, marketing]);

  return null;
}
