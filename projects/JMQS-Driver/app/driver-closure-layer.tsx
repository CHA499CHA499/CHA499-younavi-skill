import type { DriverPhase } from "./driver-scene";
import type { DriverRodVisualAssets } from "./driver-texture-scene";
import styles from "./driver-closure-layer.module.css";

interface SideChassisAssemblyProps {
  side: "left" | "right";
  rodKind: "energy" | "skill";
  phase: DriverPhase;
  handleProgress: number;
  equipped: boolean;
  rodSrc: string;
  rodLabel: string;
  chassisSrc: string;
  slotForegroundSrc: string;
}

function SideChassisAssembly({
  side,
  rodKind,
  phase,
  handleProgress,
  equipped,
  rodSrc,
  rodLabel,
  chassisSrc,
  slotForegroundSrc,
}: SideChassisAssemblyProps) {
  const closureState = phase === "activated" ? "final" : handleProgress > 0 ? "closing" : "open";

  return (
    <div
      className={`${styles.sideAssembly} ${side === "left" ? styles.leftSideAssembly : styles.rightSideAssembly}`}
      data-layer={`${side}-side-assembly`}
      data-side={side}
      data-rod-kind={rodKind}
      data-closure-state={closureState}
    >
      <img className={styles.chassisBackTexture} src={chassisSrc} alt="" draggable={false} />
      <div className={styles.slotWindow} data-slot-window={side}>
        <div className={styles.rodViewport} data-rod-viewport={side}>
          {equipped && (
            <img
              className={`texture-driver-rod ${styles.rodSprite}`}
              data-layer={`${side}-payload`}
              data-payload-state="charged"
              src={rodSrc}
              alt={rodLabel}
              draggable={false}
            />
          )}
        </div>
      </div>
      <img className={styles.slotForegroundMask} src={slotForegroundSrc} alt="" draggable={false} />
    </div>
  );
}

interface DriverClosureLayerProps {
  phase: DriverPhase;
  handleProgress: number;
  energyRodEquipped: boolean;
  skillRodEquipped: boolean;
  rodAssets: DriverRodVisualAssets;
}

export function DriverClosureLayer({
  phase,
  handleProgress,
  energyRodEquipped,
  skillRodEquipped,
  rodAssets,
}: DriverClosureLayerProps) {
  const bothRodsLoaded = energyRodEquipped && skillRodEquipped;

  return (
    <>
      <img
        className={`texture-driver-belt ${styles.centerCore}`}
        data-layer="center-core"
        data-source="/driver-textures/belt-v1.png"
        src="/driver-textures/assembly/center-core-v2.png"
        alt=""
        draggable={false}
      />
      <SideChassisAssembly
        side="left"
        rodKind="energy"
        phase={phase}
        handleProgress={handleProgress}
        equipped={energyRodEquipped}
        rodSrc={rodAssets.energy.charged}
        rodLabel="已装配能量棒"
        chassisSrc="/driver-textures/assembly/left-chassis-v2.png"
        slotForegroundSrc="/driver-textures/assembly/left-slot-foreground-v2.png"
      />
      <SideChassisAssembly
        side="right"
        rodKind="skill"
        phase={phase}
        handleProgress={handleProgress}
        equipped={skillRodEquipped}
        rodSrc={rodAssets.skill.charged}
        rodLabel="已装配技能棒"
        chassisSrc="/driver-textures/assembly/right-chassis-v2.png"
        slotForegroundSrc="/driver-textures/assembly/right-slot-foreground-v2.png"
      />
      <div className={styles.effectLayer} data-layer="driver-effects" aria-hidden="true">
        {bothRodsLoaded && <span className={styles.snapLock} />}
        {bothRodsLoaded && <span className={styles.snapFlash} />}
      </div>
    </>
  );
}
