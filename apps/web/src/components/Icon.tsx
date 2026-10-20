import type { CSSProperties } from "react";

const paths = {
  search: "m21 21-5.2-5.2M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  diagonal: "M7 17 17 7M7 7h10v10",
  check: "m5 12 4 4L19 6",
  lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3",
  code: "m8 5-7 7 7 7m8-14 7 7-7 7M14 3l-4 18",
  globe: "M2 12h20M12 2c6 6 6 14 0 20-6-6-6-14 0-20M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  close: "m6 6 12 12M6 18 18 6",
  menu: "M4 6h16M4 12h16M4 18h16",
  sliders: "M4 7h6m4 0h6M4 17h10m4 0h2M10 4v6m4 4v6",
  receipt: "M5 3h14v19l-3-2-4 2-4-2-3 2V3zM9 8h6m-6 4h6",
  shield: "m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4zm-4 10 3 3 5-6",
  sparkle: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3z",
} as const;

export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 20,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <span className={`brand-mark ${large ? "brand-mark-large" : ""}`} aria-hidden="true">
      <Icon name="code" size={large ? 38 : 22} />
      <span />
    </span>
  );
}
