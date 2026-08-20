import type { CSSProperties } from "react";
import type { DriverPhase } from "./driver-scene";
import { DriverClosureLayer } from "./driver-closure-layer";
import styles from "./driver-closure-layer.module.css";

// Assembly source contract: /driver-textures/belt-v1.png is deterministically split into
// center-core and left/right chassis layers; texture-driver-rod energy/skill payloads move
// inside their chassis wrappers and never travel as independent scene siblings.

export interface DriverRodVisualAssets {
  energy: { charged: string };
  skill: { charged: string };
}

// Driver consumes only equipped/charged payloads. Empty and loose visuals remain page-level assets.
// The independent charged asset group can replace these URLs without changing the layer contract.
export const DEFAULT_DRIVER_ROD_ASSETS: DriverRodVisualAssets = {
  energy: {
    charged: "/driver-textures/energy-rod-charged-tight-v1.png",
  },
  skill: {
    charged: "/driver-textures/skill-rod-charged-tight-v1.png",
  },
};

interface DriverTextureSceneProps {
  phase: DriverPhase;
  cardColor: string;
  personaName?: string;
  personaRole?: string;
  personaImage?: string;
  handleProgress: number;
  energyRodEquipped: boolean;
  skillRodEquipped: boolean;
  rodAssets?: DriverRodVisualAssets;
}

export function DriverTextureScene({
  phase,
  cardColor,
  personaName,
  personaRole,
  personaImage,
  handleProgress,
  energyRodEquipped,
  skillRodEquipped,
  rodAssets = DEFAULT_DRIVER_ROD_ASSETS,
}: DriverTextureSceneProps) {
  const cardInserted = phase === "inserting" || phase === "locked" || phase === "activated";
  const style = {
    "--card-color": cardColor,
    "--driver-close": handleProgress,
  } as CSSProperties;
  const closureState = phase === "activated" ? "final" : handleProgress > 0 ? "closing" : "open";

  return (
    <div
      className={`texture-driver phase-${phase} ${styles.scene}`}
      data-closure-state={closureState}
      style={style}
      aria-label="贴图化 Persona Driver"
    >
      <div className="driver-assembly" data-layer="base">
        <DriverClosureLayer
          energyRodEquipped={energyRodEquipped}
          skillRodEquipped={skillRodEquipped}
          rodAssets={rodAssets}
          handleProgress={handleProgress}
          phase={phase}
        />
        {cardInserted && personaImage && (
          <div className="texture-persona-card" data-layer="middle" aria-label={`已插入 ${personaName ?? "人物"} 卡`}>
            <img src={personaImage} alt="" draggable={false} />
            <span><small>PERSONA</small><strong>{personaName}</strong><em>{personaRole}</em></span>
          </div>
        )}
        <img className="texture-driver-foreground" data-layer="foreground" src="/driver-textures/assembly/foreground-masks-v2.png" alt="" draggable={false} />
        <span className="texture-driver-glow" aria-hidden="true" />
      </div>
    </div>
  );
}
