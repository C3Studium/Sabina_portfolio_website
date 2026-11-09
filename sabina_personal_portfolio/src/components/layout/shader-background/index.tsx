import dynamic from "next/dynamic";
import { usePerformance } from "@/providers/PerformanceProvider";
import styles from "./styles.module.scss";

// WebGL terén sahá na canvas a devicePixelRatio, takže se nesmí
// renderovat na serveru.
const Landscape = dynamic(() => import("@/components/common/landscape"), {
  ssr: false,
});

// Podklad celého webu. Všechny propy jsou vypsané schválně — i ty, které
// zůstávají na výchozí hodnotě. Jinak se ladí naslepo proti výchozím
// hodnotám schovaným v komponentě.
export default function ShaderBackground() {
  // Raymarching přes celou obrazovku je nejdražší věc na webu a běží na
  // každé stránce. Na slabém stroji, pomalé lince nebo při omezeném pohybu
  // zůstane jen plochá šeď v tónu oblohy — text nad ní čte stejně.
  // Obojí se zjišťuje až po mountu, takže server i první render klienta
  // shodně vykreslí shader a k hydratační chybě nedojde.
  const { heavy, reducedMotion } = usePerformance();

  if (!heavy || reducedMotion) {
    return (
      <div className={styles.layer} aria-hidden="true">
        <div className={styles.overlay} />
        <div className={styles.fallback} />
      </div>
    );
  }

  return (
    <div className={styles.layer} aria-hidden="true">
      <div className={styles.overlay} />
      <Landscape
        className={styles.canvas}
        /* ---------- Kamera ---------- */
        // Kamera stojí. Pohyb dělá samotný terén přes waveSpeed —
        // let vpřed by se s vlnícím povrchem jen pral.
        speed={0}
        waveSpeed={0.05}
        altitude={15}
        focal={0.15}
        // Posun kamery ve světových osách. Dvě věci, na které pozor:
        //  - offsetY není nový pohyb, jen se přičítá k altitude výš (obojí
        //    je eye.y). Měň klidně altitude a offsetY nech na nule.
        //  - při pohledu skoro shora (pitch -1,55) posouvá obraz do stran
        //    offsetX a nahoru/dolů offsetZ. offsetY jen mění výšku, tedy
        //    kolik terénu je vidět — chová se jako zoom.
        offsetX={0}
        offsetY={0}
        offsetZ={0}
        // POZOR: dokumentace říká „downward tilt", ale v shaderu je to
        // obráceně — kladná hodnota míří NAHORU. Pohled shora (bird eye)
        // je záporný, kolem -1.35, a k tomu je potřeba srazit
        // rampDistance a fogStart, jinak vyjde terén jako plochá placka.
        pitch={-1.25}
        // Vrstva leží pod obsahem, k myši by se stejně nedostala.
        cursorInteraction={false}
        cursorSteer={0.5}
        /* ---------- Tvar terénu ---------- */
        elevation={10}
        scale={0.025}
        detail={2}
        /* ---------- Kvalita raymarchingu ---------- */
        // steps a samples jsou hlavní páky na výkon. Shader běží na všech
        // stránkách, takže tady se šetří jako první.
        // steps: komponenta ořezává na 24–400. Dřív tu bylo 240 při stropu
        // 200, takže reálně jelo 200 — tohle je totéž, jen poctivě.
        steps={200}
        // samples: 1–4, víc komponenta neumí (240 ani 12 nikdy neplatilo).
        // Každý vzorek je CELÝ raymarch navíc. Obraz je plochá šeď pod
        // 50% overlayem, takže 4× supersampling nebyl vidět; 1 vzorek
        // při dpr níž dává stejný obraz za čtvrtinu práce.
        samples={1}
        distance={42}
        fogStart={22}
        rampDistance={55}
        /* ---------- Barvy ---------- */
        // Obloha nese tón, který měl dřív sdílený gradient, aby ink text
        // po celém webu zůstal čitelný. Terén drží blízko k ní.
        backgroundColor="#9c9c9c"
        color="#8f8f8a"
        midColor="#9c9c9c"
        farColor="#a3a3a3"
        /* ---------- Nasvícení hřebenů ---------- */
        rimColor="#a3a3a3"
        rimPower={4}
        rimStrength={1}
        /* ---------- Prstence ---------- */
        // Nižší ringWidth = ostřejší hrana prstence; tenký prstenec ale
        // zhasne, takže se to musí dorovnat přes ringStrength.
        ringColor="#bec948"
        ringSpacing={0.5}
        ringSpeed={0.25}
        ringWidth={0.01}
        ringStrength={0.15}
        /* ---------- Obraz ---------- */
        gain={0.8}
        // Zrno tu bývalo (grain, grainSurface, grainDensity, grainRate).
        // Nahradily ho částice níž a kód šel z komponenty pryč.
        // ČÁSTICE V POZADÍ VYPNUTÉ — sekaly se s částicemi na portrétu.
        // Bez propu particles je výchozí 0 a Landscape ParticleField vůbec
        // nepřipojí (žádná simulace, žádné render targety). Pro návrat
        // stačí odkomentovat blok níž.
        // /* ---------- Částice ---------- */
        // // Reagují na kurzor. Ten se sleduje na window, protože vrstva má
        // // pointer-events: none a leží pod obsahem — přímo na ni by se
        // // žádná událost nedostala.
        // // Simulace jede na čtvercové mřížce, 250 000 je přesně 500 x 500.
        // // Strop komponenty je 1024 x 1024, tedy ~1 milion.
        // particles={250000}
        // particleSize={1.5}
        // // Světlejší neutrální šeď. Dřív tu byla #8c8c86, ta ale leží od
        // // podkladu jen 16 úrovní daleko a po vynásobení efektivní alfou
        // // z toho zbyly 2,6 úrovně z 255 — částice byly reálně neviditelné.
        // particleColor="#d6d6ce"
        // particleOpacity={0.4}
        // /* Proudění */
        // particleSpeed={0.5}
        // // Nižší noiseScale = delší a plynulejší proudy.
        // particleNoiseScale={0.0025}
        // particleNoiseStrength={0.05}
        // particleDamping={0.9}
        // particleLifespan={200}
        // // Kurzor částicím předává svou rychlost, netlačí je pryč.
        // hoverRadius={140}
        // hoverPush={0.22}
        // // Slabě zapnuté. Prstenec je postupná vlna a částice mají tlumení,
        // // takže se nevrátí přesně tam, odkud vyjely — vzniká drift, který
        // // je vyhrne do pásů a mezi nimi nechá kruhové díry. Nejhorší je to
        // // u středu, kde má hloubka nulový gradient a celá plocha kmitá
        // // ve fázi. Při 0,015 je to pod prahem viditelnosti; vlnění dělá
        // // hlavně ridgeFlow níž, ten drift nemá. Pro úplné vypnutí dát 0.
        // ringPush={0.015}
        // // Výboj na hřebenech: rim svítí na svazích, takže sim počítá
        // // gradient výšky a nechá částice téct podél hřebene.
        // ridgeFlow={0.025}
        vignette={0.2}
        opacity={1}
        /* ---------- Běh a výkon ---------- */
        paused={false}
        adaptiveQuality={true}
        // Celé plátno (terén i částice) jede na 30 fps. Pozadí se vlní
        // pomalu a pod obsahem, rozdíl proti 60 není vidět, práce je
        // poloviční. targetFps se o strop stará komponenta sama.
        fps={30}
        targetFps={60}
        // Při 1 vzorku na pixel dělá vyhlazení samotné dpr. 1,25 místo 1,5
        // je o 30 % méně pixelů; s 4 vzorky to byla dvojnásobná práce
        // na vyhlazení, které stejně zmizelo pod overlayem.
        dpr={1.25}
      />
    </div>
  );
}
