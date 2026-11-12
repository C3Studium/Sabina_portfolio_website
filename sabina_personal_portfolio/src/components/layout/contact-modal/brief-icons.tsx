// Ikony karet poptávky (brief.tsx). Volby jsou text (část z CMS), ikona se
// proto vybírá podle slov v názvu; co nic nepozná, dostane obecnou.

import type { ReactNode } from "react";

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ICONS: [RegExp, ReactNode][] = [
  // Kdo jste
  [/firma/i, <path key="a" {...P} d="M4 20V6l7-3v17M11 9h9v11M7 9v.01M7 13v.01M7 17v.01M15 13h1M15 17h1M3 20h18" />],
  [/^e-?shop$/i, <path key="a" {...P} d="M3 4h2.4l2.2 11h10.6L20.5 7H6.4M9.5 19.5h.01M17 19.5h.01" />],
  [/startup/i, <path key="a" {...P} d="M12 15c-1.8-1.8-2.6-4.6-1.8-8L14 3.5 17.8 7c.8 3.4 0 6.2-1.8 8zm-3-1-3 1 1-3m7.5 0v4l-2 2M15 9.5h.01" />],
  [/agentura/i, <path key="a" {...P} d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7-1a2.5 2.5 0 1 0 0-5M3 20c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5m2-5c2.4.4 4 2.4 4 5" />],
  [/osobní/i, <path key="a" {...P} d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5M17 4.5l1.5-1.5M19 7h2" />],
  // Co potřebujete
  [/banner/i, <path key="a" {...P} d="M3 5h18v10H3zM6 9h7M6 12h4M16 18l2 3M8 18l-2 3M12 15v6" />],
  [/sociáln|sítě/i, <path key="a" {...P} d="M4 5h16v11H9l-5 4zM9 10.5c0-1.4 2-2 3 0 1-2 3-1.4 3 0 0 1.6-3 3-3 3s-3-1.4-3-3z" />],
  [/e-?shop/i, <path key="a" {...P} d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2M9.5 13l2 2 3.5-3.5" />],
  [/identit/i, <path key="a" {...P} d="M12 3l3.5 6.5L12 21 8.5 9.5zM12 9.5V14M8.5 9.5h7M5 21h14" />],
  // Podklady
  [/logo|barv/i, <path key="a" {...P} d="M12 3a9 9 0 1 0 0 18c1.2 0 1.6-1.1 1-2-.8-1.1 0-2.5 1.3-2.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3zM7.5 11h.01M10 7.5h.01M15 7.5h.01" />],
  [/fotk/i, <path key="a" {...P} d="M3 8h4l2-3h6l2 3h4v11H3zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />],
  [/text/i, <path key="a" {...P} d="M5 6V4h14v2M12 4v16M9 20h6M4 12h3M17 12h3" />],
  [/inspira|vzor/i, <path key="a" {...P} d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.7.5 1 1.2 1 2.1h5c0-.9.3-1.6 1-2.1A6 6 0 0 0 12 3z" />],
  [/nic|nuly/i, <path key="a" {...P} d="M4 4h16v16H4zM12 8v8M8 12h8" strokeDasharray="2 2.4" />],
  // Termín
  [/nejdřív/i, <path key="a" {...P} d="M13 3 5 13.5h6L10 21l8.5-11h-6z" />],
  [/týdn/i, <path key="a" {...P} d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3v3H8z" />],
  [/měsíc/i, <path key="a" {...P} d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />],
  [/nespěch/i, <path key="a" {...P} d="M5 10h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 11h1.5a2.5 2.5 0 0 1 0 5H16M9 3c0 1.5 1.5 1.5 1.5 3M12.5 3c0 1.5 1.5 1.5 1.5 3" />],
  // Rozpočet
  [/nevím|poraď/i, <path key="a" {...P} d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4V14M12 17.5h.01" />],
  [/kč|tisíc/i, <path key="a" {...P} d="M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5" />],
];

const FALLBACK = <path {...P} d="M12 4l1.8 4.8L19 10l-4.2 3 1.4 5-4.2-3-4.2 3 1.4-5L5 10l5.2-1.2z" />;

export function OptionIcon({ label }: { label: string }) {
  const icon = ICONS.find(([test]) => test.test(label))?.[1] ?? FALLBACK;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {icon}
    </svg>
  );
}

/** Ikona kopírování (kontakty na dotyku místo šipky). */
export function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" />
      <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" strokeLinecap="round" />
    </svg>
  );
}
