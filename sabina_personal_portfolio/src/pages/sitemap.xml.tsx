import type { GetServerSideProps } from "next";
import { siteUrl } from "@/components/seo";
import { projectsOrFallback } from "@/components/projects/fallback";
import { STUDIES } from "@/components/study/studies";
import { getProjects } from "@/lib/site/projects";

// /sitemap.xml — stránky webu a všechny projekty (ze Studia, jinak záloha).
export const getServerSideProps: GetServerSideProps = async ({ res, req }) => {
  const base = siteUrl() || `https://${req.headers.host ?? "localhost"}`;
  let projects: { slug: string }[] = [];
  try {
    projects = projectsOrFallback(await getProjects());
  } catch {
    projects = projectsOrFallback([]);
  }
  const slugs = [...new Set([...projects.map((p) => p.slug), ...Object.keys(STUDIES)])];
  const urls = [
    { loc: "/", priority: "1.0" },
    { loc: "/projects", priority: "0.9" },
    { loc: "/about", priority: "0.7" },
    ...slugs.map((slug) => ({ loc: `/projects/${slug}`, priority: "0.8" })),
  ];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => `  <url><loc>${base}${u.loc}</loc><priority>${u.priority}</priority></url>`),
    "</urlset>",
    "",
  ].join("\n");
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate");
  res.write(xml);
  res.end();
  return { props: {} };
};

export default function Sitemap() {
  return null;
}
