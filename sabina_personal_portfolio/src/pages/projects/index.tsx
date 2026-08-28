import Head from "next/head";
import HeroList from "@/components/projects/hero-list";

export default function ProjectsPage() {
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
        <HeroList />
        <section id="projects-grid" />
      </main>
    </>
  );
}
