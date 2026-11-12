import "@/styles/globals.scss";
import { useEffect, useState } from "react";
import type { AppProps } from "next/app";
import { Poppins, Caveat } from "next/font/google";
import Lenis from "lenis";
import Header from "@/components/layout/header";
import { SeoProvider, SiteHead } from "@/components/seo";
import Footer from "@/components/layout/footer";
import ContactModal from "@/components/layout/contact-modal";
import SectionPopups from "@/components/layout/section-popup";
import type { HomeContent } from "@/lib/site/home-content";
import { CONTACT_CLOSE_EVENT, CONTACT_OPEN_EVENT } from "@/components/layout/contact-modal/open";
import ShaderBackground from "@/components/layout/shader-background";
import Cursor from "@/components/common/cursor";
import Scrollbar from "@/components/common/scrollbar";
import { withStudio } from "@c3studium/valecms";
import type { GlobalCopy } from "@/lib/site/globals";
import { isScenePage } from "@/lib/scene-pages";
import Preloader from "@/motion/Preloader";
import PageTransition from "@/motion/PageTransition";
import CookieBanner from "@/providers/CookieBanner";
import { Toaster } from "sonner";
import { CookiesProvider } from "@/providers/CookiesProvider";
import { PerformanceProvider } from "@/providers/PerformanceProvider";
import { LoadProvider } from "@/motion/LoadProvider";
import { RefProvider } from "@/providers/RefContext";

// latin-ext je nutný kvůli české diakritice (ě, š, ž, í, ý, ú).
const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["200", "300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

// Ručně psané anotace v sekci Process.
const caveat = Caveat({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-caveat",
  display: "swap",
});

declare global {
  interface Window {
    // POZOR: `window.lenis` nepoužívat — od Lenisu 1.3 si ho knihovna
    // zabírá sama (`window.lenis = {}`) jako interní registr featur
    // (horizontal, snap, touch, version). Přepsat ho instancí by tu
    // detekci rozbilo, proto instance žije pod vlastním klíčem.
    lenisInstance?: Lenis;
  }
}

// Texty hlavičky, patičky a modálu cestují na propech KAŽDÉ stránky
// (`getGlobalCopy` v jejím getStaticProps → `props.globals`), protože `_app`
// vlastní načítání nemá: `App.getInitialProps` by celý web odhlásil ze
// statické generace. Stránka bez getStaticProps (404) nepředá nic a komponenty
// sáhnou po záloze z kódu.
type GlobalPageProps = { globals?: GlobalCopy | null };

function App({ Component, pageProps, router }: AppProps) {
  const scenePage = isScenePage(router.pathname);
  // Stav kontaktního modalu žije tady: otevírá ho tlačítko v hlavičce,
  // ale modal je její sourozenec, ne potomek.
  const [contactOpen, setContactOpen] = useState(false);
  const globals = (pageProps as GlobalPageProps).globals ?? null;

  // Ostatní výzvy (CTA na homepage) modal otevírají událostí — openContact().
  useEffect(() => {
    const open = () => setContactOpen(true);
    window.addEventListener(CONTACT_OPEN_EVENT, open);
    return () => window.removeEventListener(CONTACT_OPEN_EVENT, open);
  }, []);

  // Hlavička zůstává nad otevřeným modalem — odkaz z ní (jiná stránka nebo
  // okno sekce) modal zavře.
  useEffect(() => {
    const close = () => setContactOpen(false);
    router.events.on("routeChangeStart", close);
    window.addEventListener(CONTACT_CLOSE_EVENT, close);
    return () => {
      router.events.off("routeChangeStart", close);
      window.removeEventListener(CONTACT_CLOSE_EVENT, close);
    };
  }, [router.events]);

  // Proměnné písem i na <html>: opona a závoj (chrome z withStudio) stojí
  // MIMO obal níž, takže by `--font-poppins` nezdědily a padly na serif.
  // Až v efektu, protože `<html>` server nevykresluje a na obalu zůstávají
  // třídy kvůli prvnímu snímku stránky.
  useEffect(() => {
    const classes = [poppins.variable, caveat.variable, poppins.className];
    document.documentElement.classList.add(...classes);
    return () => document.documentElement.classList.remove(...classes);
  }, []);

  useEffect(() => {
    // Initialize Lenis for smooth scrolling
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      lerp: 0.8,
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1,
      autoRaf: false,
    });

    window.lenisInstance = lenis;

    // Během preloaderu (`html[data-preload]`) se nescrolluje. Engine opony
    // Lenis zastaví sám, ale jen instanci, kterou najde při startu — ve
    // vývoji StrictMode tenhle efekt pustí dvakrát a druhá instance by
    // jela. Proto si to hlídá každá instance sama: stojí, dokud atribut
    // nezmizí. (`overflow: hidden` z opony Lenisu nebrání — scrolluje
    // programově.)
    const html = document.documentElement;
    let preloadWatch: MutationObserver | null = null;
    if (html.getAttribute("data-preload") === "1") {
      lenis.stop();
      preloadWatch = new MutationObserver(() => {
        if (html.getAttribute("data-preload") === "1") return;
        preloadWatch?.disconnect();
        lenis.start();
      });
      preloadWatch.observe(html, { attributes: true, attributeFilter: ["data-preload"] });
    }

    // rAF handle si držíme, aby smyčka šla při odmountování zastavit —
    // jinak by běžela dál a sahala na už zničenou instanci.
    let rafId = 0;

    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      preloadWatch?.disconnect();
      lenis.destroy();
      if (window.lenisInstance === lenis) {
        window.lenisInstance = undefined;
      }
    };
  }, []);

  return (
    <SeoProvider seo={(pageProps as { globals?: GlobalCopy }).globals?.seo}>
    <div className={`${poppins.variable} ${caveat.variable} ${poppins.className}`}>
      <SiteHead />
      <ShaderBackground />
      {/* Tečka za myší. Jen pro jemný ukazatel; na dotyku se nespustí. */}
      <Cursor />
      <Header
        onContactClick={() => setContactOpen(true)}
        onContactClose={() => setContactOpen(false)}
        contactOpen={contactOpen}
        copy={globals?.header}
      />
      <Component {...pageProps} />
      {/* Stránka se scénou (/projects) je jedna obrazovka — bez posuvníku
          a patičky (lib/scene-pages). */}
      {scenePage ? null : (
        <>
          {/* Posuvník stránky (lišta čárek vpravo) — jen pro myš. */}
          <Scrollbar />
          <Footer copy={globals?.footer} socials={globals?.socials ?? null} />
        </>
      )}
      {/* Reference / Služby / Spolupráce z hlavičky jako samostatná okna.
          Obsah úvodní stránky z pageProps jen na ní (jiné stránky mají pod
          `content` svůj); jinde si ho okno načte z /api/home-content. */}
      <SectionPopups
        content={router.pathname === "/" ? ((pageProps as { content?: HomeContent }).content ?? null) : null}
      />
      <ContactModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        copy={globals?.contact}
      />
    </div>
    </SeoProvider>
  );
}

export default withStudio(App, { chrome: [Preloader, PageTransition, CookieBanner, Toaster], providers: [CookiesProvider, PerformanceProvider, LoadProvider, RefProvider] })
