// Obsah úvodní stránky pro okna sekcí (layout/section-popup) na ostatních
// stránkách. Na úvodní je v pageProps; jinde by okna ukázala jen zálohy
// z kódu — tahle routa vrátí totéž, co skládá getStaticProps v pages/index.tsx.
//
// Pohled (publikované / koncept) z preview cookie jako u stránek, takže
// náhled ze Studia vidí v oknech koncept. Publikované se smí cachovat
// stejně dlouho jako ISR úvodní stránky; koncept nikdy.
import type { NextApiRequest, NextApiResponse } from "next";
import { getPageContent } from "@c3studium/valecms/server/site";
import { viewFrom } from "@/lib/site/projects";
import { registerHomeSources } from "@/lib/site/home";

const REVALIDATE_SECONDS = 600;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).end();
    return;
  }
  registerHomeSources();
  const draft = Boolean(req.draftMode || req.preview);
  const content = await getPageContent("/", viewFrom({ draftMode: req.draftMode, previewData: req.previewData }));
  res.setHeader(
    "Cache-Control",
    draft ? "private, no-store" : `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
  );
  res.status(200).json(content ?? {});
}
