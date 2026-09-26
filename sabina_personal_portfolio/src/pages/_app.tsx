import "@/styles/globals.scss";
import { useEffect, useState } from "react";
import type { AppProps } from "next/app";
import { Poppins, Caveat } from "next/font/google";
import Lenis from "lenis";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import ContactModal from "@/components/layout/contact-modal";
import ShaderBackground from "@/components/layout/shader-background";
import { withStudio } from "@c3studium/valecms";
import type { GlobalCopy } from "@/lib/site/globals";
import Preloader from "@/motion/Preloader";
import PageTransition from "@/motion/PageTransition";
import CookieBanner from "@/providers/CookieBanner";
import { Toaster } from "sonner";
import { CookiesProvider } from "@/providers/CookiesProvider";
import { PerformanceProvider } from "@/providers/PerformanceProvider";
import { LoadProvider } from "@/motion/LoadProvider";

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

function App({ Component, pageProps }: AppProps) {
  // Stav kontaktního modalu žije tady: otevírá ho tlačítko v hlavičce,
  // ale modal je její sourozenec, ne potomek.
  const [contactOpen, setContactOpen] = useState(false);
  const globals = (pageProps as GlobalPageProps).globals ?? null;

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
      lenis.destroy();
      if (window.lenisInstance === lenis) {
        window.lenisInstance = undefined;
      }
    };
  }, []);

  return (
    <div className={`${poppins.variable} ${caveat.variable} ${poppins.className}`}>
      <ShaderBackground />
      <Header onContactClick={() => setContactOpen(true)} copy={globals?.header} />
      <Component {...pageProps} />
      <Footer copy={globals?.footer} />
      <ContactModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        copy={globals?.contact}
      />
    </div>
  );
}

export default withStudio(App, { chrome: [Preloader, PageTransition, CookieBanner, Toaster], providers: [CookiesProvider, PerformanceProvider, LoadProvider] })
