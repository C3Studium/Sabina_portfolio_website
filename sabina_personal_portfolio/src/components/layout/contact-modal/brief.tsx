// Poptávka v krocích — místo formuláře v kontaktním modálu.
//
// Návštěvník nic nevypisuje: v pěti krocích kliká na možnosti (kdo je, co
// potřebuje, co už má, kdy a za kolik), v šestém nechá jméno a kontakt
// a vidí shrnutí. Jedna volba posune dál sama, víc voleb potvrdí
// „Pokračovat". Na shrnutí jde každá odpověď kliknutím upravit.
//
// Proč tyhle otázky: přesně tohle se grafička jinak doptává na prvním
// hovoru — typ klienta (jak velký projekt a kdo schvaluje), druh práce,
// stav podkladů (logo, fotky, texty — určuje rozsah i cenu), termín
// a rozpočet. S nimi může první odpověď rovnou obsahovat návrh postupu.
//
// Odeslání: POST /api/contact (lib/mail/contact) — Sabině poptávka, návštěvníkovi
// potvrzení, když nechal e-mail. Pak shrnutí na obrazovce; při chybě zůstane
// formulář s hláškou a jde to zkusit znovu.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { editableDoc } from "@c3studium/valecms/edit";
import type { BriefContact, BriefStep } from "@/lib/site/brief";
import base from "./styles.module.scss";
import styles from "./brief.module.scss";
import { OptionIcon } from "./brief-icons";

type Option = { label: string; icon?: string };

type Question = {
  /** Id dokumentu `briefStep` — jen v rámu Studia (anotace). */
  id?: string;
  key: string;
  label: string;
  title: string;
  hint: string;
  multi?: boolean;
  options: Option[];
};

// Otázky z kódu — záloha, dokud modul „Poptávka" ve Studiu nemá kroky.
const fallbackQuestions = (types: string[]): Question[] =>
  FALLBACK_QUESTIONS(types).map((q) => ({ ...q, options: q.options.map((label) => ({ label })) }));

const FALLBACK_QUESTIONS = (types: string[]) => [
  {
    key: "who",
    label: "Kdo jste",
    title: "Pro koho budu pracovat?",
    hint: "Ať vím, jak velký projekt to bude a kdo bude schvalovat.",
    options: ["Firma", "E-shop", "Startup", "Agentura", "Osobní značka", "Něco jiného"],
  },
  {
    key: "what",
    label: "Co potřebujete",
    title: "S čím vám mám pomoct?",
    hint: "Klidně víc věcí najednou.",
    multi: true,
    options: types,
  },
  {
    key: "have",
    label: "Podklady",
    title: "Co už máte připravené?",
    hint: "Podle toho poznám rozsah — a co vám můžu dodat navíc.",
    multi: true,
    options: ["Logo a barvy značky", "Fotky produktů", "Texty", "Inspiraci nebo vzory", "Zatím nic, začínáme od nuly"],
  },
  {
    key: "when",
    label: "Termín",
    title: "Kdy to potřebujete?",
    hint: "Na spěchající projekty si najdu místo, jen to vím dopředu.",
    options: ["Co nejdřív", "Do 2 týdnů", "Do měsíce", "Nespěchá"],
  },
  {
    key: "budget",
    label: "Rozpočet",
    title: "S jakým rozpočtem počítáte?",
    hint: "Orientačně — pomůže mi navrhnout rozsah, který dává smysl.",
    options: ["Do 10 000 Kč", "10–30 tisíc Kč", "30–80 tisíc Kč", "Přes 80 tisíc Kč", "Zatím nevím, poraďte"],
  },
];

type Channel = { label: string; kind: "call" | "email" | "whatsapp" };

const FALLBACK_CHANNELS: Channel[] = [
  { label: "Zavolejte mi", kind: "call" },
  { label: "Napište e-mail", kind: "email" },
  { label: "Zpráva na WhatsApp", kind: "whatsapp" },
];

// Jak zní poděkování podle zvoleného způsobu ({jak} v textu).
const HOW: Record<Channel["kind"], string> = { call: "zavolám", email: "napíšu e-mail", whatsapp: "napíšu na WhatsApp" };

