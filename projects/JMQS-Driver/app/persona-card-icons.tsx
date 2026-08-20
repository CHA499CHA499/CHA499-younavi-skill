import type { SVGProps } from "react";

export type PersonaCardIconId = "naval" | "musk" | "jobs" | "trump" | "pg" | "custom";

export function getPersonaCardIconId(personaId: string): PersonaCardIconId {
  if (personaId === "naval") return "naval";
  if (personaId === "musk") return "musk";
  if (personaId === "jobs") return "jobs";
  if (personaId === "trump") return "trump";
  if (personaId === "pg") return "pg";
  return "custom";
}

export interface PersonaCardIconProps extends SVGProps<SVGSVGElement> {
  personaId: string;
}

export function PersonaCardIcon({ personaId, ...props }: PersonaCardIconProps) {
  const iconId = getPersonaCardIconId(personaId);
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
    ...props,
  };

  if (iconId === "naval") {
    return <svg {...common}><circle cx="12" cy="12" r="7.5" /><ellipse cx="12" cy="12" rx="10" ry="3.7" transform="rotate(-32 12 12)" /><path d="M12 7v10M7 12h10M12 8.8l1.4 1.4-1.4 1.4-1.4-1.4L12 8.8Z" /></svg>;
  }
  if (iconId === "musk") {
    return <svg {...common}><path d="M3 12h16" /><path d="m14 7 5 5-5 5" /><path d="M8 4v16" /><path d="M5.5 6.5 8 4l2.5 2.5M5.5 17.5 8 20l2.5-2.5" /></svg>;
  }
  if (iconId === "jobs") {
    return <svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="m12 4 2.2 5.8L20 12l-5.8 2.2L12 20l-2.2-5.8L4 12l5.8-2.2L12 4Z" /><path d="M12 1.8v2M12 20.2v2M1.8 12h2M20.2 12h2" /></svg>;
  }
  if (iconId === "trump") {
    return <svg {...common}><path d="M3 8h7l2 2-2 2H5" /><path d="m3 8 2-2M3 8l2 2" /><path d="M21 16h-7l-2-2 2-2h5" /><path d="m21 16-2-2M21 16l-2 2" /><path d="M10 12h4M10 12l-2 2 2 2h4l2-2-2-2" /></svg>;
  }
  if (iconId === "pg") {
    return <svg {...common}><path d="m8 5-5 7 5 7M16 5l5 7-5 7" /><circle cx="11" cy="12" r="1" fill="currentColor" stroke="none" /><path d="M13.5 9.5c2 1.2 2 3.8 0 5M15.5 7.5c3.5 2.4 3.5 6.6 0 9" /></svg>;
  }
  return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M8 12h8M12 8v8" /><circle cx="12" cy="12" r="2" /></svg>;
}
