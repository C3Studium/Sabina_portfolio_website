// Odeslání poptávky z kontaktního formuláře. SERVER ONLY (pages/api/contact).
//
// Dva e-maily přes Resend: Sabině (nová poptávka, Reply-To = návštěvník)
// a návštěvníkovi potvrzení — jen když nechal e-mail. Šablony jsou v
// src/emails (React Email), vykreslí se do HTML i prostého textu.
//
// Prostředí:
//   RESEND_API_KEY      klíč Resendu (sdílený s CMS)
//   CMS_MAIL_FROM       odesílatel, např. "Sabina Hudrmentová <sabina@sgrafika.cz>"
//                       (náhrada: RESEND_FROM_EMAIL); doména musí být v Resendu ověřená
//   CONTACT_TO          kam chodí poptávky; bez něj CMS_ADMIN_EMAIL
//
// Bez klíče nebo odesílatele se nic neposílá a volající dostane `sent: false`
// — formulář nemá spadnout kvůli poště, ale ani lhát, že poptávka odešla.

import { render } from "@react-email/render";
import { createElement } from "react";
import { Resend } from "resend";
import { mailTexts } from "@c3studium/valecms/server/mails.js";
import ContactConfirmation from "@/emails/contact-confirmation";
import ContactInquiry from "@/emails/contact-inquiry";
import { CONFIRMATION, INQUIRY, fill } from "@/emails/texts";
import { emailOf, type ContactPayload } from "@/emails/types";
import { mails } from "./catalog";

const env = (name: string) => String(process.env[name] || "").trim();

export const mailReady = () => Boolean(env("RESEND_API_KEY") && (env("CMS_MAIL_FROM") || env("RESEND_FROM_EMAIL")) && (env("CONTACT_TO") || env("CMS_ADMIN_EMAIL")));

const stamp = () =>
  new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());

export type SendResult = { sent: boolean; owner?: string; customer?: string; error?: string };

export async function sendContactMails(payload: ContactPayload): Promise<SendResult> {
  if (!mailReady()) return { sent: false, error: "mail not configured" };
  const resend = new Resend(env("RESEND_API_KEY"));
  const from = env("CMS_MAIL_FROM") || env("RESEND_FROM_EMAIL");
  const to = env("CONTACT_TO") || env("CMS_ADMIN_EMAIL");
  const customer = emailOf(payload.email) ?? emailOf(payload.contact);
  const sentAt = stamp();

  // Texty ze Studia (E-maily) — přepis nad výchozím zněním z src/emails/texts.
  // Bez databáze přijde výchozí; obě čtení naráz, ať poptávka nečeká dvakrát.
  const [ownerCopy, customerCopy] = await Promise.all([mailTexts(mails, INQUIRY.key), mailTexts(mails, CONFIRMATION.key)]);

  const inquiry = createElement(ContactInquiry, { ...payload, sentAt, texts: ownerCopy.texts });
  const what = payload.answers.find((a) => a.key === "what")?.values.join(", ");
  const owner = await resend.emails.send({
    from,
    to,
    replyTo: customer ?? undefined,
    subject: fill(ownerCopy.subject, { jméno: payload.name, co: what }),
    html: await render(inquiry),
    text: await render(inquiry, { plainText: true }),
  });
  if (owner.error) return { sent: false, error: owner.error.message };

  let customerId: string | undefined;
  if (customer) {
    const confirmation = createElement(ContactConfirmation, { ...payload, texts: customerCopy.texts });
    const res = await resend.emails.send({
      from,
      to: customer,
      replyTo: to,
      subject: fill(customerCopy.subject, { jméno: payload.name.trim().split(/\s+/)[0] }),
      html: await render(confirmation),
      text: await render(confirmation, { plainText: true }),
    });
    // Potvrzení je doplněk: když neodejde, poptávka u Sabiny stejně je.
    customerId = res.data?.id;
  }
  return { sent: true, owner: owner.data?.id, customer: customerId };
}
