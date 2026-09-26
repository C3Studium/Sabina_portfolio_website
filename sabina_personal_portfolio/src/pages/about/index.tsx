import Head from "next/head";
import type { GetStaticProps } from "next";
import { getPageContent, viewOf } from "@c3studium/valecms/server/site";
import { getGlobalCopy, type GlobalCopy } from "@/lib/site/globals";
import AboutMe, { type AboutContent } from "@/components/about/about-me";

type Props = {
  content: AboutContent;
  globals: GlobalCopy;
};

// Co request chce vidět: publikovaný web, koncept, nebo stav k okamžiku.
// Typová deklarace balíčku popisuje `viewOf` jako funkci nad `{ draft, at }`
// s výsledkem `unknown`; za běhu bere Next context a vrací právě tenhle tvar
// (server/site/archive.js). Přetypování překlenuje deklaraci, ne chování.
type View = { draft?: boolean; at?: string | null };

// ISR: texty se mění zřídka a `revalidate` je to, čím se publikace ze Studia
// dostane na web bez nasazení.
const REVALIDATE_SECONDS = 600;

export const getStaticProps: GetStaticProps<Props> = async (context) => {
  const view = viewOf(context as View) as View;

  // Globální bloky (hlavička, patička) `getPageContent` nevrací — prochází jen
  // bloky své routy. `_app` je bere z pageProps, takže je nese každá stránka.
  const [content, globals] = await Promise.all([
    getPageContent("/about", view),
    getGlobalCopy(view),
  ]);

  return { props: { content, globals }, revalidate: REVALIDATE_SECONDS };
};

export default function AboutPage({ content }: Props) {
  return (
    <>
      <Head>
        <title>O mně — Sabina Hudrmentová</title>
        <meta
          name="description"
          content="Grafická designérka Sabina Hudrmentová — vzdělání, zkušenosti a specializace."
        />
      </Head>
      <main>
        {/* `docId` u bloků cestuje jen do rámu Studia (f.docId); na veřejné
            stránce chybí a anotace se rozprostřou naprázdno. */}
        <AboutMe content={content} />
      </main>
    </>
  );
}
