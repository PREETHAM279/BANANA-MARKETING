"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Table2, BarChart3 } from "lucide-react";
import { cn } from "@/lib/format";

/* Charts follow the dataviz spec: thin marks (<=24px), 4px rounded data-ends,
   one baseline, hairline axes, values at the tip, a hover/focus tooltip on every
   mark, legends for >=2 series, and a table view for every chart. */

export type Datum = { label: string; value: number; href?: string };

export function ChartCard({ title, subtitle, children, table, className, action }: { title: string; subtitle?: string; children: ReactNode; table: ReactNode; className?: string; action?: ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={cn("card flex flex-col", className)}>
      <div className="card-header">
        <div className="min-w-0">
          <h2 className="card-title">{title}</h2>
          {subtitle ? <p className="card-sub">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-1">
          {action}
          <button className="btn btn-ghost btn-sm px-2 text-muted" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} title={asTable ? "Show chart" : "Show as table"}>
            {asTable ? <BarChart3 size={14} /> : <Table2 size={14} />}
            <span className="hidden sm:inline">{asTable ? "Chart" : "Table"}</span>
          </button>
        </div>
      </div>
      <div className="flex-1 px-4 pb-4">{asTable ? table : children}</div>
    </section>
  );
}

export function DataTable({ rows, valueLabel = "Count", total }: { rows: Datum[]; valueLabel?: string; total?: number }) {
  return (
    <table className="w-full text-[12.5px]">
      <thead>
        <tr className="border-b border-line text-left text-muted">
          <th className="py-1.5 font-medium">Item</th>
          <th className="py-1.5 text-right font-medium">{valueLabel}</th>
          {total ? <th className="py-1.5 text-right font-medium">Share</th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-line last:border-0">
            <td className="py-1.5">{r.label}</td>
            <td className="tabular py-1.5 text-right">{r.value}</td>
            {total ? <td className="tabular py-1.5 text-right text-muted">{Math.round((r.value / total) * 100)}%</td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Tooltip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-[var(--shadow-lg)]" style={{ left: x, top: y - 6 }} role="tooltip">
      {children}
    </div>
  );
}

/** Ranked/ordered horizontal bars, one hue. */
export function HBarChart({ items, total, color = "var(--series-1)", unit = "leads", labelWidth = "38%" }: { items: Datum[]; total?: number; color?: string; unit?: string; labelWidth?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null);
  const show = (i: number, el: HTMLElement) => {
    const parent = el.closest("[data-chart]") as HTMLElement;
    const r = el.getBoundingClientRect();
    const p = parent.getBoundingClientRect();
    setTip({ i, x: r.left - p.left + r.width / 2, y: r.top - p.top });
  };
  return (
    <div className="relative" data-chart onMouseLeave={() => setTip(null)}>
      <ul className="space-y-[7px]">
        {items.map((it, i) => {
          const frac = it.value / max;
          const inner = (
            <span className="grid items-center gap-3" style={{ gridTemplateColumns: `${labelWidth} 1fr` }}>
              <span className="truncate text-[12.5px] text-ink-2">{it.label}</span>
              <span className="flex h-[18px] items-center gap-1.5 border-l border-[var(--axis)]">
                <span className="block h-[14px] rounded-r-[4px] transition-[width] duration-300" style={{ width: `calc((100% - 40px) * ${frac})`, minWidth: it.value ? 3 : 0, background: color }} />
                <span className="tabular text-[12px] font-medium text-ink-2">{it.value}</span>
              </span>
            </span>
          );
          const common = {
            onMouseEnter: (e: React.MouseEvent<HTMLElement>) => show(i, e.currentTarget),
            onFocus: (e: React.FocusEvent<HTMLElement>) => show(i, e.currentTarget),
            onBlur: () => setTip(null),
            "aria-label": `${it.label}: ${it.value} ${unit}`,
            className: "block rounded-md px-1 py-[1px] outline-offset-1 hover:bg-surface-2",
          };
          return (
            <li key={it.label}>
              {it.href ? (
                <Link href={it.href} {...common}>
                  {inner}
                </Link>
              ) : (
                <span tabIndex={0} {...common}>
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {tip ? (
        <Tooltip x={tip.x} y={tip.y}>
          <div className="font-medium">{items[tip.i].label}</div>
          <div className="text-muted">
            {items[tip.i].value} {unit}
            {total ? ` · ${Math.round((items[tip.i].value / total) * 100)}%` : ""}
            {items[tip.i].href ? " · click to open" : ""}
          </div>
        </Tooltip>
      ) : null}
    </div>
  );
}

/** Tall segmented bar: one whole split into <= 6 ordered parts. */
export function SegmentedBar({ parts, total }: { parts: (Datum & { color: string; ink: string })[]; total: number }) {
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null);
  const nonZero = parts.filter((p) => p.value > 0);
  return (
    <div>
      <div className="relative" data-chart onMouseLeave={() => setTip(null)}>
        <div className="flex h-7 w-full gap-[2px]" role="img" aria-label={parts.map((p) => `${p.label} ${p.value} (${Math.round((p.value / total) * 100)}%)`).join(", ")}>
          {nonZero.map((p) => {
            const i = parts.indexOf(p);
            const share = Math.round((p.value / total) * 100);
            return (
              <div
                key={p.label}
                tabIndex={0}
                className="flex h-full items-center overflow-hidden rounded-[4px] px-2 text-[12px] font-semibold"
                style={{ flexGrow: p.value, flexBasis: 0, background: p.color, color: p.ink }}
                onMouseEnter={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const pr = (e.currentTarget.closest("[data-chart]") as HTMLElement).getBoundingClientRect();
                  setTip({ i, x: r.left - pr.left + r.width / 2, y: r.top - pr.top });
                }}
                onFocus={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const pr = (e.currentTarget.closest("[data-chart]") as HTMLElement).getBoundingClientRect();
                  setTip({ i, x: r.left - pr.left + r.width / 2, y: r.top - pr.top });
                }}
                onBlur={() => setTip(null)}
              >
                {share >= 12 ? `${share}%` : ""}
              </div>
            );
          })}
        </div>
        {tip ? (
          <Tooltip x={tip.x} y={tip.y}>
            <div className="font-medium">{parts[tip.i].label}</div>
            <div className="text-muted">
              {parts[tip.i].value} leads · {Math.round((parts[tip.i].value / total) * 100)}%
            </div>
          </Tooltip>
        ) : null}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: p.color }} aria-hidden />
            {p.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

type Series = { key: string; label: string; color: string };

/** Stacked columns over days (<= 3 series), 2px surface gaps, rounded top only. */
export function StackedColumns({ data, series, height = 150 }: { data: Record<string, number | string>[]; series: Series[]; height?: number }) {
  const totals = data.map((d) => series.reduce((s, se) => s + Number(d[se.key] || 0), 0));
  const rawMax = Math.max(0, ...totals);
  const max = rawMax <= 4 ? 4 : Math.ceil(rawMax / 4) * 4;
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null);
  const ticks = [0, max / 2, max];
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="relative flex gap-2" data-chart onMouseLeave={() => setTip(null)}>
        <div className="flex flex-col justify-between text-right text-[11px] text-muted tabular" style={{ height }}>
          {[...ticks].reverse().map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {t}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px" style={{ bottom: (t / max) * height, background: t === 0 ? "var(--axis)" : "var(--grid)" }} />
          ))}
          <div className="relative flex items-end" style={{ height }}>
            {data.map((d, i) => {
              const total = totals[i];
              return (
                <div
                  key={String(d.day)}
                  className="flex h-full flex-1 items-end justify-center outline-offset-0"
                  tabIndex={0}
                  aria-label={`${d.label}: ${series.map((s) => `${s.label} ${d[s.key] || 0}`).join(", ")}`}
                  onMouseEnter={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    const pr = (e.currentTarget.closest("[data-chart]") as HTMLElement).getBoundingClientRect();
                    setTip({ i, x: r.left - pr.left + r.width / 2, y: height - (total / max) * height + 8 });
                  }}
                  onFocus={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    const pr = (e.currentTarget.closest("[data-chart]") as HTMLElement).getBoundingClientRect();
                    setTip({ i, x: r.left - pr.left + r.width / 2, y: height - (total / max) * height + 8 });
                  }}
                  onBlur={() => setTip(null)}
                >
                  <div className="flex w-[60%] max-w-[22px] flex-col-reverse gap-[2px]" style={{ height: (total / max) * height }}>
                    {series.map((s, si) => {
                      const v = Number(d[s.key] || 0);
                      if (!v) return null;
                      const isTop = series.slice(si + 1).every((x) => !Number(d[x.key] || 0));
                      return <div key={s.key} className={cn("w-full", isTop ? "rounded-t-[4px]" : "")} style={{ flexGrow: v, flexBasis: 0, background: s.color }} />;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex text-[10.5px] text-muted">
            {data.map((d, i) => (
              <span key={String(d.day)} className="flex-1 text-center">
                {i === data.length - 1 ? "Today" : i % 2 === 1 ? String(d.short) : ""}
              </span>
            ))}
          </div>
          {tip ? (
            <Tooltip x={tip.x} y={tip.y}>
              <div className="font-medium">{String(data[tip.i].label)}</div>
              {series.map((s) => (
                <div key={s.key} className="flex items-center gap-1.5 text-muted">
                  <span className="size-2 rounded-[2px]" style={{ background: s.color }} />
                  {s.label}: <span className="tabular text-ink">{Number(data[tip.i][s.key] || 0)}</span>
                </div>
              ))}
            </Tooltip>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Conversion funnel: ordered stages, one hue, conversion % at each step. */
export function Funnel({ stages }: { stages: Datum[] }) {
  const max = Math.max(1, stages[0]?.value || 1);
  return (
    <ol className="space-y-2.5">
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].value : null;
        const rate = prev ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={s.label} className="grid grid-cols-[110px_1fr] items-center gap-3" aria-label={`${s.label}: ${s.value}${rate != null ? `, ${rate}% of previous stage` : ""}`}>
            <span className="truncate text-[12.5px] text-ink-2">{s.label}</span>
            <span className="flex h-[18px] items-center gap-1.5 border-l border-[var(--axis)]">
              <span className="block h-[14px] rounded-r-[4px]" style={{ width: `calc((100% - 92px) * ${s.value / max})`, minWidth: s.value ? 3 : 0, background: "var(--series-1)" }} />
              <span className="tabular whitespace-nowrap text-[12px] font-medium text-ink-2">
                {s.value}
                {rate != null ? <span className="ml-1 font-normal text-muted">({rate}%)</span> : null}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function StatTile({ label, value, sub, href, tone }: { label: string; value: string | number; sub?: ReactNode; href?: string; tone?: "warn" | "good" | "bad" }) {
  const body = (
    <div className={cn("card h-full px-4 py-3.5 transition-colors", href ? "hover:border-line-strong" : "")}>
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.02em]">{value}</div>
      {sub ? <div className={cn("mt-0.5 text-[12px]", tone === "warn" ? "text-warn-ink" : tone === "bad" ? "text-bad-ink" : tone === "good" ? "text-good-ink" : "text-muted")}>{sub}</div> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
