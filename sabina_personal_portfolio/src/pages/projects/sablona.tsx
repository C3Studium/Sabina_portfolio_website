import Seo from "@/components/seo";
import type { GetStaticPropsContext } from "next";
import { getGlobalCopy, type GlobalCopy } from "@/lib/site/globals";
import { viewFrom } from "@/lib/site/projects";
import Study from "@/components/study";
import { STUDY_TEMPLATE } from "@/components/study/content";

// Šablona případové studie — Věcičky NATVRDO z kódu (STUDY_TEMPLATE), bez
// Studia. Skutečná studie projektu bydlí v dokumentu projektu (záložka
// „Případová studie") a kreslí ji /projects/[slug]; tahle stránka zůstává
// jako pevná ukázka a místo na zkoušení rozvržení.
const REVALIDATE_SECONDS = 600;

type Props = {
  globals: GlobalCopy;
};

export async function getStaticProps(context: GetStaticPropsContext) {
  const view = viewFrom(context);
  const globals = await getGlobalCopy(view);
  return {
    props: { globals } satisfies Props,
    revalidate: REVALIDATE_SECONDS,
  };
}

export default function StudyTemplatePage() {
  const study = STUDY_TEMPLATE;
  return (
    <>
      {/* Šablona — do vyhledávačů ne (skutečná studie je /projects/vecicky). */}
      <Seo title={`${study.title} — šablona studie`} description={`${study.title} — ${study.kind.toLowerCase()}.`} noindex />
      <main>
        <Study content={study} />
      </main>
    </>
  );
}
