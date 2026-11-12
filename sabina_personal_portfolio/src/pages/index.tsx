import Seo, { personJsonLd } from "@/components/seo";
import type { GetStaticPropsContext } from "next";
import { getPageContent } from "@c3studium/valecms/server/site";
import { getGlobalCopy, type GlobalCopy } from "@/lib/site/globals";
// Čtečky typů ve `sources` (src/lib/cms/home.ts). Projekty se registrují při
// načtení modulu, ostatní voláním níž — oboje musí proběhnout dřív, než
// `getPageContent` po nich sáhne. Použité jen v getStaticProps, takže je Next
// do stránky pro prohlížeč nevezme.
import { viewFrom, type Project } from "@/lib/site/projects";
import {
  registerHomeSources,
  type HeroWord,
  type ProcessStep,
  type Reference,
  type Service,
  type StackItem,
  type StatItem,
} from "@/lib/site/home";
import Hero, { type HeroCopy } from "@/components/home/hero";
import Info, { type InfoCopy } from "@/components/home/info";
import Process, { type ProcessCopy } from "@/components/home/process";
import Cta, { type CtaCopy } from "@/components/home/cta";

// ISR: texty se mění párkrát do měsíce a `revalidate` je to, čím se publikace
// ze Studia dostane na web bez deploye.
const REVALIDATE_SECONDS = 600;

// Pohled, kterým se čte (publikované, koncept, nebo stav k danému okamžiku),
// bere `viewFrom` z podepsané preview cookie Next.js, nikdy z query — proto
// celý kontext getStaticProps. Stejně jako stránky /projects.

type HomeProps = {
  content: {
    hero?: HeroCopy;
    info?: InfoCopy;
    process?: ProcessCopy;
    cta?: CtaCopy;
    // Dokumenty ze `sources` v src/lib/cms/home.ts.
    projects?: Project[];
    heroWords?: HeroWord[];
    stack?: StackItem[];
    stats?: StatItem[];
    services?: Service[];
    steps?: ProcessStep[];
    references?: Reference[];
  };
  globals: GlobalCopy;
};

/**
 * Nemůže selhat: každé čtení uvnitř odpoví prázdnem místo výjimky, takže
 * nedostupná databáze dá stránku s texty, se kterými přišly komponenty.
 *
 * `globals` sem patří vždy — hlavička, patička a kontaktní modál se kreslí
 * pod každou routou, `_app` si je bere z pageProps (viz src/lib/site/globals.ts).
 */
export async function getStaticProps(context: GetStaticPropsContext) {
  registerHomeSources();
  const view = viewFrom(context);
  const [content, globals] = await Promise.all([
    getPageContent("/", view),
    getGlobalCopy(view),
  ]);

  return {
    props: { content, globals } satisfies HomeProps,
    revalidate: REVALIDATE_SECONDS,
  };
}

export default function HomePage({ content }: HomeProps) {
  return (
    <>
      <Seo
        title={null}
        description="Grafika pro lepší výsledky. Grafická designérka Sabina Hudrmentová — reklamní bannery, kampaně a vizuály pro e-shopy, které zaujmou a prodávají."
        type="profile"
        jsonLd={personJsonLd()}
      />
      <main>
        {/* `content.<at>` je blok podle src/lib/cms/home.ts. `docId` v něm je
            jen v editačním rámu Studia; na webu chybí a anotace mlčí. */}
        <Hero
          copy={content?.hero}
          projects={content?.projects ?? null}
          words={content?.heroWords?.filter((word) => word.place === "hero") ?? null}
        />
        <Info
          copy={content?.info}
          stack={content?.stack ?? null}
          stats={content?.stats ?? null}
          services={content?.services ?? null}
        />
        {/* CTA je poslední dlaždice dolly v Procesu (portál na konci). */}
        <Process
          copy={content?.process}
          steps={content?.steps ?? null}
          cta={(progress, still) => (
            <Cta
              copy={content?.cta}
              references={content?.references ?? null}
              words={content?.heroWords?.filter((word) => word.place === "cta") ?? null}
              progress={progress}
              still={still}
            />
          )}
        />
      </main>
    </>
  );
}
