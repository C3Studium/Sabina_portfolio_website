import Seo from "@/components/seo";
import NotFound from "@/components/not-found";

// Vlastní stránka 404. Bez getStaticProps — hlavička a patička jedou na
// textech z kódu (globals chybí), SEO na výchozích hodnotách webu.
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
