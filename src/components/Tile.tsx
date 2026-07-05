"use client";

import Link from "next/link";

type TileColor = "yellow" | "orange" | "lime" | "purple" | "sky" | "pink";

// Colorful widget tile: emoji + label + big value + caption. Links when href set.
export function Tile({
  color,
  emoji,
  label,
  value,
  caption,
  href,
  className = "",
}: {
  color: TileColor;
  emoji: string;
  label: string;
  value?: React.ReactNode;
  caption?: string;
  href?: string;
  className?: string;
}) {
  const inner = (
    <div className={`tile tile-${color} flex h-full flex-col gap-1.5 ${className}`}>
      <div className="flex items-start justify-between">
        <span className="text-[0.7rem] font-extrabold uppercase tracking-wider opacity-80">{label}</span>
        <span className="text-xl leading-none">{emoji}</span>
      </div>
      {value !== undefined && (
        <div className="font-display text-[1.9rem] font-bold leading-none">{value}</div>
      )}
      {caption && <p className="mt-auto text-[0.72rem] font-semibold leading-snug opacity-75">{caption}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full transition-transform active:scale-[0.98]">
      {inner}
    </Link>
  ) : (
    inner
  );
}
