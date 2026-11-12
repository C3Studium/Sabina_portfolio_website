import type { GetStaticProps } from "next";
import Seo from "@/components/seo";
import { getPageContent } from "@c3studium/valecms/server/site";
import HeroList, { type IntroCopy, type LabelsCopy } from "@/components/projects/hero-list";
import { getGlobalCopy, type GlobalCopy } from "@/lib/site/globals";
// Import odsud zároveň registruje čtečku typu `project` (registerSources při
// načtení modulu) — musí proběhnout dřív, než `getPageContent` sáhne po `sources`.
import { viewFrom, type Project } from "@/lib/site/projects";

// Publikace přegeneruje stránku sama (revalidate.js); tohle je jen síť pro
// případ, že by se to nepovedlo.
const REVALIDATE_SECONDS = 600;

type PageContent = {
  intro?: IntroCopy;
  labels?: LabelsCopy;
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
      <Seo title="Projekty" description="Výběr kampaní, reklamních bannerů a vizuálů od grafické designérky Sabiny Hudrmentové — Věcičky, Vlněné zboží, VIKIO, Jordan a další." />
      <main>
        <HeroList
          copy={content?.intro ?? null}
          labels={content?.labels ?? null}
          projects={content?.projects ?? null}
        />
      </main>
    </>
  );
}
