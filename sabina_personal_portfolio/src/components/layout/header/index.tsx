import Image from "next/image";
import Link from "next/link";
import { NAV_ITEMS } from "../nav-items";
import styles from "./styles.module.scss";


function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M5 12h13M12 5.5 18.5 12 12 18.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type HeaderProps = {
  // Otevírá kontaktní modal — stav drží _app.tsx, protože modal je
  // sourozenec hlavičky, ne její potomek.
  onContactClick: () => void;
};

export default function Header({ onContactClick }: HeaderProps) {
  return (
    <header className={styles.header}>
      <Link className={styles.brand} href="/">
        <Image
          src="/assets/rest/logo.png"
          alt=""
          width={64}
          height={58}
          className={styles.brandMark}
          preload
        />
        <span className={styles.brandText}>
          <span className={styles.brandName}>Sabina</span>
          <span className={styles.brandSurname}>Hudrmentová</span>
        </span>
      </Link>

      <nav className={styles.nav} aria-label="Hlavní navigace">
        {NAV_ITEMS.map((item) => (
          <a key={item.href} className={styles.navLink} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>

      <button type="button" className={styles.cta} onClick={onContactClick}>
        <span className={styles.ctaLabel}>Domluvit spolupráci</span>
        <span className={styles.ctaArrow} aria-hidden="true">
          <ArrowIcon />
        </span>
      </button>
    </header>
  );
}
