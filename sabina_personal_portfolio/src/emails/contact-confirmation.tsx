// Potvrzení pro návštěvníka: poptávka dorazila, co bude dál, shrnutí toho,
// co vybral. Odchází jen tehdy, když nechal e-mail (types.ts emailOf).

import { Section, Text } from "@react-email/components";
import { Button, Headline, Kicker, Lead, Note, Rows, SNOW_SOFT, Shell, siteUrl } from "./shell";
import { firstName, type ContactPayload } from "./types";

const NEXT: Record<string, string> = {
  "Zavolejte mi": "zavolám vám",
  "Napište e-mail": "napíšu vám e-mail",
  "Zpráva na WhatsApp": "napíšu vám na WhatsApp",
};

export default function ContactConfirmation({ name, contact, channel, note, answers }: ContactPayload) {
  const first = firstName(name);
  const next = NEXT[channel] ?? "ozvu se vám";
  return (
    <Shell preview={`Díky${first ? `, ${first}` : ""} — poptávka je u mě, ${next} obvykle do 24 hodin.`}>
      <Kicker no="01">Potvrzení</Kicker>
      <Headline accent={`Díky${first ? `, ${first}` : ""}.`} rest="Poptávka je u mě." />
      <Lead>
        Projdu, co jste vybrali, a <b>{next} obvykle do 24 hodin</b> — s návrhem, jak bych postupovala, a co od vás budu potřebovat.
      </Lead>

      <Note>
        Nemusíte nic chystat. Když vás mezitím napadne, co je pro vás důležité, stačí na tenhle e-mail odpovědět.
      </Note>

      <Kicker no="02">Co jste mi poslali</Kicker>
      <Rows
        rows={[
          ...answers.map((a) => ({ label: a.label, value: a.values.join(", ") || "—" })),
          { label: "Kontakt", value: `${contact} · ${channel.toLowerCase()}` },
          ...(note.trim() ? [{ label: "Poznámka", value: note.trim() }] : []),
        ]}
      />

      <Section>
        <Button href={`${siteUrl()}/projects`}>Mezitím ukázky prací</Button>
      </Section>
      <Text style={{ margin: "22px 0 0", fontSize: 13, lineHeight: "21px", color: SNOW_SOFT }}>
        Tohle je automatické potvrzení, že poptávka dorazila. Odpověď od Sabiny přijde zvlášť.
      </Text>
    </Shell>
  );
}

/** Ukázková data pro náhled (`pnpm email`). */
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
