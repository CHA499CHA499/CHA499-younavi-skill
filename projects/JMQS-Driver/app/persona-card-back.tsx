import { PERSONA_CARD_BRAND_LOGO_SRC } from "./persona-card-face";
import styles from "./persona-card-back.module.css";

export interface PersonaCardBackProps {
  className?: string;
}

export function PersonaCardBack({ className }: PersonaCardBackProps) {
  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")} role="img" aria-label="Persona Card 卡背" data-card-face="back">
      <img className={styles.logo} src={PERSONA_CARD_BRAND_LOGO_SRC} alt="" aria-hidden="true" draggable={false} />
    </div>
  );
}
