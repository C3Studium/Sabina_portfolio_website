// Texty obou e-mailů z kontaktního formuláře — výchozí znění a popis polí
// pro Studio (obrazovka E-maily). Jedno místo pro šablony (src/emails),
// katalog (lib/mail/catalog) i náhled `pnpm email`.
//
// Zástupné symboly v textech doplňuje šablona (`fill` níže):
//   {jméno}    křestní jméno klienta (potvrzení) / celé jméno (poptávka)
//   {jak}      „zavolám vám" / „napíšu vám e-mail" / „napíšu vám na WhatsApp"
//   {co}       co klient potřebuje (odpověď na „Co potřebujete")
//   {kontakt}  telefon · e-mail
//
// Tenhle soubor NESMÍ importovat nic serverového (valecms/server): čte ho
// i náhledový server React Email, který běží mimo Next.

export type MailField = { key: string; label: string; default: string; hint?: string; lines?: boolean };

export type MailTexts = Record<string, string>;

/** Potvrzení klientovi — chodí na e-mail z formuláře. */
export const CONFIRMATION = {
  key: "poptavka-potvrzeni",
  title: "Potvrzení poptávky — klientovi",
  subject: "Poptávka dorazila — ozvu se do 24 hodin",
  fields: [
    { key: "headline", label: "Nadpis (zeleně)", default: "Díky, {jméno}.", hint: "{jméno} doplní web; bez jména zůstane jen „Díky.“" },
    { key: "headlineRest", label: "Nadpis — druhý řádek", default: "Poptávka je u mě." },
    {
      key: "lead",
      label: "Úvod",
      default: "Projdu, co jste vybrali, a {jak} obvykle do 24 hodin — s návrhem, jak bych postupovala, a co od vás budu potřebovat.",
      hint: "{jak} = zavolám vám / napíšu vám e-mail / napíšu vám na WhatsApp — podle toho, co klient zvolil.",
      lines: true,
    },
    {
      key: "note",
      label: "Bílý lístek",
      default: "Nemusíte nic chystat. Když vás mezitím napadne, co je pro vás důležité, stačí na tenhle e-mail odpovědět.",
      lines: true,
    },
    { key: "summary", label: "Nadpis shrnutí", default: "Co jste mi poslali" },
    { key: "button", label: "Tlačítko", default: "Mezitím ukázky prací", hint: "Vede na stránku Portfolio." },
    {
      key: "footer",
      label: "Drobný text dole",
      default: "Tohle je automatické potvrzení, že poptávka dorazila. Odpověď od Sabiny přijde zvlášť.",
      lines: true,
    },
  ] satisfies MailField[],
};

/** Nová poptávka Sabině — chodí na CONTACT_TO. */
export const INQUIRY = {
  key: "poptavka-sabine",
  title: "Nová poptávka — vám",
  subject: "Poptávka: {jméno} — {co}",
  fields: [
    { key: "kicker", label: "Štítek nahoře", default: "Nová poptávka", hint: "Web za něj doplní datum a čas." },
    {
      key: "lead",
      label: "Úvod",
      default: "Chce, abyste se ozvala: {jak} — na {kontakt}.",
      hint: "{jak} = zavolat / napsat e-mail / napsat na WhatsApp, {kontakt} = telefon a e-mail klienta.",
      lines: true,
    },
    { key: "noteTitle", label: "Nadpis poznámky od klienta", default: "Poznámka od klienta" },
    { key: "answers", label: "Nadpis odpovědí", default: "Odpovědi" },
    {
      key: "footer",
      label: "Drobný text dole",
      default: "Návštěvník dostal potvrzení na svůj e-mail. Souhlas se zpracováním údajů zaškrtl.",
      lines: true,
    },
  ] satisfies MailField[],
};

/** Výchozí texty z popisu polí — pro šablonu bez přepisu (náhled, záloha). */
export const defaultsOf = (fields: MailField[]): MailTexts => Object.fromEntries(fields.map((f) => [f.key, f.default]));

/**
 * `{jméno}` → hodnota. Stejné chování jako `fill` z valecms/server/mails —
 * opsané sem (tři řádky), protože tenhle modul nesmí sahat na server.
 * Prázdná hodnota symbol odstraní i s čárkou/pomlčkou před ním, aby nezůstalo
 * „Díky, ." nebo „Poptávka: Jana — ".
 */
export const fill = (template: string, vars: Record<string, string | undefined>): string =>
  template
    .replace(/(\s*[,—–-]?\s*)\{([^{}]+)\}/g, (match, lead: string, name: string) => {
      const key = name.trim();
      if (!(key in vars)) return match;
      const value = (vars[key] ?? "").trim();
      return value ? `${lead}${value}` : "";
    })
    .replace(/\s{2,}/g, " ")
    .trim();

/** Víceřádkové pole na odstavce (Enter ve Studiu = nový odstavec). */
export const paragraphs = (text: string): string[] =>
  text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
