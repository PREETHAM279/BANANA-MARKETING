"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, CalendarCheck, CalendarClock, Columns3, LayoutDashboard, Menu, MessageSquare, Settings, X } from "lucide-react";
import { cn } from "@/lib/format";
import { ThemeToggle } from "./ThemeToggle";

type Counts = { followupsDue: number; total: number; contacted: number };

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Directory", icon: Building2 },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/outreach", label: "Tomorrow's Outreach", icon: CalendarCheck },
  { href: "/followups", label: "Follow-ups", icon: CalendarClock, countKey: "followupsDue" as const },
  { href: "/communication", label: "Communication", icon: MessageSquare },
  { href: "/settings", label: "Settings & Data", icon: Settings },
];

export function Sidebar({ counts }: { counts: Counts }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  const pct = counts.total ? Math.round((counts.contacted / counts.total) * 100) : 0;

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pb-4 pt-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-[13px] font-bold text-white">B</div>
        <div className="leading-tight">
          <div className="text-[13.5px] font-semibold">Bengaluru Sales CRM</div>
          <div className="text-[11.5px] text-muted">Local · private</div>
        </div>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const count = item.countKey ? counts[item.countKey] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors",
                active ? "bg-surface-3 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={16} strokeWidth={1.9} className={active ? "text-accent" : "text-muted"} />
              <span className="flex-1 truncate">{item.label}</span>
              {count > 0 ? <span className="rounded-full bg-warn-soft px-1.5 text-[11px] font-semibold text-warn-ink">{count}</span> : null}
            </Link>
          );
        })}
      </div>
      <div className="space-y-3 border-t border-line px-4 py-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11.5px] text-muted">
            <span>Leads contacted</span>
            <span className="tabular text-ink-2">
              {counts.contacted}/{counts.total}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Leads contacted">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <ThemeToggle />
      </div>
    </nav>
  );

  return (
    <>
      <header className="no-print sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur lg:hidden">
        <button className="btn btn-ghost btn-sm px-1.5" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu size={18} />
        </button>
        <span className="text-[13.5px] font-semibold">Bengaluru Sales CRM</span>
      </header>
      <aside className="no-print fixed inset-y-0 left-0 z-20 hidden w-[236px] border-r border-line bg-surface lg:block">{nav}</aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[260px] border-r border-line bg-surface shadow-[var(--shadow-lg)]">
            <button className="btn btn-ghost btn-sm absolute right-2 top-4 px-1.5" onClick={() => setOpen(false)} aria-label="Close menu">
              <X size={16} />
            </button>
            {nav}
          </aside>
        </div>
      ) : null}
    </>
  );
}
