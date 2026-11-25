import { useMemo } from "react";
import type { GetStaticPaths, GetStaticProps } from "next";
import { useLiveBody } from "@c3studium/valecms/edit";
import Seo from "@/components/seo";
import { getPageContent, readerFor } from "@c3studium/valecms/server/site";
import CaseStudy from "@/components/case-study";
import Study from "@/components/study";
import type { LabelsCopy } from "@/components/projects/hero-list";
import { projectsOrFallback } from "@/components/projects/fallback";
import { STUDIES } from "@/components/study/studies";
import { getGlobalCopy, type GlobalCopy } from "@/lib/site/globals";
import { getProjects, viewFrom, type Project, type Reader } from "@/lib/site/projects";
import { getVisuals, type Visual3d } from "@/lib/site/study";
import { projectFrom } from "@/lib/site/project-body";

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
  // někam i na webu bez CMS. S databází JEN publikované projekty — studie
  // v kódu (STUDIES) stránku nezaloží: projekt skrytý, archivovaný nebo
  // smazaný ve Studiu by jinak žil dál ze zálohy (tak zůstala /projects/jordan).
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

  const [content, projects, globals, visuals] = await Promise.all([
    getPageContent("/projects/[slug]", view),
    getProjects({ read }),
    getGlobalCopy(view),
    getVisuals({ read }),
  ]);

  const slug = typeof params?.slug === "string" ? params.slug : "";
  // Záloha z kódu jen bez databáze (projectsOrFallback). Projekt, který ve
  // Studiu není publikovaný (stažený, archivovaný, smazaný, přejmenovaný),
  // vrací 404 — i když pro jeho adresu leží v kódu studie.
  const list = projectsOrFallback(projects);
  const index = list.findIndex((project) => project.slug === slug);
  if (index < 0) return { notFound: true, revalidate: REVALIDATE_SECONDS };

  const found = list[index];
  // Studie: ze Studia, jinak záloha z kódu (stejná adresa).
  const project = { ...found, study: found.study ?? STUDIES[slug] ?? null };
  const next = list.length > 1 ? list[(index + 1) % list.length] ?? null : null;

  return {
    props: { content, project, next, globals, visuals },
    revalidate: REVALIDATE_SECONDS,
  };
};

export default function CaseStudyPage({ content, project: stored, next, visuals }: Props) {
  // Živý náhled Study Cases: v editoru dokumentu Studia se stránka překresluje
  // z rozepsaného formuláře (valecms useLiveBody) — stejný převod jako
  // getStaticProps (project-body.ts). Mimo Studio je `live` vždy null.
  const live = useLiveBody(stored.id ?? null);
  const project = useMemo(() => {
    if (!live) return stored;
    const fresh = projectFrom(live, stored.seo);
    return { ...fresh, study: fresh.study ?? STUDIES[stored.slug] ?? null };
  }, [live, stored]);
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
      <main key={`project-${stored.slug}`}>
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
