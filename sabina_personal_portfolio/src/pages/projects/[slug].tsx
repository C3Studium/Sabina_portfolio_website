import type { GetStaticPaths, GetStaticProps } from "next";
import Seo from "@/components/seo";
import { getPageContent, readerFor } from "@c3studium/valecms/server/site";
import CaseStudy from "@/components/case-study";
import Study from "@/components/study";
import type { LabelsCopy } from "@/components/projects/hero-list";
import { FALLBACK_PROJECTS, projectsOrFallback } from "@/components/projects/fallback";
import { STUDIES } from "@/components/study/studies";
import { getGlobalCopy, type GlobalCopy } from "@/lib/site/globals";
import { getProjects, viewFrom, type Project, type Reader } from "@/lib/site/projects";
import { getVisuals, type Visual3d } from "@/lib/site/study";

// Jedna stránka na projekt, generovaná z dokumentů typu `project`. Přidat
// projekt je úprava ve Studiu; routa potřebuje jen slug.
const REVALIDATE_SECONDS = 600;

type Props = {
  content: Record<string, unknown>;
  project: Project;
  next: Project | null;
  globals: GlobalCopy;
  /** 3D vizuály (typ `visual3d`) pro detail děl případové studie. */
  visuals: Visual3d[];
};

export const getStaticPaths: GetStaticPaths = async () => {
  // Bez databáze se generují detaily zálohy z kódu, aby odkazy z karet vedly
  // někam i na webu bez CMS.
  const projects = projectsOrFallback(await getProjects());
  // Plus projekty s případovou studií v kódu (záloha), i když ve Studiu ještě nejsou.
  const slugs = new Set([...projects.map((project) => project.slug), ...Object.keys(STUDIES)]);
  return {
    paths: [...slugs].map((slug) => ({ params: { slug } })),
    // Projekt publikovaný po posledním buildu stránku dostane: první požadavek
    // ji vykreslí a od té chvíle je v cache. Bez toho by Studio publikovalo
    // něco, co do dalšího nasazení vrací 404.
    fallback: "blocking",
  };
};

export const getStaticProps: GetStaticProps<Props> = async ({ params, ...context }) => {
  const view = viewFrom(context);
  // `read` i sem: stránka JE projekt, takže stránka rámovaná k okamžiku musí
  // najít projekt, jak byl popsaný tehdy — a náhled Studia koncept i s id.
  const read = readerFor(view) as Reader;

  const [content, projects, globals, visuals] = await Promise.all([
    getPageContent("/projects/[slug]", view),
    getProjects({ read }),
    getGlobalCopy(view),
    getVisuals({ read }),
  ]);

  const slug = typeof params?.slug === "string" ? params.slug : "";
  const list = projectsOrFallback(projects);
  let index = list.findIndex((project) => project.slug === slug);
  // Projekt se studií v kódu, který ve Studiu ještě není: záložní projekt.
  // (Jen detail — řada karet na /projects zůstává podle Studia.)
  const backup = index < 0 && STUDIES[slug] ? FALLBACK_PROJECTS.find((project) => project.slug === slug) : undefined;
  if (backup) index = list.length;
  // Smazaný nebo přejmenovaný projekt musí vrátit 404, ne prázdnou stránku.
  if (index < 0) return { notFound: true, revalidate: REVALIDATE_SECONDS };

  const found = backup ?? list[index];
  // Studie: ze Studia, jinak záloha z kódu (stejná adresa).
  const project = { ...found, study: found.study ?? STUDIES[slug] ?? null };
  const next = list.length > 1 ? list[(index + 1) % list.length] ?? null : null;

  return {
    props: { content, project, next, globals, visuals },
    revalidate: REVALIDATE_SECONDS,
  };
};

export default function CaseStudyPage({ content, project, next, visuals }: Props) {
  const title = `${project.title} — případová studie`;
  // Popis: perex, jinak první odstavec studie bez značek, jinak podtitul.
  const studyLead = project.study?.chapters.cover.text[0]?.map(([text]) => text).join(" ").replace(/\s+([.,;:!?])/g, "$1");
  const description =
    project.perex ||
    studyLead ||
    `${project.title}${project.tagline ? ` — ${project.tagline.toLowerCase()}` : ""}. Případová studie grafické designérky Sabiny Hudrmentové.`;
  const cover = project.study?.chapters.cover.works.at(-1)?.image ?? (project.cover ? { src: project.cover.url, width: project.cover.width, height: project.cover.height, alt: project.cover.alt } : null);

  return (
    <>
      {/* Náhled sdílení: společný og-image (formát 1,91 : 1 sítím sedí);
          banner projektu je na výšku a sítě by ho ořízly. */}
      <Seo title={title} description={description} page={project.seo} type="article" image={cover && cover.width && cover.height && cover.width / cover.height > 1.2 ? cover : null} />
      {/* `key` podle slugu: přechod mezi dvěma detaily je nová stránka, ne
          přepsání té staré — animace a scroll začínají znovu. */}
      <main key={`project-${project.slug}`}>
        {/* Projekt s vyplněnou případovou studií (záložka ve Studiu) dostane
            plátno; ostatní dosavadní detail. */}
        {project.study ? (
          <Study content={project.study} visuals={visuals} docId={project.id ?? null} />
        ) : (
          <CaseStudy
            project={project}
            next={next}
            labels={(content?.labels as LabelsCopy | undefined) ?? null}
          />
        )}
      </main>
    </>
  );
}
