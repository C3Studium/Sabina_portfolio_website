// Data poptávky z kontaktního formuláře (contact-modal/brief.tsx) tak, jak
// je dostane API (/api/contact) a oba e-maily. Odpovědi nesou popisek
// otázky, aby server otázky nemusel znát.

export type ContactAnswer = {
  key: string;
  label: string;
  values: string[];
};

export type ContactPayload = {
  name: string;
  /** Telefon, nebo e-mail — co návštěvník napsal. */
  contact: string;
  /** „Zavolejte mi" / „Napište e-mail" / „Zpráva na WhatsApp". */
  channel: string;
  note: string;
  answers: ContactAnswer[];
};

/** Vypadá kontakt jako e-mail? Pak dostane potvrzení a jde na něj odpovědět. */
export const emailOf = (contact: string): string | null => {
  const v = contact.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v : null;
};

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || "";
