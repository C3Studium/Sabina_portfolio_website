// Výběr typu projektu — vlastní rozbalovací seznam místo nativního <select>.
//
// Nativní seznam kreslí systém (šedý panel Windows, modrý výběr) a nedá se
// obarvit. Tenhle drží barvy webu: světlé pole jako ostatní, rozbalený panel
// uhlový s bílým písmem, najetá položka dostane zelenou tečku a odjede
// o kousek doprava, vybraná zezelená a má fajfku.
//
// Ovládání jako u <select>: klik / Enter / mezerník otevře, šipky přejíždějí,
// Enter vybere, Escape zavře, klik mimo zavře. Hodnota jde do formuláře přes
// skryté pole `name`. Role combobox + listbox pro čtečky.

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./styles.module.scss";

type ProjectSelectProps = {
  name: string;
  placeholder: string;
  options: string[];
  className?: string;
};

const EASE = [0.22, 1, 0.36, 1] as const;

export default function ProjectSelect({ name, placeholder, options, className }: ProjectSelectProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [cursor, setCursor] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Klik mimo zavře.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const choose = (option: string) => {
    setValue(option);
    setOpen(false);
  };

  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") {
      if (open) {
        // Zavřít seznam, ne celý modál.
        event.stopPropagation();
        setOpen(false);
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      if (!open) {
        setOpen(true);
        setCursor(Math.max(options.indexOf(value), 0));
        return;
      }
      setCursor((c) => (c + step + options.length) % options.length);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open && cursor >= 0) {
      event.preventDefault();
      choose(options[cursor]);
    }
  };

  return (
    <div ref={rootRef} className={[styles.select, className].filter(Boolean).join(" ")} data-open={open ? "" : undefined}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        className={`${styles.field} ${styles.selectButton}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && cursor >= 0 ? `${listId}-${cursor}` : undefined}
        onClick={() => {
          setOpen((o) => !o);
          setCursor(Math.max(options.indexOf(value), 0));
        }}
        onKeyDown={onKey}
      >
        <span className={value ? styles.selectValue : styles.selectPlaceholder}>{value || placeholder}</span>
        <span className={styles.selectChevron} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="m6.5 9.5 5.5 5.5 5.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.ul
            id={listId}
            role="listbox"
            className={styles.selectList}
            initial={{ opacity: 0, y: -6, scaleY: 0.96 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -4, scaleY: 0.98 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            {options.map((option, index) => (
              <motion.li
                key={option}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option === value}
                className={styles.selectOption}
                data-active={index === cursor ? "" : undefined}
                onPointerEnter={() => setCursor(index)}
                onClick={() => choose(option)}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.26, ease: EASE, delay: 0.03 * index }}
              >
                <span className={styles.selectDot} aria-hidden="true" />
                <span className={styles.selectLabel}>{option}</span>
                {option === value ? (
                  <span className={styles.selectCheck} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                ) : null}
              </motion.li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
