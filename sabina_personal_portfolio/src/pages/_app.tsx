import "@/styles/globals.css";
import { useEffect, useState } from "react";
import type { AppProps } from "next/app";
import { Poppins, Caveat } from "next/font/google";
import Lenis from "lenis";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import ContactModal from "@/components/layout/contact-modal";
import ShaderBackground from "@/components/layout/shader-background";

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

export default function App({ Component, pageProps }: AppProps) {
  // Stav kontaktního modalu žije tady: otevírá ho tlačítko v hlavičce,
  // ale modal je její sourozenec, ne potomek.
  const [contactOpen, setContactOpen] = useState(false);

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
      <Header onContactClick={() => setContactOpen(true)} />
      <Component {...pageProps} />
      <Footer />
      <ContactModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
      />
    </div>
  );
}
