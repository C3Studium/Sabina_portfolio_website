// Obsah úvodní stránky, jak ho skládá getStaticProps v pages/index.tsx
// (`content` v pageProps). Sdílený typ: čte ho i okno sekcí v _app.tsx
// (layout/section-popup), které sekce úvodní stránky otevírá odkudkoli.

import type { HeroCopy } from "@/components/home/hero";
import type { InfoCopy } from "@/components/home/info";
import type { ProcessCopy } from "@/components/home/process";
import type { CtaCopy } from "@/components/home/cta";
import type { Project } from "@/lib/site/projects";
import type { HeroWord, ProcessStep, Reference, Service, StackItem, StatItem } from "@/lib/site/home";

export type HomeContent = {
  hero?: HeroCopy;
  info?: InfoCopy;
  process?: ProcessCopy;
  cta?: CtaCopy;
  projects?: Project[];
  heroWords?: HeroWord[];
  stack?: StackItem[];
  stats?: StatItem[];
  services?: Service[];
  steps?: ProcessStep[];
  references?: Reference[];
};
