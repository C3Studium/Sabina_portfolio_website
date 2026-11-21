// Ilustrace služby na kartě „Co nabízím" (2026-11-21) — místo malé ikony ze
// Studia, která přes celou kartu vypadala rozmazaně. Kreslené SVG v barvách
// webu (sněhová, zelená, šedá) — žádné barvy ani písma klientů (NDA).
//
// Která ilustrace: podle názvu služby (reklama / sociální sítě / branding /
// web), jinak podle pořadí karty. Ve Studiu se nedá upravit — je to výzdoba.

import type { CSSProperties } from "react";

export type ServiceVisualKind = "ads" | "social" | "brand" | "web";

const ORDER: ServiceVisualKind[] = ["ads", "social", "brand", "web"];

/** Ilustrace pro službu: podle slov v názvu, jinak podle pořadí. */
export const visualFor = (title: string, index: number): ServiceVisualKind => {
  const t = title.toLowerCase();
  if (/reklam|banner|kampa/.test(t)) return "ads";
  if (/sociál|social|instagram|facebook/.test(t)) return "social";
  if (/brand|logo|identit|značk/.test(t)) return "brand";
  if (/web|stránk|ui\b|prvk/.test(t)) return "web";
  return ORDER[index % ORDER.length];
};

const SNOW = "var(--snow)";
const GREEN = "var(--green)";
const LINE = "rgba(var(--snow-rgb), 0.28)";
const FAINT = "rgba(var(--snow-rgb), 0.12)";
const FILL = "rgba(var(--snow-rgb), 0.06)";

// Rozměrová značka jako v hlavičce webu (MeasureText): „W × H".
const Tag = ({ x, y, text }: { x: number; y: number; text: string }) => (
  <text x={x} y={y} fill="rgba(var(--snow-rgb), 0.55)" fontSize="9" letterSpacing="1.2" fontFamily="inherit">
    {text}
  </text>
);

function Ads() {
  return (
    <>
      {/* Story 9:16, post 4:5, čtverec a leaderboard — formáty jedné kampaně. */}
      <rect x="22" y="40" width="96" height="170" rx="10" fill={FILL} stroke={LINE} />
      <rect x="34" y="56" width="52" height="7" rx="3.5" fill={SNOW} opacity="0.85" />
      <rect x="34" y="70" width="70" height="7" rx="3.5" fill={SNOW} opacity="0.5" />
      <circle cx="70" cy="128" r="26" fill="none" stroke={LINE} />
      <circle cx="70" cy="128" r="12" fill={GREEN} opacity="0.85" />
      <rect x="34" y="180" width="56" height="16" rx="8" fill={GREEN} />
      <Tag x={22} y={30} text="1080 × 1920" />

      <rect x="136" y="64" width="112" height="140" rx="10" fill={FILL} stroke={LINE} />
      <rect x="148" y="78" width="88" height="62" rx="6" fill={FAINT} />
      <path d="M148 140 L178 110 L198 126 L214 112 L236 140 Z" fill="rgba(var(--snow-rgb), 0.22)" />
      <rect x="148" y="152" width="64" height="7" rx="3.5" fill={SNOW} opacity="0.8" />
      <rect x="148" y="166" width="44" height="7" rx="3.5" fill={SNOW} opacity="0.45" />
      <rect x="148" y="182" width="40" height="13" rx="6.5" fill="none" stroke={GREEN} />
      <Tag x={136} y={54} text="1080 × 1350" />

      <rect x="266" y="92" width="112" height="112" rx="10" fill={FILL} stroke={LINE} />
      <text x="322" y="156" textAnchor="middle" fill={GREEN} fontSize="34" fontWeight="600" fontFamily="inherit">
        −30 %
      </text>
      <rect x="290" y="172" width="64" height="7" rx="3.5" fill={SNOW} opacity="0.5" />
      <Tag x={266} y={82} text="1080 × 1080" />

      <rect x="22" y="232" width="356" height="44" rx="8" fill={FILL} stroke={LINE} />
      <rect x="36" y="248" width="120" height="7" rx="3.5" fill={SNOW} opacity="0.75" />
      <rect x="36" y="261" width="80" height="5" rx="2.5" fill={SNOW} opacity="0.4" />
      <rect x="300" y="244" width="64" height="20" rx="10" fill={GREEN} />
      <Tag x={22} y={226} text="970 × 90" />
    </>
  );
}

