import Head from "next/head";
import Hero from "@/components/home/hero";
import Info from "@/components/home/info";
import Process from "@/components/home/process";
import Cta from "@/components/home/cta";

export default function HomePage() {
  return (
    <>
      <Head>
        <title>Sabina Hudrmentová — Grafika pro lepší výsledky</title>
        <meta
          name="description"
          content="Portfolio grafické designérky Sabiny Hudrmentové."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <Hero />
        <Info />
        <Process />
        <Cta />
      </main>
    </>
  );
}
