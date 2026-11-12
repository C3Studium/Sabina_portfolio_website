import type { GetStaticProps } from "next";
import { getPageContent, viewOf } from "@c3studium/valecms/server/site";
import Seo from "@/components/seo";
import CookiesContent, { type CookiesCopy } from "@/components/legal/cookies";
import { getGlobalCopy, type GlobalCopy } from "@/lib/site/globals";

// /cookies — převzaté z webu Procházka Group (komponenta, obsah i model ve
// Studiu: src/lib/cms/legal.ts). ISR: právní text se mění párkrát za rok
// a `revalidate` je to, čím publikace ze Studia dorazí bez nasazení.
const REVALIDATE_SECONDS = 600;

type Props = { content: Record<string, unknown> | null; globals: GlobalCopy };

export const getStaticProps: GetStaticProps<Props> = async (context) => {
  const view = viewOf(context);
  const [content, globals] = await Promise.all([getPageContent("/cookies", view), getGlobalCopy(view)]);
  return { props: { content: content ?? null, globals }, revalidate: REVALIDATE_SECONDS };
};

export default function Page({ content }: Props) {
  return (
    <>
      <Seo title="Zásady používání cookies" description="Jaké cookies web Sabiny Hudrmentové používá, k čemu slouží a jak si jejich nastavení můžete kdykoli změnit." />
      <main lang="cs">
        <CookiesContent content={content as CookiesCopy | null} />
      </main>
    </>
  );
}
