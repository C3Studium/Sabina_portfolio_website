import type { GetStaticProps } from "next";
import { viewOf } from "@c3studium/valecms/server/site";
import Seo from "@/components/seo";
import NotFound from "@/components/not-found";
import { getGlobalCopy, type GlobalCopy } from "@/lib/site/globals";

// Vlastní stránka 404. Globály (hlavička, patička, nastavení webu) čte jako
// každá jiná stránka — bez nich hlavička nabízela Reference i s vypnutým
// přepínačem ve Studiu (výchozí hodnota) a odkaz otevřel okno s recenzemi.
// SEO na výchozích hodnotách webu.
const REVALIDATE_SECONDS = 600;

type Props = { globals: GlobalCopy };

export const getStaticProps: GetStaticProps<Props> = async (context) => {
  const globals = await getGlobalCopy(viewOf(context));
  return { props: { globals }, revalidate: REVALIDATE_SECONDS };
};

export default function NotFoundPage() {
  return (
    <>
      <Seo title="Stránka nenalezena" description="Tahle stránka neexistuje. Zpět na úvod nebo k projektům grafické designérky Sabiny Hudrmentové." noindex />
      <main>
        <NotFound />
      </main>
    </>
  );
}