function Social() {
  const cells = Array.from({ length: 9 }, (_, i) => i);
  return (
    <>
      {/* Telefon s profilem: příběhy, mřížka příspěvků a reakce. */}
      <rect x="128" y="20" width="144" height="262" rx="22" fill={FILL} stroke={LINE} />
      <rect x="176" y="30" width="48" height="6" rx="3" fill={FAINT} />
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={150 + i * 33} cy="62" r="11" fill="none" stroke={i === 0 ? GREEN : LINE} strokeWidth={i === 0 ? 2 : 1} />
      ))}
      {cells.map((i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const accent = i === 4;
        return (
          <rect
            key={i}
            x={142 + col * 40}
            y={86 + row * 40}
            width="36"
            height="36"
            rx="4"
            fill={accent ? GREEN : i % 2 ? FAINT : "rgba(var(--snow-rgb), 0.18)"}
            opacity={accent ? 0.9 : 1}
          />
        );
      })}
      <rect x="142" y="214" width="116" height="7" rx="3.5" fill={SNOW} opacity="0.7" />
      <rect x="142" y="228" width="80" height="6" rx="3" fill={SNOW} opacity="0.4" />

      {/* Reakce mimo telefon */}
      <g transform="translate(40 96)">
        <rect width="72" height="34" rx="17" fill={FILL} stroke={LINE} />
        <path d="M22 12c-3-4-9-2-9 3 0 4 9 9 9 9s9-5 9-9c0-5-6-7-9-3z" fill={GREEN} />
        <text x="40" y="22" fill={SNOW} fontSize="12" fontFamily="inherit">2,4k</text>
      </g>
      <g transform="translate(292 150)">
        <rect width="80" height="34" rx="17" fill={FILL} stroke={LINE} />
        <circle cx="18" cy="17" r="7" fill="none" stroke={SNOW} />
        <path d="M14 17h8M18 13v8" stroke={SNOW} strokeWidth="1.4" />
        <text x="32" y="22" fill={SNOW} fontSize="12" fontFamily="inherit">Sdílet</text>
      </g>
      <g transform="translate(46 196)">
        <rect width="66" height="26" rx="13" fill={GREEN} />
        <text x="33" y="17" textAnchor="middle" fill="var(--charcoal)" fontSize="11" fontWeight="600" fontFamily="inherit">Story</text>
      </g>
    </>
  );
}

function Brand() {
  return (
    <>
      {/* Konstrukce značky: mřížka, kružnice, vodicí linky a znak. */}
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={`v${i}`} x1={40 + i * 40} y1="34" x2={40 + i * 40} y2="194" stroke={FAINT} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={`h${i}`} x1="40" y1={34 + i * 40} x2="200" y2={34 + i * 40} stroke={FAINT} />
      ))}
      <circle cx="120" cy="114" r="64" fill="none" stroke={LINE} strokeDasharray="3 4" />
      <circle cx="120" cy="114" r="34" fill="none" stroke={LINE} />
      <line x1="40" y1="194" x2="200" y2="34" stroke={LINE} strokeDasharray="3 4" />
      <path d="M96 150 L120 70 L144 150 M106 122 H134" fill="none" stroke={GREEN} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      {[
        [56, 50],
        [184, 50],
        [184, 178],
        [56, 178],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill={GREEN} />
      ))}
      <Tag x={40} y={24} text="ZNAK · MŘÍŽKA 40" />

      {/* Barvy a písmo */}
      <g transform="translate(232 40)">
        <rect width="140" height="44" rx="10" fill={GREEN} />
        <rect y="54" width="140" height="44" rx="10" fill="rgba(var(--snow-rgb), 0.9)" />
        <rect y="108" width="140" height="44" rx="10" fill="rgba(var(--snow-rgb), 0.14)" stroke={LINE} />
        <text x="12" y="27" fill="var(--charcoal)" fontSize="11" fontWeight="600" letterSpacing="1" fontFamily="inherit">PRIMÁRNÍ</text>
        <text x="12" y="81" fill="var(--charcoal)" fontSize="11" fontWeight="600" letterSpacing="1" fontFamily="inherit">SVĚTLÁ</text>
        <text x="12" y="135" fill={SNOW} fontSize="11" fontWeight="600" letterSpacing="1" fontFamily="inherit">TMAVÁ</text>
      </g>
      <text x="232" y="250" fill={SNOW} fontSize="52" fontWeight="500" fontFamily="inherit">Aa</text>
      <rect x="312" y="218" width="60" height="6" rx="3" fill={SNOW} opacity="0.6" />
      <rect x="312" y="232" width="44" height="6" rx="3" fill={SNOW} opacity="0.35" />
      <rect x="40" y="222" width="160" height="40" rx="20" fill="none" stroke={LINE} />
      <text x="120" y="247" textAnchor="middle" fill={SNOW} fontSize="12" letterSpacing="2" fontFamily="inherit">BRAND MANUÁL</text>
    </>
  );
}

