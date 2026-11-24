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
    // Optimalizované obrázky drží Vercel nejméně 31 dní (výchozí 4 h), ať se
    // na originál ze Supabase ptá co nejméně často — „cached egress" free plánu
    // přetekl 24. 11. 2026, když 3D scény stahovaly originály přímo.
    // Soubory knihovny médií mají v názvu hash — nový obrázek = nová adresa.
    minimumCacheTTL: 2678400,
  },
};

export default withValeCms(nextConfig)
