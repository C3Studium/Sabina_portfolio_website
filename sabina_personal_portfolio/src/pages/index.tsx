import Head from "next/head";
import type { GetStaticPropsContext } from "next";
import { getPageContent, viewOf } from "@c3studium/valecms/server/site";
import { getGlobalCopy, type GlobalCopy } from "@/lib/site/globals";
import Hero, { type HeroCopy } from "@/components/home/hero";
import Info, { type InfoCopy } from "@/components/home/info";
import Process, { type ProcessCopy } from "@/components/home/process";
import Cta, { type CtaCopy } from "@/components/home/cta";

// ISR: texty se mění párkrát do měsíce a `revalidate` je to, čím se publikace
// ze Studia dostane na web bez deploye.
const REVALIDATE_SECONDS = 600;

// Pohled, kterým se čte: publikované, koncept, nebo stav k danému okamžiku.
// `viewOf` ho čte z podepsané preview cookie Next.js (`draftMode`,
// `previewData`), nikdy z query — proto bere celý kontext getStaticProps.
// Deklarace v balíčku ho ale popisují jako `{ draft, at }` a odpověď jako
// `unknown`; tady se to jen pojmenuje, za běhu se nic nemění.
type View = { draft?: boolean; at?: string | null };

type HomeProps = {
  content: {
    hero?: HeroCopy;
    info?: InfoCopy;
    process?: ProcessCopy;
    cta?: CtaCopy;
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
  const view = viewOf(context);
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
      <Head>
        <title>Sabina Hudrmentová — Grafika pro lepší výsledky</title>
        <meta
          name="description"
          content="Portfolio grafické designérky Sabiny Hudrmentové."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        {/* `content.<at>` je blok podle src/lib/cms/home.ts. `docId` v něm je
            jen v editačním rámu Studia; na webu chybí a anotace mlčí. */}
        <Hero copy={content?.hero} />
        <Info copy={content?.info} />
        <Process copy={content?.process} />
        <Cta copy={content?.cta} />
      </main>
    </>
  );
}
