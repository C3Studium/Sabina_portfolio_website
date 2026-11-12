import type { ComponentProps } from "react";
import type { GetStaticProps } from "next";
import { getPageContent, viewOf } from "@c3studium/valecms/server/site";
import Seo from "@/components/seo";
import PrivacyContent, { type LegalShipped } from "@/components/legal/privacy";
import { TermsSections } from "@/components/legal/terms";
import { getGlobalCopy, type GlobalCopy } from "@/lib/site/globals";

// /obchodni-podminky — rozvržení stránky ochrany soukromí (převzaté z webu
// Procházka Group), vlastní texty (components/legal/terms.ts, Studio:
// bloky `obchodni-podminky.*`). NÁVRH — ověří právník.
const REVALIDATE_SECONDS = 600;

const SHIPPED: LegalShipped = {
  hero: {
    tag: "VOP",
    words: "Obchodní podmínky",
    heading: ["Jak spolu", "budeme pracovat", "od zadání po předání."],
    lead: "Objednávka, cena, korektury, předání a autorská práva",
    indexLabel: "Obsah",
  },
  sections: TermsSections,
};

type Props = { content: Record<string, unknown> | null; globals: GlobalCopy };
type ContentProps = ComponentProps<typeof PrivacyContent>;

export const getStaticProps: GetStaticProps<Props> = async (context) => {
  const view = viewOf(context);
  const [content, globals] = await Promise.all([getPageContent("/obchodni-podminky", view), getGlobalCopy(view)]);
  return { props: { content: content ?? null, globals }, revalidate: REVALIDATE_SECONDS };
};

export default function Page({ content }: Props) {
  return (
    <>
      <Seo title="Obchodní podmínky" description="Obchodní podmínky spolupráce s grafickou designérkou Sabinou Hudrmentovou — objednávka, cena, korektury, předání a autorská práva." />
      <main lang="cs">
        <PrivacyContent
          hero={(content?.hero as ContentProps["hero"]) ?? null}
          sections={(content?.sections as ContentProps["sections"]) ?? null}
          shipped={SHIPPED}
        />
      </main>
    </>
  );
}
