import Seo from "@/components/seo";
import type { GetStaticProps } from "next";
import { getPageContent } from "@c3studium/valecms/server/site";
import { getGlobalCopy, type GlobalCopy } from "@/lib/site/globals";
// `viewFrom` odtud (ne `viewOf` z knihovny) schválně: načtení modulu
// registruje čtečku zdroje `project` (registerSources) — stránka ho má mezi
// zdroji kvůli bannerům za portrétem (src/lib/cms/about.ts). Holý import
// pro vedlejší efekt by Next nechal i v klientském balíku (serverový kód).
import { viewFrom, type Project } from "@/lib/site/projects";
import { projectBanners } from "@/lib/site/project-banners";
import AboutMe, { type AboutContent } from "@/components/about/about-me";

type Props = {
  content: AboutContent;
  /** Bannery za portrétem — jen adresy, z publikovaných projektů. */
  banners: string[];
  globals: GlobalCopy;
};

// ISR: texty se mění zřídka a `revalidate` je to, čím se publikace ze Studia
// dostane na web bez nasazení.
const REVALIDATE_SECONDS = 600;

export const getStaticProps: GetStaticProps<Props> = async (context) => {
  const view = viewFrom(context);

  // Globální bloky (hlavička, patička) `getPageContent` nevrací — prochází jen
  // bloky své routy. `_app` je bere z pageProps, takže je nese každá stránka.
  const [page, globals] = await Promise.all([
    getPageContent("/about", view),
    getGlobalCopy(view),
  ]);

  // Projekty (zdroj stránky) jen kvůli bannerům: do stránky jdou adresy, ne
  // celé projekty i se studiemi.
  const { projects, ...content } = (page ?? {}) as AboutContent & { projects?: Project[] };
  return { props: { content, banners: projectBanners(projects), globals }, revalidate: REVALIDATE_SECONDS };
};

export default function AboutPage({ content, banners }: Props) {
  return (
    <>
      <Seo title="O mně" description="Grafická designérka Sabina Hudrmentová — vzdělání, zkušenosti a specializace na reklamní bannery a online kampaně." type="profile" />
      <main>
        {/* `docId` u bloků cestuje jen do rámu Studia (f.docId); na veřejné
            stránce chybí a anotace se rozprostřou naprázdno. */}
        <AboutMe content={content} banners={banners} />
      </main>
    </>
  );
}
