import { useEffect, useId, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { NAV_ITEMS } from "../nav-items";
import styles from "./styles.module.scss";

// POZOR: telefon i e-mail jsou ZÁSTUPNÉ, skutečné kontakty neznám.
// Před spuštěním je nutné je přepsat.
const CHANNELS = [
  {
    icon: "phone",
    label: "Zavolejte mi",
    value: "+420 123 456 789",
    note: null,
    href: "tel:+420123456789",
  },
  {
    icon: "mail",
    label: "Napište mi",
    value: "ahoj@sabinahudrmentova.cz",
    note: null,
    href: "mailto:ahoj@sabinahudrmentova.cz",
  },
  {
    icon: "clock",
    label: "Dostupnost",
    value: "Po – Pá   9:00 – 18:00",
    note: "Obvykle odpovím do pár hodin",
    href: null,
  },
  {
    icon: "calendar",
    label: "Domluvit schůzku",
    value: "Vybrat termín online",
    note: "Vyberte si čas, který vám vyhovuje",
    href: null,
  },
] as const;

const PROJECT_TYPES = [
  "Bannerová kampaň",
  "Obsah pro sociální sítě",
  "Vizuály pro e-shop",
  "Kompletní vizuální identita",
  "Něco jiného",
];

const MESSAGE_LIMIT = 300;

// Modal JE cíl tlačítka „Domluvit spolupráci", takže odpovídající položka
// navigace se v jeho liště tváří jako aktivní — v návrhu je takhle
// zvýrazněný CONTACT.
const ACTIVE_NAV = "#spoluprace";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path
        d="M5 12h13M12 5.5 18.5 12 12 18.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

function ChannelIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
      {name === "phone" && (
        <path
          d="M7.2 3.5 9.4 8l-1.9 1.6a12.4 12.4 0 0 0 5.9 5.9L15 13.6l4.5 2.2v3.1c0 .9-.8 1.7-1.7 1.6A16.6 16.6 0 0 1 3.5 5.2c-.1-.9.7-1.7 1.6-1.7h2.1Z"
          strokeLinejoin="round"
        />
      )}
      {name === "mail" && (
        <>
          <rect x="2.8" y="5" width="18.4" height="14" rx="2.2" />
          <path d="m3.4 6.6 8.6 6.2 8.6-6.2" strokeLinejoin="round" />
        </>
      )}
      {name === "clock" && (
        <>
          <circle cx="12" cy="12" r="8.8" />
          <path d="M12 6.9V12l3.4 2" strokeLinecap="round" />
        </>
      )}
      {name === "calendar" && (
        <>
          <rect x="3.4" y="5.2" width="17.2" height="15.4" rx="2.2" />
          <path d="M3.4 9.7h17.2M8.2 3.4v3.4M15.8 3.4v3.4" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8 21 3Z" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4.8" y="10.4" width="14.4" height="10.2" rx="2.2" />
      <path d="M8.4 10.4V7.6a3.6 3.6 0 0 1 7.2 0v2.8" strokeLinecap="round" />
    </svg>
  );
}

type ContactModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function ContactModal({ open, onClose }: ContactModalProps) {
  const [message, setMessage] = useState("");
  const titleId = useId();

  // Escape zavírá a po dobu otevření se zastaví scroll. Lenis si scroll
  // řídí sám, takže nestačí overflow na body — instanci je nutné stopnout,
  // jinak by se pozadí pod modalem dál posouvalo.
  useEffect(() => {
    if (!open) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    const lenis = window.lenisInstance;
    lenis?.stop();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);

    return () => {
      lenis?.start();
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.backdrop}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <motion.div
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: "2vh", scale: 0.985 }}
            animate={{ opacity: 1, y: "0vh", scale: 1 }}
            exit={{ opacity: 0, y: "1.4vh", scale: 0.99 }}
            transition={{ duration: 0.34, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <div className={styles.glow} aria-hidden="true" />
            {/* Zrnitá hrana toho světlého tvaru — v návrhu je výrazně
                ditherovaná, ne hladká. */}
            <div className={styles.grain} aria-hidden="true" />

            <div className={styles.bar}>
              <span className={styles.brand}>
                <Image
                  src="/assets/rest/logo.png"
                  alt=""
                  width={64}
                  height={58}
                  className={styles.brandMark}
                />
                <span className={styles.brandText}>
                  <span className={styles.brandName}>Sabina</span>
                  <span className={styles.brandSurname}>Hudrmentová</span>
                </span>
              </span>

              <nav className={styles.nav} aria-label="Hlavní navigace">
                {NAV_ITEMS.map((item) => (
                  <a
                    key={item.href}
                    className={`${styles.navLink} ${
                      item.href === ACTIVE_NAV ? styles.isActive : ""
                    }`}
                    href={item.href}
                    onClick={onClose}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>

              <button
                type="button"
                className={styles.close}
                onClick={onClose}
                aria-label="Zavřít"
              >
                <CloseIcon />
              </button>
            </div>

            <div className={styles.body}>
              <div className={styles.intro}>
                <p className={styles.eyebrow}>
                  <span className={styles.eyebrowDot} aria-hidden="true" />
                  <span className={styles.eyebrowArrow} aria-hidden="true">
                    <TailArrowIcon />
                  </span>
                  Pojďme do toho spolu
                </p>

                <h2 className={styles.headline} id={titleId}>
                  <span>Pustíme se</span>
                  <span>do něčeho,</span>
                  <span>
                    co <span className={styles.accent}>funguje</span>?
                  </span>
                </h2>

                <p className={styles.lead}>
                  Máte v hlavě projekt? Pojďme si o něm říct. Vyplňte formulář
                  a ozvu se vám co nejdřív.
                </p>

                <ul className={styles.channels}>
                  {CHANNELS.map((channel) => (
                    <li key={channel.label} className={styles.channel}>
                      <ChannelRow channel={channel} />
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.formCol}>
                <p className={styles.formEyebrow}>
                  Poslat zprávu
                  <span className={styles.formEyebrowRule} aria-hidden="true" />
                </p>

                <p className={styles.formTitle}>Mám zájem o spolupráci.</p>
                <span className={styles.formTitleRule} aria-hidden="true" />

                <p className={styles.formLead}>
                  Nechte mi jméno a telefon — ozvu se vám osobně a probereme
                  váš projekt.
                </p>

                {/* Formulář zatím nikam neodesílá, backend neexistuje. */}
                <form
                  className={styles.form}
                  onSubmit={(event) => event.preventDefault()}
                >
                  <div className={styles.formRow}>
                    <input
                      className={styles.field}
                      type="text"
                      name="jmeno"
                      placeholder="Vaše jméno *"
                      autoComplete="name"
                      required
                    />
                    <span className={styles.fieldWrap}>
                      <input
                        className={styles.field}
                        type="tel"
                        name="telefon"
                        placeholder="Telefon *"
                        autoComplete="tel"
                        required
                      />
                      <span className={styles.fieldIcon} aria-hidden="true">
                        <PhoneFieldIcon />
                      </span>
                    </span>
                  </div>

                  <select
                    className={`${styles.field} ${styles.select}`}
                    name="typ"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Typ projektu (nepovinné)
                    </option>
                    {PROJECT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>

                  <div className={styles.textareaWrap}>
                    <textarea
                      className={`${styles.field} ${styles.textarea}`}
                      name="zprava"
                      placeholder="Napište mi pár slov o projektu"
                      maxLength={MESSAGE_LIMIT}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                    />
                    <span className={styles.counter} aria-hidden="true">
                      {message.length} / {MESSAGE_LIMIT}
                    </span>
                  </div>

                  <button type="submit" className={styles.submit}>
                    <span className={styles.submitIcon} aria-hidden="true">
                      <SendIcon />
                    </span>
                    <span className={styles.submitLabel}>
                      Odeslat — ozvu se obratem
                    </span>
                    <span className={styles.submitArrow} aria-hidden="true">
                      <ArrowIcon />
                    </span>
                  </button>
                </form>

                <p className={styles.privacy}>
                  <span className={styles.privacyIcon} aria-hidden="true">
                    <LockIcon />
                  </span>
                  Vaše údaje jsou v bezpečí a nikdy je nikomu nepředám.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type Channel = (typeof CHANNELS)[number];

// Telefon a e-mail jsou proklikávací, dostupnost a schůzka zatím ne —
// proto se obal přepíná mezi <a> a <span>.
function ChannelRow({ channel }: { channel: Channel }) {
  const content = (
    <>
      <span className={styles.channelIcon} aria-hidden="true">
        <ChannelIcon name={channel.icon} />
      </span>
      <span className={styles.channelText}>
        <span className={styles.channelLabel}>{channel.label}</span>
        <span className={styles.channelValue}>{channel.value}</span>
        {channel.note && (
          <span className={styles.channelNote}>{channel.note}</span>
        )}
      </span>
      <span className={styles.channelArrow} aria-hidden="true">
        <ArrowIcon />
      </span>
    </>
  );

  if (channel.href) {
    return (
      <a className={styles.channelLink} href={channel.href}>
        {content}
      </a>
    );
  }

  return <span className={styles.channelLink}>{content}</span>;
}

// Krátká linka s hrotem doleva před eyebrow textem, jak ji má návrh.
function TailArrowIcon() {
  return (
    <svg viewBox="0 0 22 8" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M22 4H1M4.4 1.2 1 4l3.4 2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Drobný glyf v pravé části pole pro telefon.
function PhoneFieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="7" y="2.6" width="10" height="18.8" rx="2.2" />
      <path d="M11 18.6h2" strokeLinecap="round" />
    </svg>
  );
}
