import type { GetStaticPaths, GetStaticProps } from "next";
import Head from "next/head";
import { getPageContent, readerFor } from "@c3studium/valecms/server/site";
import CaseStudy from "@/components/case-study";
import { projectsOrFallback } from "@/components/projects/fallback";
import { getGlobalCopy, type GlobalCopy } from "@/lib/site/globals";
import { getProjects, viewFrom, type Project, type Reader } from "@/lib/site/projects";

// Jedna stránka na projekt, generovaná z dokumentů typu `project`. Přidat
// projekt je úprava ve Studiu; routa potřebuje jen slug.
const REVALIDATE_SECONDS = 600;

type Props = {
  content: Record<string, unknown>;
  project: Project;
  next: Project | null;
  globals: GlobalCopy;
};

export const getStaticPaths: GetStaticPaths = async () => {
  // Bez databáze se generují detaily zálohy z kódu, aby odkazy z karet vedly
  // někam i na webu bez CMS.
  const projects = projectsOrFallback(await getProjects());
  return {
    paths: projects.map((project) => ({ params: { slug: project.slug } })),
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

  const [content, projects, globals] = await Promise.all([
    getPageContent("/projects/[slug]", view),
    getProjects({ read }),
    getGlobalCopy(view),
  ]);

  const slug = typeof params?.slug === "string" ? params.slug : "";
  const list = projectsOrFallback(projects);
  const index = list.findIndex((project) => project.slug === slug);
  // Smazaný nebo přejmenovaný projekt musí vrátit 404, ne prázdnou stránku.
  if (index < 0) return { notFound: true, revalidate: REVALIDATE_SECONDS };

  const project = list[index];
  const next = list.length > 1 ? list[(index + 1) % list.length] : null;

  return {
    props: { content, project, next, globals },
    revalidate: REVALIDATE_SECONDS,
  };
};

export default function CaseStudyPage({ project, next }: Props) {
  const title = `${project.title} — case study | Sabina Hudrmentová`;
  const description =
    project.perex ||
    `${project.title}${project.tagline ? ` — ${project.tagline.toLowerCase()}` : ""}. Case study grafické designérky Sabiny Hudrmentové.`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        {project.cover?.url ? <meta property="og:image" content={project.cover.url} /> : null}
      </Head>
      {/* `key` podle slugu: přechod mezi dvěma detaily je nová stránka, ne
          přepsání té staré — animace a scroll začínají znovu. */}
      <main key={`project-${project.slug}`}>
        <CaseStudy project={project} next={next} />
      </main>
    </>
  );
}
