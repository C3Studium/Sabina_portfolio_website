// Společná kostra e-mailů webu — vzhled případové studie na telefonu na
// výšku: uhlový podklad, sněhový text, zelený akcent, nadpis verzálkami
// s prvním řádkem zeleně, „kicker" (linka · číslo · tracked popisek) a bílé
// lístky s poznámkou se zelenou páskou nahoře.
//
// Jen tabulky a inline styly (@react-email/components): e-mailové klienty
// neumí grid, vlastní vlastnosti ani rotace. Šířka 560 px, na telefonu
// 100 %. Barvy stejné jako lib/palette.ts (SNOW, ACCENT, INK) — měnit obojí.
//
// Náhled: `pnpm email` (React Email, http://localhost:3030).

import type { ReactNode } from "react";
import { Body, Column, Container, Font, Head, Html, Img, Link, Preview, Row, Section, Text } from "@react-email/components";

export const SNOW = "#f2f7ff";
export const ACCENT = "#bec948";
export const INK = "#161b22";
/** Tmavší plocha pod lístky a řádky (uhlová o stupeň výš). */
export const INK_SOFT = "#1d232c";
/** Ztlumený text (sněhová na 60 %) — e-mail neumí rgba spolehlivě, proto plná barva. */
export const SNOW_SOFT = "#aab3c2";
export const LINE = "#2d3542";

export const FONT = "Poppins, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Ostrá doména — logo a odkazy v e-mailu musí vést sem, nikdy na localhost. */
const PRODUCTION = "https://www.sgrafika.cz";

/**
 * Adresa webu pro odkazy a logo. Z prostředí, ale `localhost` (vývoj, nebo
 * `.env.local` zkopírovaný do Vercelu) se nikdy nepošle: v cizí schránce by
 * logo bylo rozbitý obrázek a tlačítka by vedla nikam.
 */
export const siteUrl = () => {
  const own = String(process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  return !own || /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i.test(own) ? PRODUCTION : own;
};

export function Shell({ preview, children }: { preview: string; children: ReactNode }) {
  const site = siteUrl();
  return (
    <Html lang="cs">
      <Head>
        <Font
          fontFamily="Poppins"
          fallbackFontFamily={["Helvetica", "Arial", "sans-serif"]}
          webFont={{ url: "https://fonts.gstatic.com/s/poppins/v21/pxiEyp8kv8JHgFVrJJfecg.woff2", format: "woff2" }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Poppins"
          fallbackFontFamily={["Helvetica", "Arial", "sans-serif"]}
          webFont={{ url: "https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLGT9Z1xlFQ.woff2", format: "woff2" }}
          fontWeight={600}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: INK, color: SNOW, fontFamily: FONT }}>
        <Container style={{ width: "100%", maxWidth: 560, margin: "0 auto", padding: "28px 20px 36px" }}>
          {/* Značka — jako hlavička webu: „S" zeleně, jméno verzálkami. */}
          <Section style={{ paddingBottom: 26 }}>
            <Row>
              <Column style={{ width: 52, verticalAlign: "middle" }}>
                <Link href={site}>
                  <Img src={`${site}/assets/rest/logo.png`} alt="S" width="44" height="44" style={{ display: "block" }} />
                </Link>
              </Column>
              <Column style={{ verticalAlign: "middle" }}>
                <Link href={site} style={{ textDecoration: "none", color: SNOW }}>
                  <Text style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: "0.22em", lineHeight: "18px", color: ACCENT }}>SABINA</Text>
                  <Text style={{ margin: 0, fontSize: 10, letterSpacing: "0.3em", lineHeight: "14px", color: SNOW }}>HUDRMENTOVÁ</Text>
                </Link>
              </Column>
            </Row>
          </Section>
          {children}
          <Footer />
        </Container>
      </Body>
    </Html>
  );
}

