import type { GetServerSideProps } from "next";
import { serveShareImage } from "@c3studium/valecms/server/site";
import { SEO_FALLBACK } from "@/lib/seo";

// /share-image.jpg — náhled pro sdílení (og:image) z vlastní domény.
//
// Obrázek ze Studia („SEO a ikony") leží v úložišti Supabase, které ho posílá
// s `X-Robots-Tag: none` a `Cache-Control: private` — WhatsApp, Messenger
// a Facebook ho pak do náhledu odkazu nevezmou. Tahle routa ho podá odsud,
// s hlavičkami pro roboty i cache; `getSiteSeo({ shareImagePath })` v
// lib/site/globals.ts na ni ukáže v og:image. Záloha z kódu (/og-image.jpg
// v /public) je statický soubor, ten se jen přesměruje.
export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  await serveShareImage(req, res, { fallback: SEO_FALLBACK });
  return { props: {} };
};

export default function ShareImage() {
  return null;
}
