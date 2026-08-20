"use client";

import type { CSSProperties } from "react";

export interface DragLayerItem {
  kind: "persona" | "rod";
  label: string;
  detail: string;
  image?: string;
  color?: string;
}

interface InteractionDragLayerProps {
  item: DragLayerItem | null;
  pointer: { x: number; y: number };
}

export function InteractionDragLayer({ item, pointer }: InteractionDragLayerProps) {
  if (!item) return null;

  const style = {
    "--drag-x": `${pointer.x}px`,
    "--drag-y": `${pointer.y}px`,
    "--drag-color": item.color ?? "#ef3048",
  } as CSSProperties;

  return (
    <div className={`interaction-drag-layer is-${item.kind}`} style={style} aria-hidden="true">
      <div className="interaction-drag-object">
        {item.image && <img src={item.image} alt="" draggable={false} />}
        <span className="interaction-drag-label"><strong>{item.label}</strong><small>{item.detail}</small></span>
      </div>
    </div>
  );
}
