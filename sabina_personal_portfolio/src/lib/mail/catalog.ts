// Katalog e-mailů webu pro Studio (obrazovka E-maily). SERVER ONLY.
//
// Deklaruje, které e-maily web posílá a která jejich pole jde přepsat;
// výchozí znění je v src/emails/texts.ts (sdílí ho šablona i náhled).
// Náhled pro Studio vykreslí šablonu se vzorovými daty (PreviewProps) a
// s texty z formuláře. Odesílání (lib/mail/contact.ts) si bere přepisy přes
// `mailTexts(mails, klíč)`.
//
// API routa ho předává: pages/api/cms/[...route].ts → { mails }.

import { createElement } from "react";
import { render } from "@react-email/render";
import { defineMails } from "@c3studium/valecms/server/mails.js";
import ContactConfirmation from "@/emails/contact-confirmation";
import ContactInquiry from "@/emails/contact-inquiry";
import { CONFIRMATION, INQUIRY, type MailTexts } from "@/emails/texts";

export const mails = defineMails([
  {
    key: CONFIRMATION.key,
    title: CONFIRMATION.title,
    audience: "customer",
    subject: CONFIRMATION.subject,
    fields: CONFIRMATION.fields,
    note: "Shrnutí odpovědí, kontakt a poznámku doplní web z formuláře.",
    preview: (texts: MailTexts) => render(createElement(ContactConfirmation, { ...ContactConfirmation.PreviewProps, texts })),
  },
  {
    key: INQUIRY.key,
    title: INQUIRY.title,
    audience: "owner",
    subject: INQUIRY.subject,
    fields: INQUIRY.fields,
    note: "V předmětu doplní web {jméno} a {co}; odpovědi, kontakt a tlačítka Odpovědět / Zavolat jsou z formuláře.",
    preview: (texts: MailTexts) => render(createElement(ContactInquiry, { ...ContactInquiry.PreviewProps, texts })),
  },
]);
