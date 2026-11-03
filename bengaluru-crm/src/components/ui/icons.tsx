// Brand marks (lucide no longer ships brand icons). Simple 24px outline glyphs.
import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});

export function InstagramIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}
export function FacebookIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d="M15 3h-2.5A4.5 4.5 0 0 0 8 7.5V10H5.5v3.5H8V21h3.5v-7.5h3l.5-3.5h-3.5V8a1 1 0 0 1 1-1H15z" />
    </svg>
  );
}
export function LinkedinIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 10.5V17M8 7.5v.01M12 17v-3.5a2.5 2.5 0 0 1 5 0V17M12 10.5V17" />
    </svg>
  );
}
export function YoutubeIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="m10.5 9.5 4 2.5-4 2.5z" fill="currentColor" />
    </svg>
  );
}
export function WhatsappIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(p)}>
      <path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3.5 20.5l1.4-4.2A8.5 8.5 0 1 1 20.5 11.6z" />
      <path d="M9 8.6c.2-.4.5-.4.8-.4h.5c.2 0 .4.1.5.4l.7 1.6c.1.2 0 .5-.1.7l-.5.6c.6 1.2 1.6 2.2 2.8 2.8l.6-.5c.2-.2.5-.2.7-.1l1.6.7c.3.1.4.3.4.5v.5c0 .3 0 .6-.4.8-1 .6-2.6.5-4.6-1-1.6-1.2-2.8-2.9-3.2-4.2-.3-1-.2-1.8 0-2.4z" />
    </svg>
  );
}
