"use client";

import { useState } from "react";
import { Building2, Dumbbell, GraduationCap, Hotel, Scissors, ShoppingBag, Stethoscope, UtensilsCrossed, Warehouse, Wrench, type LucideIcon } from "lucide-react";
import { cn, initials } from "@/lib/format";

export const CATEGORY_ICON: Record<string, LucideIcon> = {
  "Restaurants & Cafes": UtensilsCrossed,
  "Gyms & Fitness": Dumbbell,
  "Retail & Showrooms": ShoppingBag,
  "Hospitals & Clinics": Stethoscope,
  "Salons & Spas": Scissors,
  Education: GraduationCap,
  "Hotels & Resorts": Hotel,
  "Warehousing & Logistics": Warehouse,
  "Real Estate": Building2,
  "Other Services": Wrench,
};

/** Shows a real photo only when one exists (uploaded by you, from the official website, or Google).
 *  Otherwise a neutral monogram - never a stock image. */
export function LeadAvatar({ name, category, photoUrl, size = 40, className }: { name: string; category: string; photoUrl?: string | null; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const Icon = CATEGORY_ICON[category] ?? Building2;
  if (photoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt={`${name}`} width={size} height={size} referrerPolicy="no-referrer" loading="lazy" onError={() => setFailed(true)} className={cn("shrink-0 rounded-lg border border-line bg-surface-2 object-cover", className)} style={{ width: size, height: size }} />
    );
  }
  return (
    <div className={cn("relative flex shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 font-semibold text-ink-2", className)} style={{ width: size, height: size, fontSize: Math.max(11, size * 0.32) }} aria-hidden>
      {initials(name)}
      <span className="absolute -bottom-1 -right-1 flex size-[18px] items-center justify-center rounded-md border border-line bg-surface text-muted">
        <Icon size={11} />
      </span>
    </div>
  );
}

/** Large banner for cards and profile: photo if available, otherwise an honest "No verified photo" panel. */
export function LeadBanner({ name, category, photoUrl, className, height = 128 }: { name: string; category: string; photoUrl?: string | null; className?: string; height?: number }) {
  const [failed, setFailed] = useState(false);
  const Icon = CATEGORY_ICON[category] ?? Building2;
  if (photoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt={`${name} - photo`} referrerPolicy="no-referrer" loading="lazy" onError={() => setFailed(true)} className={cn("w-full bg-surface-2 object-cover", className)} style={{ height }} />
    );
  }
  return (
    <div className={cn("flex w-full flex-col items-center justify-center gap-1 bg-surface-2 text-muted", className)} style={{ height }}>
      <Icon size={22} strokeWidth={1.6} />
      <span className="text-[11px]">No verified photo yet</span>
    </div>
  );
}