type Answers = Record<string, string[]>;

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Arrow({ back = false }: { back?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={back ? { rotate: "180deg" } : undefined}>
      <path d="M5 12h13M12 5.5 18.5 12 12 18.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Krok vjede ze strany, kam se jde (dir = 1 vpřed, -1 zpět).
const STEP = {
  enter: (dir: number) => ({ opacity: 0, x: `${dir * 2.4}vw`, filter: "blur(4px)" }),
  center: { opacity: 1, x: "0vw", filter: "blur(0px)", transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
  exit: (dir: number) => ({ opacity: 0, x: `${dir * -1.6}vw`, filter: "blur(4px)", transition: { duration: 0.2 } }),
};

export default function Brief({
  types,
  steps = null,
  contact = null,
  editing = false,
  namePlaceholder,
  phonePlaceholder,
  emailPlaceholder,
  notePlaceholder,
  consentLabel,
  submitBody,
}: {
  /** Druhy práce (typy projektu z CMS) — pro otázky z kódu. */
  types: string[];
  /** Kroky z modulu „Poptávka" (Studio); prázdné = otázky z kódu. */
  steps?: BriefStep[] | null;
  /** Poslední krok (otázka, způsoby, poděkování) ze Studia. */
  contact?: BriefContact | null;
  /** V rámu Studia: otázky jdou klikem otevřít jako dokument. */
  editing?: boolean;
  namePlaceholder: string;
  phonePlaceholder: string;
  emailPlaceholder: string;
  notePlaceholder: string;
  consentLabel: ReactNode;
  /** Obsah tlačítka Odeslat (ikona, popisek, šipka). */
  submitBody: ReactNode;
}) {
  const qs: Question[] = steps && steps.length ? steps : fallbackQuestions(types);
  const channels: Channel[] = contact?.channels?.length ? contact.channels : FALLBACK_CHANNELS;
  const last = qs.length; // index kroku s kontaktem a shrnutím
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [answers, setAnswers] = useState<Answers>({});
  // Jak se ozvat: bez výchozí volby — návštěvník musí jednu vybrat.
  const [channel, setChannel] = useState("");
  const [name, setName] = useState("");
  // Telefon i e-mail, obojí povinné (na e-mail jde potvrzení, telefon pro
  // zavolání / WhatsApp). Pole mají autocomplete, ať je prohlížeč předvyplní.
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  // Past na roboty: skryté pole, které člověk nevidí a nevyplní.
  const [website, setWebsite] = useState("");
  const titleId = useId();

  const send = async () => {
    setSending(true);
    setFailed(false);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          channel,
          note: note.trim(),
          agreed,
          website,
          answers: qs.map((x) => ({ key: x.key, label: x.label, values: answers[x.key] ?? [] })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (res.ok && data.ok) setSent(true);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  // Pruh se Zpět / Dál je přilepený u spodní hrany posouvaného panelu.
  // Podklad dostane, jen když opravdu visí přes obsah (bottom: -1px →
  // přilepený není celý vidět).
  const navRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setStuck(entry.intersectionRatio < 1), { threshold: [1] });
    observer.observe(el);
    return () => observer.disconnect();
  }, [sent]);

  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setStep(Math.max(0, Math.min(last, to)));
  };

  // Dál na telefonu (27. 11. 2026): volby kroku jsou pod okrajem výhledu,
  // takže zašedlé Dál vypadalo, že nefunguje. Bez odpovědi Dál posune panel
  // na volby a krátce je zvýrazní; s odpovědí jde dál a posune panel na
  // začátek formuláře (další otázka i její volby jsou vidět). Posun jen
  // tehdy, když cíl není celý vidět — na počítači se nic nehne.
  const stageRef = useRef<HTMLDivElement>(null);
  const [nudge, setNudge] = useState(0);
  const reveal = (el: Element | null | undefined) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const fits = r.top >= 0 && r.bottom <= window.innerHeight;
    if (!fits) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const next = (answered: boolean) => {
    if (!answered) {
      reveal(stageRef.current?.querySelector("[data-brief-options]"));
      setNudge((n) => n + 1);
      return;
    }
    go(step + 1);
    // Po výměně kroku (AnimatePresence) — nový krok už je v DOM.
    window.setTimeout(() => reveal(stageRef.current), 380);
  };

  const pick = (q: Question, option: string) => {
    const now = answers[q.key] ?? [];
    if (q.multi) {
      setAnswers({ ...answers, [q.key]: now.includes(option) ? now.filter((o) => o !== option) : [...now, option] });
      return;
    }
    setAnswers({ ...answers, [q.key]: [option] });
    // Jedna volba: krátce ukázat zaškrtnutí, pak dál.
    window.setTimeout(() => go(step + 1), 320);
  };

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const phoneOk = phone.trim().length > 4;
  const ready = name.trim().length > 1 && phoneOk && emailOk && Boolean(channel) && agreed;

  // Poděkování: texty ze Studia se zástupnými {jméno} a {jak}, jinak z kódu.
  const first = name.trim().split(/\s+/)[0] || "";
  const how = HOW[channels.find((c) => c.label === channel)?.kind ?? "call"];
  const doneTitle = (contact?.doneTitle || "Díky{, jméno}. Poptávka je u mě.")
    .replace("{, jméno}", first ? `, ${first}` : "")
    .replace("{jméno}", first);
  const doneText = (contact?.doneText || "Projdu ji a ozvu se — {jak} obvykle do 24 hodin.").replace("{jak}", how);

  if (sent) {
    return (
      <motion.div className={styles.done} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} role="status">
        <span className={styles.doneIcon} aria-hidden="true">
          <Check />
        </span>
        <p className={styles.doneTitle}>{doneTitle}</p>
        <p className={styles.doneText}>{doneText}</p>
        <Summary qs={qs} answers={answers} />
      </motion.div>
    );
  }

  const q = qs[step];
  return (
    <form
      className={styles.brief}
      aria-labelledby={titleId}
      onSubmit={(event) => {
        event.preventDefault();
        if (step === last && ready && !sending) void send();
      }}
    >
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className={styles.trap}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      {/* Postup: čárky s názvy kroků přes celou šířku; klik na hotový krok
          se do něj vrátí. Číslo kroku stojí velké u otázky (StepHead). */}
      <div className={styles.progress}>
        <ol className={styles.ticks}>
          {[...qs.map((x) => x.label), "Kontakt"].map((label, i) => (
            <li key={label}>
              <button
                type="button"
                className={styles.tick}
                data-done={i < step || undefined}
                data-current={i === step || undefined}
                disabled={i > step}
                onClick={() => go(i)}
                aria-label={`${i + 1}. ${label}`}
              >
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div ref={stageRef} className={styles.stage}>
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div key={step} className={q ? styles.step : `${styles.step} ${styles.contactStep}`} custom={dir} variants={STEP} initial="enter" animate="center" exit="exit">
            {q ? (
              <>
                <StepHead step={step} total={last + 1} titleId={titleId} title={q.title} hint={q.hint} docId={editing ? q.id : undefined} docType="briefStep" />
                <div key={nudge} className={styles.cards} role="group" aria-labelledby={titleId} data-brief-options="" data-nudge={nudge > 0 || undefined}>
                  {q.options.map(({ label: option, icon }) => {
                    const on = (answers[q.key] ?? []).includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        className={styles.card}
                        data-on={on || undefined}
                        data-multi={q.multi || undefined}
                        aria-pressed={on}
                        onClick={() => pick(q, option)}
                      >
                        {/* Ikona jako velká tenká kresba v pozadí karty, od
                            začátku; název velký a na střed pod ní. */}
                        <span className={styles.cardArt} aria-hidden="true">
                          <OptionIcon label={option} icon={icon} />
                        </span>
                        <span className={styles.mark} aria-hidden="true">
                          <Check />
                        </span>
                        <span className={styles.cardLabel}>{option}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <StepHead step={step} total={last + 1} titleId={titleId} title={contact?.title || "Komu se mám ozvat?"} docId={editing ? contact?.id : undefined} docType="briefContact" />
                <div className={styles.contactRow}>
                  <input
                    className={base.field}
                    type="text"
                    name="jmeno"
                    placeholder={namePlaceholder}
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                  <input
                    className={base.field}
                    type="tel"
                    name="telefon"
                    placeholder={phonePlaceholder}
                    autoComplete="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    required
                  />
                </div>
                <input
                  className={base.field}
                  type="email"
                  name="email"
                  placeholder={`${emailPlaceholder} *`}
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  aria-invalid={email.trim().length > 0 && !emailOk ? true : undefined}
                />
                <div className={styles.options} role="group" aria-label="Jak se ozvat (vyberte jednu možnost)">
                  {channels.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      className={`${styles.option} ${styles.small}`}
                      data-on={channel === option.label || undefined}
                      aria-pressed={channel === option.label}
                      onClick={() => setChannel(option.label)}
                    >
                      <span className={styles.mark} aria-hidden="true">
                        <Check />
                      </span>
                      {option.label}
                    </button>
                  ))}
                </div>
                <input
                  className={base.field}
                  type="text"
                  name="poznamka"
                  placeholder={notePlaceholder}
                  maxLength={200}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <Summary qs={qs} answers={answers} onEdit={go} />
                <label className={base.consent}>
                  <input
                    type="checkbox"
                    name="souhlas"
                    className={base.consentInput}
                    checked={agreed}
                    onChange={(event) => setAgreed(event.target.checked)}
                    required
                  />
                  <span className={base.consentBox} aria-hidden="true">
                    <Check />
                  </span>
                  <span className={base.consentLabel}>{consentLabel}</span>
                </label>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div ref={navRef} className={styles.nav} data-stuck={stuck || undefined}>
        {step > 0 ? (
          <button type="button" className={styles.back} onClick={() => go(step - 1)}>
            <Arrow back />
            Zpět
          </button>
        ) : (
          <span />
        )}
        {q ? (
          <button
            type="button"
            className={styles.next}
            // Ne `disabled`: klik bez odpovědi ukáže volby (next výš).
            aria-disabled={!(answers[q.key]?.length) || undefined}
            onClick={() => next(Boolean(answers[q.key]?.length))}
          >
            {q.multi ? "Pokračovat" : "Dál"}
            <Arrow />
          </button>
        ) : (
          <button type="submit" className={`${base.submit} ${styles.send}`} data-ready={ready ? "" : undefined} disabled={!ready || sending} aria-busy={sending || undefined}>
            {submitBody}
          </button>
        )}
      </div>
      {failed ? (
        <p className={styles.sendError} role="alert">
          Odeslání se nepovedlo. Zkuste to prosím ještě jednou — nebo mi napište rovnou na e-mail z kontaktů níž.
        </p>
      ) : null}
    </form>
  );
}

/** Hlavička kroku: velké číslo, vedle otázka a nápověda. */
function StepHead({
  step,
  total,
  titleId,
  title,
  hint,
  docId,
  docType,
}: {
  step: number;
  total: number;
  titleId: string;
  title: string;
  hint?: string;
  /** V rámu Studia: klik na otázku otevře její dokument (kroky, možnosti, ikony). */
  docId?: string;
  docType?: "briefStep" | "briefContact";
}) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className={styles.head}>
      <span className={styles.num} aria-hidden="true">
        {pad(step + 1)}
        <small>/ {pad(total)}</small>
      </span>
      <div className={styles.headText}>
        <p className={styles.title} id={titleId} {...(docId && docType ? editableDoc(docId, docType) : {})}>
          {title}
        </p>
        {hint ? <p className={styles.hint}>{hint}</p> : null}
      </div>
    </div>
  );
}

/** Shrnutí odpovědí; s `onEdit` jde každý řádek kliknutím upravit. */
function Summary({ qs, answers, onEdit }: { qs: Question[]; answers: Answers; onEdit?: (step: number) => void }) {
  return (
    <dl className={styles.summary}>
      {qs.map((q, i) => (
        <div key={q.key}>
          <dt>{q.label}</dt>
          <dd>
            {(answers[q.key] ?? []).join(", ") || "—"}
            {onEdit ? (
              <button type="button" className={styles.edit} onClick={() => onEdit(i)}>
                Upravit
              </button>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
