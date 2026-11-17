// Nová poptávka pro Sabinu: kdo, jak se ozvat, co vybral, poznámka. Odpověď
// na e-mail jde rovnou návštěvníkovi (Reply-To nastavuje lib/mail/contact).

import { Section, Text } from "@react-email/components";
import { ACCENT, Button, Headline, Kicker, Lead, Note, Rows, SNOW_SOFT, Shell } from "./shell";
import { emailOf, type ContactPayload } from "./types";

export default function ContactInquiry({ name, contact, channel, note, answers, sentAt }: ContactPayload & { sentAt?: string }) {
  const email = emailOf(contact);
  const what = answers.find((a) => a.key === "what")?.values.join(", ");
  const when = answers.find((a) => a.key === "when")?.values[0];
  return (
    <Shell preview={`${name} — ${what || "nová poptávka"}${when ? ` · ${when.toLowerCase()}` : ""}`}>
      <Kicker no="01">Nová poptávka{sentAt ? ` · ${sentAt}` : ""}</Kicker>
      <Headline accent={name} rest={what || "Poptávka z webu"} />
      <Lead>
        Chce, abyste se ozvala: <b>{channel.toLowerCase()}</b>
        {email ? (
          <>
            {" "}
            — na <b>{email}</b>.
          </>
        ) : (
          <>
            {" "}
            — <b>{contact}</b>.
          </>
        )}
      </Lead>

      {note.trim() ? (
        <Note>
          <span style={{ display: "block", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.6, marginBottom: 6 }}>Poznámka od klienta</span>
          {note.trim()}
        </Note>
      ) : null}

      <Kicker no="02">Odpovědi</Kicker>
      <Rows rows={[{ label: "Jméno", value: name }, { label: "Kontakt", value: contact }, ...answers.map((a) => ({ label: a.label, value: a.values.join(", ") || "—" }))]} />

      <Section>
        {email ? <Button href={`mailto:${email}?subject=${encodeURIComponent("Re: vaše poptávka")}`}>Odpovědět</Button> : null}
        {!email && /^[+\d][\d\s()-]{6,}$/.test(contact.trim()) ? <Button href={`tel:${contact.replace(/[\s()-]/g, "")}`}>Zavolat</Button> : null}
      </Section>
      <Text style={{ margin: "22px 0 0", fontSize: 13, lineHeight: "21px", color: SNOW_SOFT }}>
        Návštěvník dostal potvrzení{email ? "" : " jen na obrazovce (nechal telefon, ne e-mail)"}. Souhlas se zpracováním údajů{" "}
        <span style={{ color: ACCENT }}>zaškrtl</span>.
      </Text>
    </Shell>
  );
}

/** Ukázková data pro náhled (`pnpm email`). */
ContactInquiry.PreviewProps = {
  name: "Jana Nováková",
  contact: "jana@priklad.cz",
  channel: "Napište e-mail",
  note: "Spouštíme nový e-shop s dětským oblečením, potřebujeme bannery a sociální sítě na start.",
  sentAt: "17. 11. 2026 18:42",
  answers: [
    { key: "who", label: "Kdo jste", values: ["E-shop"] },
    { key: "what", label: "Co potřebujete", values: ["Bannerová kampaň", "Obsah pro sociální sítě"] },
    { key: "have", label: "Podklady", values: ["Logo a barvy značky", "Fotky produktů"] },
    { key: "when", label: "Termín", values: ["Do měsíce"] },
    { key: "budget", label: "Rozpočet", values: ["10–30 tisíc Kč"] },
  ],
} satisfies ContactPayload & { sentAt: string };
