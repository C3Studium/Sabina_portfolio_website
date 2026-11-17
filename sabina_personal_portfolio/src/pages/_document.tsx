import { Html, Head, Main, NextScript } from "next/document";
// Stiskne `data-preload="1"` do `<html>`: stránka je pod oponou schovaná od
// prvního snímku, dřív než se načte JavaScript. Preloader atribut sundá, až
// dojede; na editační ploše Studia ho sundá StudioMotionGuard.
import { preloadHtmlProps } from "@c3studium/valecms/motion";
// Volba pohybu návštěvníka (lib/motion-preference): skript musí běžet dřív
// než styly a skripty stránky, proto inline v <head>.
import { BOOT as MOTION_BOOT } from "@/lib/motion-preference";

export default function Document() {
  return (
    <Html lang="cs" {...preloadHtmlProps()}>
      <Head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
