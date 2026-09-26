import type { GetStaticProps } from "next";
import Head from "next/head";
import { getPageContent } from "@c3studium/valecms/server/site";
import HeroList, { type ListCopy } from "@/components/projects/hero-list";
import { getGlobalCopy, type GlobalCopy } from "@/lib/site/globals";
// Import odsud zároveň registruje čtečku typu `project` (registerSources při
// načtení modulu) — musí proběhnout dřív, než `getPageContent` sáhne po `sources`.
import { viewFrom, type Project } from "@/lib/site/projects";

// Publikace přegeneruje stránku sama (revalidate.js); tohle je jen síť pro
// případ, že by se to nepovedlo.
const REVALIDATE_SECONDS = 600;

type PageContent = {
  list?: ListCopy;
  projects?: Project[];
};

type Props = {
  content: PageContent;
  globals: GlobalCopy;
};

/**
 * `viewOf(context)` čte podepsanou preview cookie Nextu a odpoví jedním ze tří
 * pohledů — publikovaný web, koncept, nebo okamžik v archivu. Návštěvník cookie
 * nemá, dostane tedy statickou stránku bez id dokumentů. Nic tady nemůže selhat:
 * každé čtení uvnitř odpoví prázdnem a komponenty pak ukážou FALLBACK z kódu.
 */
export const getStaticProps: GetStaticProps<Props> = async (context) => {
  const view = viewFrom(context);

  const [content, globals] = await Promise.all([
    getPageContent("/projects", view),
    getGlobalCopy(view),
  ]);

  return {
    props: { content, globals },
    revalidate: REVALIDATE_SECONDS,
  };
};

export default function ProjectsPage({ content }: Props) {
  return (
    <>
      <Head>
        <title>Projekty — Sabina Hudrmentová</title>
        <meta
          name="description"
          content="Výběr kampaní a vizuálů od grafické designérky Sabiny Hudrmentové."
        />
      </Head>
      <main>
        <HeroList copy={content?.list ?? null} projects={content?.projects ?? null} />
        <section id="projects-grid" />
      </main>
    </>
  );
}
