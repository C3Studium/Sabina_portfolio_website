import type { GetStaticProps } from "next";
import { viewOf } from "@c3studium/valecms/server/site";
import Seo from "@/components/seo";
import NotFound from "@/components/not-found";
import { getGlobalCopy, type GlobalCopy } from "@/lib/site/globals";
import { getProjects } from "@/lib/site/projects";
import { projectBanners } from "@/lib/site/project-banners";

// Vlastní stránka 404. Globály (hlavička, patička, nastavení webu) čte jako
// každá jiná stránka — bez nich hlavička nabízela Reference i s vypnutým
// přepínačem ve Studiu (výchozí hodnota) a odkaz otevřel okno s recenzemi.
// Bannery za číslem z publikovaných projektů (skrytý projekt tu nebude).
// SEO na výchozích hodnotách webu.
const REVALIDATE_SECONDS = 600;

type Props = { globals: GlobalCopy; banners: string[] };

export const getStaticProps: GetStaticProps<Props> = async (context) => {
  const [globals, projects] = await Promise.all([getGlobalCopy(viewOf(context)), getProjects()]);
  return { props: { globals, banners: projectBanners(projects) }, revalidate: REVALIDATE_SECONDS };
};

export default function NotFoundPage({ banners }: Props) {
  return (
    <>
      <Seo title="Stránka nenalezena" description="Tahle stránka neexistuje. Zpět na úvod nebo k projektům grafické designérky Sabiny Hudrmentové." noindex />
      <main>
        <NotFound banners={banners} />
      </main>
    </>
  );
}