function Web() {
  return (
    <>
      {/* Okno prohlížeče: lišta, navigace, hero s tlačítkem a karty. */}
      <rect x="20" y="24" width="360" height="252" rx="14" fill={FILL} stroke={LINE} />
      <line x1="20" y1="52" x2="380" y2="52" stroke={LINE} />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={38 + i * 14} cy="38" r="4" fill={i === 0 ? GREEN : FAINT} />
      ))}
      <rect x="110" y="31" width="180" height="14" rx="7" fill={FAINT} />
      <rect x="40" y="68" width="40" height="8" rx="4" fill={SNOW} opacity="0.85" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={226 + i * 42} y="69" width="32" height="6" rx="3" fill={SNOW} opacity="0.4" />
      ))}
      <rect x="40" y="96" width="170" height="14" rx="7" fill={SNOW} opacity="0.9" />
      <rect x="40" y="118" width="130" height="14" rx="7" fill={GREEN} />
      <rect x="40" y="144" width="150" height="6" rx="3" fill={SNOW} opacity="0.4" />
      <rect x="40" y="166" width="72" height="24" rx="12" fill={GREEN} />
      <rect x="120" y="166" width="72" height="24" rx="12" fill="none" stroke={LINE} />
      <rect x="230" y="90" width="130" height="104" rx="10" fill={FAINT} />
      <path d="M230 194 L276 140 L304 168 L326 150 L360 194 Z" fill="rgba(var(--snow-rgb), 0.2)" />
      <circle cx="336" cy="114" r="10" fill={GREEN} opacity="0.85" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${40 + i * 110} 210)`}>
          <rect width="100" height="50" rx="8" fill={FILL} stroke={LINE} />
          <rect x="10" y="12" width="20" height="20" rx="6" fill={i === 1 ? GREEN : FAINT} />
          <rect x="38" y="15" width="50" height="6" rx="3" fill={SNOW} opacity="0.7" />
          <rect x="38" y="27" width="34" height="5" rx="2.5" fill={SNOW} opacity="0.35" />
        </g>
      ))}
      {/* Kurzor nad tlačítkem */}
      <path d="M100 176 l0 22 l6 -6 l5 10 l4 -2 l-5 -10 l8 0 z" fill={SNOW} stroke="var(--charcoal)" strokeWidth="1" />
    </>
  );
}

const SCENES: Record<ServiceVisualKind, () => React.JSX.Element> = { ads: Ads, social: Social, brand: Brand, web: Web };

export default function ServiceVisual({ kind, className, style }: { kind: ServiceVisualKind; className?: string; style?: CSSProperties }) {
  const Scene = SCENES[kind];
  return (
    <svg className={className} style={style} viewBox="0 0 400 300" role="img" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMax meet">
      <Scene />
    </svg>
  );
}
