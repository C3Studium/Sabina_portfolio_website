import Head from "next/head";
import { useRouter } from "next/router";

export default function CaseStudyPage() {
  const router = useRouter();
  const { slug } = router.query;

  return (
    <>
      <Head>
        <title>Case study — Sabina</title>
        <meta name="description" content="Case study." />
      </Head>
      <main>
        <section id="case-study-hero">
          <h1>{slug}</h1>
        </section>
        <section id="case-study-overview" />
        <section id="case-study-process" />
        <section id="case-study-outcome" />
        <section id="case-study-next" />
      </main>
    </>
  );
}
