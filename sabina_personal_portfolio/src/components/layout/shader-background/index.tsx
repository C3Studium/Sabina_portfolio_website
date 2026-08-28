import dynamic from "next/dynamic";
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
        steps={240}
        samples={12}
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
        // Zrno vypnuté — nahradily ho částice níž. Kód zrna zůstal, stačí
        // vrátit hodnotu a particles dát na 0.
        grain={0}
        grainSurface={false}
        grainDensity={200}
        grainRate={25}
        /* ---------- Částice ---------- */
        // Reagují na kurzor. Ten se sleduje na window, protože vrstva má
        // pointer-events: none a leží pod obsahem — přímo na ni by se
        // žádná událost nedostala.
        // Simulace jede na čtvercové mřížce, 260 000 se zaokrouhlí na
        // 512 x 512. Strop komponenty je 1024 x 1024, tedy ~1 milion.
        particles={250000}
        particleSize={1.5}
        // Světlejší neutrální šeď. Dřív tu byla #8c8c86, ta ale leží od
        // podkladu jen 16 úrovní daleko a po vynásobení efektivní alfou
        // z toho zbyly 2,6 úrovně z 255 — částice byly reálně neviditelné.
        particleColor="#d6d6ce"
        particleOpacity={0.4}
        /* Proudění */
        particleSpeed={0.5}
        // Nižší noiseScale = delší a plynulejší proudy.
        particleNoiseScale={0.0025}
        particleNoiseStrength={0.05}
        particleDamping={0.9}
        particleLifespan={200}
        // Kurzor částicím předává svou rychlost, netlačí je pryč.
        hoverRadius={140}
        hoverPush={0.22}
        // VYPNUTO. Prstenec je postupná vlna a částice mají tlumení, takže
        // se nevrátí přesně tam, odkud vyjely — vzniká trvalý drift, který
        // je vyhrne do pásů a mezi nimi nechá kruhové díry. Nejhorší je to
        // u středu, kde má hloubka nulový gradient a celá plocha kmitá
        // ve fázi. Vlnění dělá ridgeFlow níž, ten drift nemá.
        ringPush={0.015}
        // Výboj na hřebenech: rim svítí na svazích, takže sim počítá
        // gradient výšky a nechá částice téct podél hřebene.
        ridgeFlow={0.025}
        vignette={0.2}
        opacity={1}
        /* ---------- Běh a výkon ---------- */
        paused={false}
        adaptiveQuality={true}
        targetFps={60}
        dpr={1.5}
      />
    </div>
  );
}
