import type { GetStaticProps } from "next";
import { getPageContent, viewOf } from "@c3studium/valecms/server/site";
import Seo from "@/components/seo";
import PrivacyContent from "@/components/legal/privacy";
import type { ComponentProps } from "react";

type PrivacyProps = ComponentProps<typeof PrivacyContent>;
import { getGlobalCopy, type GlobalCopy } from "@/lib/site/globals";

// /ochrana-soukromi — převzaté z webu Procházka Group (komponenta, obsah i model ve
// Studiu: src/lib/cms/legal.ts). ISR: právní text se mění párkrát za rok
// a `revalidate` je to, čím publikace ze Studia dorazí bez nasazení.
const REVALIDATE_SECONDS = 600;

type Props = { content: Record<string, unknown> | null; globals: GlobalCopy };

export const getStaticProps: GetStaticProps<Props> = async (context) => {
  const view = viewOf(context);
  const [content, globals] = await Promise.all([getPageContent("/ochrana-soukromi", view), getGlobalCopy(view)]);
  return { props: { content: content ?? null, globals }, revalidate: REVALIDATE_SECONDS };
};

export default function Page({ content }: Props) {
  return (
    <>
      <Seo title="Ochrana osobních údajů" description="Jak Sabina Hudrmentová zpracovává a chrání vaše osobní údaje, na jakém právním základě a jaká máte práva podle GDPR." />
      <main lang="cs">
        <PrivacyContent hero={(content?.hero as PrivacyProps["hero"]) ?? null} sections={(content?.sections as PrivacyProps["sections"]) ?? null} />
      </main>
    </>
  );
}
