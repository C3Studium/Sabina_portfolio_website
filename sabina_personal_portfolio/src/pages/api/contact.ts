// POST /api/contact — poptávka z kontaktního modálu (contact-modal/brief.tsx).
//
// Ověří tvar, pošle oba e-maily (lib/mail/contact) a odpoví { ok }. Chyby
// pošty se nevracejí návštěvníkovi slovy dodavatele — jen „nepodařilo se",
// podrobnosti do logu serveru. Jednoduchá ochrana: past na roboty (pole
// `website` musí zůstat prázdné) a strop na délky.

import type { NextApiRequest, NextApiResponse } from "next";
import { sendContactMails } from "@/lib/mail/contact";
import type { ContactAnswer, ContactPayload } from "@/emails/types";

const LIMIT = { short: 160, note: 2000, answers: 8, values: 12 };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

const answersOf = (v: unknown): ContactAnswer[] =>
  Array.isArray(v)
    ? v.slice(0, LIMIT.answers).flatMap((a) => {
        if (!a || typeof a !== "object") return [];
        const { key, label, values } = a as Record<string, unknown>;
        const k = text(key, 40);
        const l = text(label, LIMIT.short);
        if (!k || !l) return [];
        return [{ key: k, label: l, values: Array.isArray(values) ? values.slice(0, LIMIT.values).map((x) => text(x, LIMIT.short)).filter(Boolean) : [] }];
      })
    : [];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false });
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  // Past na roboty: skryté pole, které člověk nevyplní.
  if (text(body.website, 10)) return res.status(200).json({ ok: true });

  const payload: ContactPayload = {
    name: text(body.name, LIMIT.short),
    contact: text(body.contact, LIMIT.short),
    channel: text(body.channel, 60),
    note: typeof body.note === "string" ? body.note.trim().slice(0, LIMIT.note) : "",
    answers: answersOf(body.answers),
  };
  if (payload.name.length < 2 || payload.contact.length < 5 || body.agreed !== true) {
    return res.status(400).json({ ok: false, error: "invalid" });
  }

  try {
    const result = await sendContactMails(payload);
    if (!result.sent) {
      console.error("[contact] neodesláno:", result.error);
      return res.status(502).json({ ok: false, error: "mail" });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[contact] chyba:", e);
    return res.status(502).json({ ok: false, error: "mail" });
  }
}
