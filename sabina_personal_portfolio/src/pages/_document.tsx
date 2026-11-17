import { Html, Head, Main, NextScript } from "next/document";
// Stiskne `data-preload="1"` do `<html>`: stránka je pod oponou schovaná od
// prvního snímku, dřív než se načte JavaScript. Preloader atribut sundá, až
// dojede; na editační ploše Studia ho sundá StudioMotionGuard.
import { preloadHtmlProps } from "@c3studium/valecms/motion";
// Volba pohybu návštěvníka (lib/motion-preference): skript musí běžet dřív
// než styly a skripty stránky, proto inline v <head>.
import { BOOT as MOTION_BOOT } from "@/lib/motion-preference";

// Značka Google (kontejner GTM) — natvrdo, ať nezávisí na proměnné ve
// Vercelu; NEXT_PUBLIC_GTM_ID ji jen může přepsat (jen tvar GTM-XXXXXXX).
const GTM_ID = /^GTM-[A-Z0-9]{4,12}$/.test(process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "") ? process.env.NEXT_PUBLIC_GTM_ID!.trim() : "GTM-PV9DWBCM";

export default function Document() {
  return (
    <Html lang="cs" {...preloadHtmlProps()}>
      <Head>
        {/* Značka Google, doslova jak ji Google vydává („hned za prvek <head>"):
            skript kontejneru a pak dataLayer + gtag('js'). Jediný přídavek je
            Consent Mode v2 před gtag('js'): výchozí stav „denied", takže bez
            souhlasu žádné cookies; providers/Analytics po kliknutí v liště
            pošle „granted". */}
        <script async src={`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`} />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n" +
              "  gtag('consent', 'default', {ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});\n" +
              "  gtag('set', 'ads_data_redaction', true);\n  gtag('js', new Date());\n",
          }}
        />
        {/* Ahrefs Web Analytics — bez cookies, proto bez souhlasu, v <head>. */}
        <script src="https://analytics.ahrefs.com/analytics.js" data-key="8oIyju58qgpQTaDnZqUDQw" async />
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
