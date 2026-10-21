// Brána — jediný stav, kterým se řídí, kdy smí stránka začít.
//
//   hold     obrazovku drží opona a nic pod ní se nemá rozjet
//   ground   okno se za chvíli otevře: podklad sekcí (fotky, shader) smí
//            nastoupit, aby už stál, až se okno otevře
//   go       pokyn ke vstupu: slova, tlačítka, navigace
//
// Brána žije v knihovně (engine opony a přechodů z @c3studium/valecms/motion).
// Tenhle soubor je jen naše adresa pro ni — `@/motion/LoadProvider` — aby
// sekce nemusely importovat z balíčku.
//
//     const { go, ground } = useGate()
//     <motion.h1 animate={go ? { opacity: 1 } : { opacity: 0 }} />

export { LoadProvider, useGate } from "@c3studium/valecms/motion";
export type { Gate, GateValue } from "@c3studium/valecms/motion";
