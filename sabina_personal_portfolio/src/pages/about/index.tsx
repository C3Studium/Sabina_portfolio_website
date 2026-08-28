import Head from "next/head";
import AboutMe from "@/components/about/about-me";

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>O mně — Sabina Hudrmentová</title>
        <meta
          name="description"
          content="Grafická designérka Sabina Hudrmentová — vzdělání, zkušenosti a specializace."
        />
      </Head>
      <main>
        <AboutMe />
      </main>
    </>
  );
}
