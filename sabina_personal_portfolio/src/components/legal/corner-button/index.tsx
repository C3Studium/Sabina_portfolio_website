// Text v rámečku ze čtyř rohů, které se při najetí rozestoupí — převzaté
// z webu Procházka Group (components/common/ui/CornerButton). Tady jen jako
// tlačítko (bez odkazu); `...rest` nese anotace Studia.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./styles.module.scss";

export default function CornerButton({ className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button {...rest} type="button" className={[styles.cornerButton, className].filter(Boolean).join(" ")}>
      <span className={`${styles.corner} ${styles.tl}`} />
      <span className={`${styles.corner} ${styles.tr}`} />
      <span className={`${styles.corner} ${styles.bl}`} />
      <span className={`${styles.corner} ${styles.br}`} />
      {children}
    </button>
  );
}
