"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/format";
import { STATUS_TONE, type Tone } from "@/lib/constants";

const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  accent: "bg-accent-soft text-accent-ink border-transparent",
  violet: "bg-violet-soft text-violet-ink border-transparent",
  warn: "bg-warn-soft text-warn-ink border-transparent",
  good: "bg-good-soft text-good-ink border-transparent",
  bad: "bg-bad-soft text-bad-ink border-transparent",
};

export function Badge({ tone = "neutral", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span className={cn("badge", toneClass[tone], className)} title={title}>
      {children}
    </span>
  );
}

const statusDot: Record<Tone, string> = {
  neutral: "bg-muted",
  accent: "bg-accent",
  violet: "bg-violet",
  warn: "bg-warn",
  good: "bg-good",
  bad: "bg-bad",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <Badge tone={tone} className={className}>
      <span className={cn("inline-block size-1.5 rounded-full", statusDot[tone])} aria-hidden />
      {status === "Converted" ? "✓ " : status === "Not Interested" ? "✕ " : ""}
      {status}
    </Badge>
  );
}

export function InterestBadge({ level, className }: { level: string; className?: string }) {
  const bars = level === "High" ? 3 : level === "Medium" ? 2 : 1;
  return (
    <span className={cn("badge", level === "High" ? "bg-accent-soft text-accent-ink border-transparent" : "", className)} title={`${level} interest (research assessment)`}>
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("w-[3px] rounded-[1px]", i <= bars ? "bg-current" : "bg-line-strong")} style={{ height: 4 + i * 2 }} />
        ))}
      </span>
      {level}
    </span>
  );
}

export function FitDots({ level, label }: { level: string; label: string }) {
  const n = level === "High" ? 3 : level === "Medium" ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2" title={`${label}: ${level}`}>
      <span className="flex gap-[3px]" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("size-1.5 rounded-full", i <= n ? "bg-accent" : "bg-line-strong")} />
        ))}
      </span>
      {label}
    </span>
  );
}

/** Dialog: centred on larger screens, a bottom sheet on phones (scrolling body, buttons always reachable). */
export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Don't pop the phone keyboard up straight away; on a computer, focus the first field.
    const touch = window.matchMedia("(pointer: coarse)").matches;
    setTimeout(() => ref.current?.querySelector<HTMLElement>(touch ? "[data-autofocus], button" : "input, textarea, select, button")?.focus({ preventScroll: true }), 30);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-start sm:overflow-y-auto sm:p-6 sm:pt-[8vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={cn("card flex max-h-[94dvh] w-full flex-col shadow-[var(--shadow-lg)] max-sm:rounded-b-none max-sm:border-b-0 sm:max-h-none", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="min-w-0 truncate text-[15px] font-semibold">{title}</h2>
          <button className="btn btn-ghost btn-sm -mr-1 px-1.5" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:max-h-[70vh]">{children}</div>
        {footer ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3 max-sm:pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {icon ? <div className="text-muted">{icon}</div> : null}
      <div className="text-sm font-medium">{title}</div>
      {children ? <div className="max-w-sm text-xs text-muted">{children}</div> : null}
    </div>
  );
}

/** A label wrapping exactly one form control; the hint sits outside the label so names stay short. */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <label className="block">
        <span className="label">{label}</span>
        {children}
      </label>
      {hint ? <span className="mt-1 block text-[11.5px] text-muted">{hint}</span> : null}
    </div>
  );
}

/** For groups of buttons or composite inputs (a label element must not wrap several controls). */
export function FieldGroup({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11.5px] text-muted">{hint}</span> : null}
    </div>
  );
}

export function NotVerified({ children = "Not publicly verified" }: { children?: ReactNode }) {
  return <span className="text-muted italic">{children}</span>;
}