/** Linka · číslo · popisek — záhlaví oddílu jako ve studii („— 02 PRO RODIČE"). */
export function Kicker({ no, children }: { no: string; children: ReactNode }) {
  return (
    <Row style={{ marginTop: 8, marginBottom: 10 }}>
      <Column style={{ width: 30, verticalAlign: "middle" }}>
        <div style={{ width: 22, height: 2, backgroundColor: ACCENT }} />
      </Column>
      <Column style={{ verticalAlign: "middle" }}>
        <Text style={{ margin: 0, fontSize: 12, letterSpacing: "0.26em", lineHeight: "16px", color: SNOW_SOFT }}>
          <span style={{ color: SNOW, fontWeight: 600, letterSpacing: "0.18em" }}>{no}</span>
          &nbsp;&nbsp;{children}
        </Text>
      </Column>
    </Row>
  );
}

/** Nadpis verzálkami, první řádek zeleně. */
export function Headline({ accent, rest }: { accent: string; rest?: string }) {
  return (
    <Text style={{ margin: "0 0 14px", fontSize: 30, lineHeight: "34px", fontWeight: 400, textTransform: "uppercase", color: SNOW }}>
      <span style={{ color: ACCENT }}>{accent}</span>
      {rest ? (
        <>
          <br />
          {rest}
        </>
      ) : null}
    </Text>
  );
}

/** Odstavec; tučné úseky dává volající přes <b>. */
export function Lead({ children }: { children: ReactNode }) {
  return <Text style={{ margin: "0 0 18px", fontSize: 16, lineHeight: "26px", color: SNOW }}>{children}</Text>;
}

/** Bílý lístek s poznámkou a zelenou páskou nahoře — jako .note ve studii. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <Section style={{ margin: "10px 0 24px" }}>
      <Row>
        <Column align="center">
          <div style={{ width: 62, height: 10, margin: "0 auto", backgroundColor: ACCENT, opacity: 0.85 }} />
        </Column>
      </Row>
      <Row>
        <Column>
          <div style={{ backgroundColor: SNOW, color: INK, padding: "16px 18px 17px", borderRadius: 3, fontSize: 15, lineHeight: "24px" }}>{children}</div>
        </Column>
      </Row>
    </Section>
  );
}

/** Řádky popisek – hodnota (shrnutí poptávky), oddělené vlasovou linkou. */
export function Rows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <Section style={{ margin: "4px 0 22px" }}>
      {rows.map((row, i) => (
        <Row key={i} style={{ borderTop: `1px solid ${LINE}` }}>
          <Column style={{ width: "38%", padding: "11px 12px 11px 0", verticalAlign: "top" }}>
            <Text style={{ margin: 0, fontSize: 11, letterSpacing: "0.2em", lineHeight: "18px", textTransform: "uppercase", color: SNOW_SOFT }}>{row.label}</Text>
          </Column>
          <Column style={{ padding: "10px 0", verticalAlign: "top" }}>
            <Text style={{ margin: 0, fontSize: 15, lineHeight: "22px", color: SNOW }}>{row.value}</Text>
          </Column>
        </Row>
      ))}
      <div style={{ borderTop: `1px solid ${LINE}` }} />
    </Section>
  );
}

/** Zelené tlačítko s šipkou — jako výzvy webu. */
export function Button({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-block",
        padding: "12px 20px",
        borderRadius: 999,
        backgroundColor: ACCENT,
        color: INK,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        textDecoration: "none",
      }}
    >
      {children}&nbsp;&nbsp;→
    </Link>
  );
}

function Footer() {
  const site = siteUrl();
  return (
    <Section style={{ marginTop: 34, paddingTop: 18, borderTop: `1px solid ${LINE}` }}>
      <Text style={{ margin: 0, fontSize: 12, lineHeight: "20px", color: SNOW_SOFT }}>
        Sabina Hudrmentová · grafický design ·{" "}
        <Link href={site} style={{ color: ACCENT, textDecoration: "none" }}>
          {site.replace(/^https?:\/\//, "")}
        </Link>
      </Text>
      <Text style={{ margin: "6px 0 0", fontSize: 11, lineHeight: "18px", color: SNOW_SOFT }}>
        Tento e-mail přišel z kontaktního formuláře na webu. Na odpověď stačí odpovědět na něj.
      </Text>
    </Section>
  );
}
