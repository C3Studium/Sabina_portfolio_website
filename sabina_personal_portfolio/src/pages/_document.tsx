import { Html, Head, Main, NextScript } from "next/document";
// Stiskne `data-preload="1"` do `<html>`: stránka je pod oponou schovaná od
// prvního snímku, dřív než se načte JavaScript. Preloader atribut sundá, až
// dojede; na editační ploše Studia ho sundá StudioMotionGuard.
import { preloadHtmlProps } from "@c3studium/valecms/motion";
// Volba pohybu návštěvníka (lib/motion-preference): skript musí běžet dřív
// než styly a skripty stránky, proto inline v <head>.
import { BOOT as MOTION_BOOT } from "@/lib/motion-preference";

// Jen tvar GTM-XXXXXXX: hodnota jde do adresy skriptu v <head>.
const GTM_ID = /^GTM-[A-Z0-9]{4,12}$/.test(process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "") ? process.env.NEXT_PUBLIC_GTM_ID!.trim() : "";

export default function Document() {
  return (
    <Html lang="cs" {...preloadHtmlProps()}>
      <Head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT }} />
        {/* Google Tag Manager hned v <head>, jak to Google chce (jinak jeho
            kontrola značku „nevidí"). Měření ale začíná až po souhlasu:
            Consent Mode v2 má výchozí stav „denied" dřív, než se kontejner
            načte — bez souhlasu žádné cookies; providers/Analytics pak po
            kliknutí v liště pošle „granted". ID z NEXT_PUBLIC_GTM_ID. */}
        {GTM_ID ? (
          <>
            <script
              dangerouslySetInnerHTML={{
                __html:
                  "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}" +
                  'gtag("consent","default",{ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",analytics_storage:"denied",functionality_storage:"granted",security_storage:"granted",wait_for_update:500});' +
                  'gtag("set","ads_data_redaction",true);gtag("js",new Date());',
              }}
            />
            <script async src={`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`} />
          </>
        ) : null}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
