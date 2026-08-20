import type { ReactNode } from "react";
import type { PersonaCard } from "./persona-card-model";
import styles from "./persona-card-shelf.module.css";

export const PERSONA_CARD_BRAND_LOGO_SRC = "/brand/persona-gate-logo-v1-64.png";

export interface PersonaCardFaceProps {
  card: PersonaCard;
  children: ReactNode;
}

export function PersonaCardFace({ card, children }: PersonaCardFaceProps) {
  return <>
    <img className={styles.brandLogo} src={PERSONA_CARD_BRAND_LOGO_SRC} alt="" aria-hidden="true" draggable={false} />
    <div className={styles.visualLayer}>
      {card.image && <img className={styles.backdropImage} src={card.image} alt="" aria-hidden="true" draggable={false} />}
      {card.image ? <img className={styles.foregroundImage} src={card.image} alt="" draggable={false} /> : <span className={styles.emptyArt} aria-hidden="true"><i /></span>}
    </div>
    {children}
  </>;
}
