// Nová poptávka pro Sabinu: kdo, jak se ozvat, co vybral, poznámka. Odpověď
// na e-mail jde rovnou návštěvníkovi (Reply-To nastavuje lib/mail/contact).
//
// Texty jdou přepsat ve Studiu (E-maily) — `texts` jsou přepisy nad výchozím
// zněním z ./texts.ts; bez nich (náhled `pnpm email`) platí výchozí.

import { Section, Text } from "@react-email/components";
import { ACCENT, Button, Headline, Kicker, Lead, Note, Rows, SNOW_SOFT, Shell } from "./shell";
import { INQUIRY, defaultsOf, fill, paragraphs, type MailTexts } from "./texts";
import { emailOf, type ContactPayload } from "./types";

const HOW: Record<string, string> = {
  "Zavolejte mi": "zavolat",
  "Napište e-mail": "napsat e-mail",
  "Zpráva na WhatsApp": "napsat na WhatsApp",
};

export default function ContactInquiry({
  name,
  phone,
  email: emailField,
  contact,
  channel,
  note,
  answers,
  sentAt,
  texts,
}: ContactPayload & { sentAt?: string; texts?: MailTexts }) {
  const t = { ...defaultsOf(INQUIRY.fields), ...texts };
  const email = emailOf(emailField) ?? emailOf(contact);
  const what = answers.find((a) => a.key === "what")?.values.join(", ");
  const when = answers.find((a) => a.key === "when")?.values[0];
  const vars = { jméno: name, jak: HOW[channel] ?? channel.toLowerCase(), co: what, kontakt: contact };
  const lead = paragraphs(fill(t.lead, vars));
  const footer = paragraphs(fill(t.footer, vars));
  return (
    <Shell preview={`${name} — ${what || "nová poptávka"}${when ? ` · ${when.toLowerCase()}` : ""}`}>
      <Kicker no="01">
        {fill(t.kicker, vars)}
        {sentAt ? ` · ${sentAt}` : ""}
      </Kicker>
      <Headline accent={name} rest={what || "Poptávka z webu"} />
      {lead.map((line, i) => (
        <Lead key={i}>{line}</Lead>
      ))}

      {note.trim() ? (
        <Note>
          <span style={{ display: "block", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.6, marginBottom: 6 }}>{fill(t.noteTitle, vars)}</span>
          {note.trim()}
        </Note>
      ) : null}

      <Kicker no="02">{fill(t.answers, vars)}</Kicker>
      <Rows
        rows={[
          { label: "Jméno", value: name },
          ...(phone.trim() ? [{ label: "Telefon", value: phone.trim() }] : []),
          ...(email ? [{ label: "E-mail", value: email }] : []),
          ...answers.map((a) => ({ label: a.label, value: a.values.join(", ") || "—" })),
        ]}
      />

      <Section>
        {email ? <Button href={`mailto:${email}?subject=${encodeURIComponent("Re: vaše poptávka")}`}>Odpovědět</Button> : null}
        {/^[+\d][\d\s()-]{6,}$/.test(phone.trim()) ? <Button href={`tel:${phone.replace(/[\s()-]/g, "")}`}>Zavolat</Button> : null}
      </Section>
      {footer.map((line, i) => (
        <Text key={i} style={{ margin: i ? "6px 0 0" : "22px 0 0", fontSize: 13, lineHeight: "21px", color: SNOW_SOFT }}>
          {i === footer.length - 1 ? (
            <>
              {line.replace(/zaškrtl\.?$/, "")}
              {/zaškrtl\.?$/.test(line) ? <span style={{ color: ACCENT }}>zaškrtl.</span> : null}
            </>
          ) : (
            line
          )}
        </Text>
      ))}
    </Shell>
  );
}

/** Ukázková data pro náhled (`pnpm email` i obrazovka E-maily ve Studiu). */
ContactInquiry.PreviewProps = {
  name: "Jana Nováková",
  phone: "+420 777 123 456",
  email: "jana@priklad.cz",
  contact: "+420 777 123 456 · jana@priklad.cz",
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
