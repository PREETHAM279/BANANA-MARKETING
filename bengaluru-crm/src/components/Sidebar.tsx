"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, CalendarCheck, CalendarClock, Columns3, LayoutDashboard, MessageSquare, MoreHorizontal, Settings, Smartphone, X } from "lucide-react";
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

// Phone / small screens: the four things you do most, plus "More" for everything else.
const TABS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Building2 },
  { href: "/outreach", label: "Outreach", icon: CalendarCheck },
  { href: "/followups", label: "Follow-ups", icon: CalendarClock, countKey: "followupsDue" as const },
];

export function Sidebar({ counts, client = "mac" }: { counts: Counts; client?: "mac" | "phone" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  const pct = counts.total ? Math.round((counts.contacted / counts.total) * 100) : 0;
  const moreActive = !TABS.some((t) => isActive(t.href));

  const nav = (
    <nav className="flex h-full flex-col" aria-label="Main">
      <div className="flex items-center gap-2.5 px-4 pb-4 pt-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-[13px] font-bold text-white">B</div>
        <div className="leading-tight">
          <div className="text-[13.5px] font-semibold">Bengaluru Sales CRM</div>
          <div className="text-[11.5px] text-muted">{client === "phone" ? "On your phone · private" : "Local · private"}</div>
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
                "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors max-lg:h-11 max-lg:text-[15px]",
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
      <div className="space-y-3 border-t border-line px-4 py-4 max-lg:pb-[max(16px,env(safe-area-inset-bottom))]">
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
        {client === "mac" ? (
          <Link href="/settings#phone" className="flex items-center gap-1.5 text-[12px] text-muted hover:text-ink">
            <Smartphone size={13} /> Use it on your phone
          </Link>
        ) : null}
        <ThemeToggle />
      </div>
    </nav>
  );

  return (
    <>
      {/* Small screens: slim header that scrolls away, and a tab bar at the bottom. */}
      <header className="no-print flex h-12 items-center gap-2.5 px-4 pt-[env(safe-area-inset-top)] lg:hidden">
        <div className="flex size-7 items-center justify-center rounded-lg bg-accent text-[12px] font-bold text-white">B</div>
        <span className="text-[14px] font-semibold">Bengaluru Sales CRM</span>
      </header>
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur lg:hidden"
        aria-label="Quick navigation"
      >
        <div className="mx-auto grid h-14 max-w-xl grid-cols-5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = isActive(t.href);
            const count = t.countKey ? counts[t.countKey] : 0;
            return (
              <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn("relative flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium", active ? "text-accent-ink" : "text-muted")}>
                <Icon size={21} strokeWidth={active ? 2.2 : 1.9} />
                {t.label}
                {count > 0 ? <span className="absolute left-1/2 top-1.5 ml-2 min-w-4 rounded-full bg-warn px-1 text-center text-[10px] font-bold leading-4 text-black">{count > 99 ? "99+" : count}</span> : null}
              </Link>
            );
          })}
          <button type="button" onClick={() => setOpen(true)} className={cn("flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium", moreActive ? "text-accent-ink" : "text-muted")} aria-label="More pages" aria-expanded={open}>
            <MoreHorizontal size={21} />
            More
          </button>
        </div>
      </nav>

      <aside className="no-print fixed inset-y-0 left-0 z-20 hidden w-[236px] border-r border-line bg-surface lg:block">{nav}</aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(300px,85vw)] border-r border-line bg-surface pt-[env(safe-area-inset-top)] shadow-[var(--shadow-lg)]">
            <button className="btn btn-ghost btn-sm absolute right-2 top-[calc(16px+env(safe-area-inset-top))] px-1.5" onClick={() => setOpen(false)} aria-label="Close menu">
              <X size={18} />
            </button>
            {nav}
          </aside>
        </div>
      ) : null}
    </>
  );
}
