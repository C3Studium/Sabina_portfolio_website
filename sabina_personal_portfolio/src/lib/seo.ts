// Výchozí SEO webu z kódu — platí, dokud ve Studiu není dokument „SEO a ikony"
// (a pro stránky bez getStaticProps, třeba 404). Soubory jsou v /public:
// og-image.jpg (scripts/og-image.mjs), icon.png a apple-touch-icon.png
// (scripts/brand-assets.mjs).
import type { SiteSeo } from '@c3studium/valecms/server/site'

export const SEO_FALLBACK: SiteSeo = {
    siteName: 'Sabina Hudrmentová',
    tagline: 'Grafická designérka',
    description:
        'Grafická designérka Sabina Hudrmentová — reklamní bannery, kampaně a vizuály pro e-shopy, které zaujmou a prodávají.',
    locale: 'cs_CZ',
    shareImage: { src: '/og-image.jpg', width: 1200, height: 630, alt: 'Sabina Hudrmentová — grafika pro lepší výsledky' },
    twitter: '',
    favicon: { src: '/icon.png', width: 32, height: 32, alt: '' },
    appleIcon: { src: '/apple-touch-icon.png', width: 180, height: 180, alt: '' },
    themeColor: '#262626',
    fromCms: false,
}
