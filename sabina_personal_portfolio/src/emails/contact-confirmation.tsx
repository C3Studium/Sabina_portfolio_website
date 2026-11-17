// Potvrzení pro návštěvníka: poptávka dorazila, co bude dál, shrnutí toho,
// co vybral. Odchází jen tehdy, když nechal e-mail (types.ts emailOf).
//
// Texty jdou přepsat ve Studiu (E-maily) — `texts` jsou přepisy nad výchozím
// zněním z ./texts.ts; bez nich (náhled `pnpm email`) platí výchozí.

import { Section, Text } from "@react-email/components";
import { Button, Headline, Kicker, Lead, Note, Rows, SNOW_SOFT, Shell, siteUrl } from "./shell";
import { CONFIRMATION, defaultsOf, fill, paragraphs, type MailTexts } from "./texts";
import { firstName, type ContactPayload } from "./types";

const HOW: Record<string, string> = {
  "Zavolejte mi": "zavolám vám",
  "Napište e-mail": "napíšu vám e-mail",
  "Zpráva na WhatsApp": "napíšu vám na WhatsApp",
};

export default function ContactConfirmation({ name, contact, channel, note, answers, texts }: ContactPayload & { texts?: MailTexts }) {
  const t = { ...defaultsOf(CONFIRMATION.fields), ...texts };
  const vars = { jméno: firstName(name), jak: HOW[channel] ?? "ozvu se vám" };
  const headline = fill(t.headline, vars);
  const lead = paragraphs(fill(t.lead, vars));
  const noteLines = paragraphs(fill(t.note, vars));
  const footer = paragraphs(fill(t.footer, vars));
  return (
    <Shell preview={`${headline} ${fill(t.headlineRest, vars)}`.trim()}>
      <Kicker no="01">Potvrzení</Kicker>
      <Headline accent={headline} rest={fill(t.headlineRest, vars)} />
      {lead.map((line, i) => (
        <Lead key={i}>{line}</Lead>
      ))}

      {noteLines.length ? (
        <Note>
          {noteLines.map((line, i) => (
            <span key={i} style={{ display: "block", marginTop: i ? 8 : 0 }}>
              {line}
            </span>
          ))}
        </Note>
      ) : null}

      <Kicker no="02">{fill(t.summary, vars)}</Kicker>
      <Rows
        rows={[
          ...answers.map((a) => ({ label: a.label, value: a.values.join(", ") || "—" })),
          { label: "Kontakt", value: `${contact} · ${channel.toLowerCase()}` },
          ...(note.trim() ? [{ label: "Poznámka", value: note.trim() }] : []),
        ]}
      />

      {t.button.trim() ? (
        <Section>
          <Button href={`${siteUrl()}/projects`}>{fill(t.button, vars)}</Button>
        </Section>
      ) : null}
      {footer.map((line, i) => (
        <Text key={i} style={{ margin: i ? "6px 0 0" : "22px 0 0", fontSize: 13, lineHeight: "21px", color: SNOW_SOFT }}>
          {line}
        </Text>
      ))}
    </Shell>
  );
}

/** Ukázková data pro náhled (`pnpm email` i obrazovka E-maily ve Studiu). */
ContactConfirmation.PreviewProps = {
  name: "Jana Nováková",
  phone: "+420 777 123 456",
  email: "jana@priklad.cz",
  contact: "+420 777 123 456 · jana@priklad.cz",
  channel: "Napište e-mail",
  note: "Spouštíme nový e-shop s dětským oblečením, potřebujeme bannery a sociální sítě na start.",
  answers: [
    { key: "who", label: "Kdo jste", values: ["E-shop"] },
    { key: "what", label: "Co potřebujete", values: ["Bannerová kampaň", "Obsah pro sociální sítě"] },
    { key: "have", label: "Podklady", values: ["Logo a barvy značky", "Fotky produktů"] },
    { key: "when", label: "Termín", values: ["Do měsíce"] },
    { key: "budget", label: "Rozpočet", values: ["10–30 tisíc Kč"] },
  ],
} satisfies ContactPayload;
