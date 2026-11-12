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
// Odeslání zatím nikam nevede (backend neexistuje) — zobrazí potvrzení.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import base from "./styles.module.scss";
import styles from "./brief.module.scss";
import { OptionIcon } from "./brief-icons";

type Question = {
  key: string;
  label: string;
  title: string;
  hint: string;
  multi?: boolean;
  options: string[];
};

const questions = (types: string[]): Question[] => [
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

const CHANNELS = ["Zavolejte mi", "Napište e-mail", "Zpráva na WhatsApp"];

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
  namePlaceholder,
  contactPlaceholder,
  notePlaceholder,
  consentLabel,
  submitBody,
}: {
  /** Druhy práce (typy projektu z CMS). */
  types: string[];
  namePlaceholder: string;
  contactPlaceholder: string;
  notePlaceholder: string;
  consentLabel: ReactNode;
  /** Obsah tlačítka Odeslat (ikona, popisek, šipka). */
  submitBody: ReactNode;
}) {
  const qs = questions(types);
  const last = qs.length; // index kroku s kontaktem a shrnutím
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [answers, setAnswers] = useState<Answers>({});
  const [channel, setChannel] = useState(CHANNELS[0]);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [sent, setSent] = useState(false);
  const titleId = useId();

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

  const ready = name.trim().length > 1 && contact.trim().length > 4 && agreed;

  if (sent) {
    return (
      <motion.div className={styles.done} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} role="status">
        <span className={styles.doneIcon} aria-hidden="true">
          <Check />
        </span>
        <p className={styles.doneTitle}>Díky{name.trim() ? `, ${name.trim().split(" ")[0]}` : ""}. Poptávka je u mě.</p>
        <p className={styles.doneText}>
          Projdu ji a ozvu se — {channel === CHANNELS[0] ? "zavolám" : channel === CHANNELS[1] ? "napíšu e-mail" : "napíšu na WhatsApp"} obvykle do 24 hodin.
        </p>
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
        if (step === last && ready) setSent(true);
      }}
    >
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

      <div className={styles.stage}>
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div key={step} className={q ? styles.step : `${styles.step} ${styles.contactStep}`} custom={dir} variants={STEP} initial="enter" animate="center" exit="exit">
            {q ? (
              <>
                <StepHead step={step} total={last + 1} titleId={titleId} title={q.title} hint={q.hint} />
                <div className={styles.cards} role="group" aria-labelledby={titleId}>
                  {q.options.map((option) => {
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
                          <OptionIcon label={option} />
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
                <StepHead step={step} total={last + 1} titleId={titleId} title="Komu se mám ozvat?" />
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
                    type="text"
                    name="kontakt"
                    placeholder={contactPlaceholder}
                    autoComplete="tel"
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    required
                  />
                </div>
                <div className={styles.options} role="group" aria-label="Jak se ozvat">
                  {CHANNELS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`${styles.option} ${styles.small}`}
                      data-on={channel === option || undefined}
                      aria-pressed={channel === option}
                      onClick={() => setChannel(option)}
                    >
                      <span className={styles.mark} aria-hidden="true">
                        <Check />
                      </span>
                      {option}
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
            disabled={!(answers[q.key]?.length)}
            onClick={() => go(step + 1)}
          >
            {q.multi ? "Pokračovat" : "Dál"}
            <Arrow />
          </button>
        ) : (
          <button type="submit" className={`${base.submit} ${styles.send}`} data-ready={ready ? "" : undefined} disabled={!ready}>
            {submitBody}
          </button>
        )}
      </div>
    </form>
  );
}

/** Hlavička kroku: velké číslo, vedle otázka a nápověda. */
function StepHead({ step, total, titleId, title, hint }: { step: number; total: number; titleId: string; title: string; hint?: string }) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className={styles.head}>
      <span className={styles.num} aria-hidden="true">
        {pad(step + 1)}
        <small>/ {pad(total)}</small>
      </span>
      <div className={styles.headText}>
        <p className={styles.title} id={titleId}>
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
