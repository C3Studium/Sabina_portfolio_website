import type { NextConfig } from "next";
import { withValeCms } from '@c3studium/valecms/install/next.mjs'

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  reactStrictMode: true,
  images: {
    // 80 je jen pro portrét v heru. Není to kvůli kvalitě: Next si ve
    // vývoji vede obrázky podle optimalizované URL a tatáž fotka je na
    // stránce ještě třikrát lazy — jiné q= dá heru vlastní URL, jinak
    // falešně hlásí LCP bez loading="eager". Viz komentář u <Image> v heru.
    qualities: [75, 80],
  },
};

export default withValeCms(nextConfig)
