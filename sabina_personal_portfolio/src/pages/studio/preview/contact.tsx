import type { GetStaticProps } from "next";
import { siteChrome } from "@c3studium/valecms";
import { viewOf } from "@c3studium/valecms/server/site";
import Seo from "@/components/seo";
import { getGlobalCopy, type GlobalCopy } from "@/lib/site/globals";

// Náhled povrchu „Kontakt" pro Studio (src/lib/cms/layout.ts: defineSurface
// `preview` + `editor: 'split'`): stránka webu s otevřeným kontaktním modálem
// (_app ho na téhle adrese otevře sám). Studio ji ukazuje vpravo vedle
// formuláře bloku `global.contact` — živě a s dvojklikem na texty.
// Pod /studio/, ale stránka WEBU: siteChrome (hlavička, pozadí, modál).
const REVALIDATE_SECONDS = 600;

type Props = { globals: GlobalCopy };

export const getStaticProps: GetStaticProps<Props> = async (context) => ({
  // V rámu Studia s konceptem (draft mode) — bloky nesou id pro anotace.
  props: { globals: await getGlobalCopy(viewOf(context)) },
  revalidate: REVALIDATE_SECONDS,
});

function ContactPreview() {
  return (
    <>
      <Seo title="Kontakt — náhled" description="Náhled kontaktního okna pro Studio." noindex />
      <main />
    </>
  );
}

export default siteChrome(ContactPreview);
