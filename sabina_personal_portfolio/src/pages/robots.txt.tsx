import type { GetServerSideProps } from "next";
import { siteUrl } from "@/components/seo";

// /robots.txt — Studio, API a šablonu studie vyhledávače neprocházejí.
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const base = siteUrl();
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /studio",
    "Disallow: /api/",
    "Disallow: /projects/sablona",
    ...(base ? ["", `Sitemap: ${base}/sitemap.xml`] : []),
    "",
  ].join("\n");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate");
  res.write(body);
  res.end();
  return { props: {} };
};

export default function Robots() {
  return null;
}
