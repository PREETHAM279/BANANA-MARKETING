import Link from "next/link";
import { ArrowRight, CalendarCheck, Clock, PhoneCall } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ChartCard, DataTable, Funnel, HBarChart, SegmentedBar, StackedColumns, StatTile } from "@/components/charts";
import { getDashboard } from "@/lib/metrics";
import { ACTIVITY_LABEL } from "@/lib/constants";
import { dueLabel, formatDay, inr, relativeTime } from "@/lib/format";
import { InterestBadge, StatusBadge } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const d = await getDashboard();
  const k = d.kpis;
  const ratePct = Math.round(k.conversionRate * 100);
  const dayRows = d.days.map((x) => ({ ...x, label: formatDay(x.day), short: x.day.slice(8).replace(/^0/, "") }));

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${k.total} researched Bengaluru businesses · research date 3 Nov 2026 · everything is stored locally on this Mac`}
        actions={
          <>
            <Link href="/leads" className="btn">
              Open directory
            </Link>
            <Link href="/outreach" className="btn btn-primary">
              <CalendarCheck size={15} /> Plan tomorrow&apos;s calls
            </Link>
          </>
        }
      />

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Total leads" value={k.total} sub="Across 10 categories" href="/leads" />
        <StatTile label="Businesses researched" value={k.researched} sub="Profiles with sources" href="/leads" />
        <StatTile label="Businesses contacted" value={k.contacted} sub={`${k.total - k.contacted} still to reach`} href="/leads?contact=contacted" />
        <StatTile label="Calls completed" value={k.calls} sub={`${k.callsConnected} connected`} href="/communication?type=CALL" />
        <StatTile label="WhatsApp messages sent" value={k.whatsapp} sub="Confirmed by you" href="/communication?type=WHATSAPP" />
        <StatTile label="Emails sent" value={k.emails} sub="Confirmed or sent via SMTP" href="/communication?type=EMAIL" />
        <StatTile label="Interested prospects" value={k.interested} sub="Interested → converted" href="/leads?status=Interested" />
        <StatTile
          label="Follow-ups pending"
          value={k.followupsPending}
          sub={k.overdue ? `${k.overdue} overdue · ${k.dueToday} today` : k.dueToday ? `${k.dueToday} due today` : "Nothing overdue"}
          tone={k.overdue ? "bad" : k.dueToday ? "warn" : undefined}
          href="/followups"
        />
        <StatTile label="Meetings scheduled" value={k.meetings} sub="Status: Meeting Scheduled" href="/leads?status=Meeting%20Scheduled" />
        <StatTile label="Deals closed" value={k.converted} sub={k.wonValue ? `${inr(k.wonValue)} won` : `${ratePct}% conversion`} tone={k.converted ? "good" : undefined} href="/leads?status=Converted" />
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Leads by business category" subtitle="Click a bar to open those leads" table={<DataTable rows={d.byCategory} total={k.total} />}>
          <HBarChart items={d.byCategory} total={k.total} labelWidth="46%" />
        </ChartCard>

        <ChartCard title="Leads by location" subtitle="Bengaluru zone of the main address" table={<DataTable rows={[...d.byZone, ...d.topLocalities.map((l) => ({ ...l, label: `Locality · ${l.label}` }))]} total={k.total} />}>
          <HBarChart items={d.byZone} total={k.total} />
          <div className="mt-4">
            <div className="section-title mb-2">Top localities</div>
            <div className="flex flex-wrap gap-1.5">
              {d.topLocalities.map((l) => (
                <Link key={l.label} href={`/leads?q=${encodeURIComponent(l.label)}`} className="badge hover:border-line-strong">
                  {l.label} <span className="tabular text-muted">{l.value}</span>
                </Link>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Leads by potential interest" subtitle="Research assessment of buying likelihood" table={<DataTable rows={d.byInterest} total={k.total} />}>
          <SegmentedBar
            total={k.total}
            parts={[
              { ...d.byInterest[0], color: "var(--ord-3)", ink: "var(--ord-3-ink)" },
              { ...d.byInterest[1], color: "var(--ord-2)", ink: "var(--ord-2-ink)" },
              { ...d.byInterest[2], color: "var(--ord-1)", ink: "var(--ord-1-ink)" },
            ]}
          />
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {d.byInterest.map((x) => (
              <Link key={x.label} href={`/leads?interest=${x.label}`} className="rounded-lg border border-line px-2 py-2 hover:border-line-strong">
                <div className="text-[18px] font-semibold">{x.value}</div>
                <div className="text-[11.5px] text-muted">{x.label}</div>
              </Link>
            ))}
          </div>
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Outreach progress" subtitle="Leads in each pipeline stage" table={<DataTable rows={d.byStatus} total={k.total} />}>
          <HBarChart items={d.byStatus} total={k.total} labelWidth="44%" />
        </ChartCard>

        <ChartCard
          title="Outreach activity · last 14 days"
          subtitle="Logged calls, WhatsApp and emails"
          className="lg:col-span-1"
          table={
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="py-1.5 font-medium">Day</th>
                  <th className="py-1.5 text-right font-medium">Calls</th>
                  <th className="py-1.5 text-right font-medium">WhatsApp</th>
                  <th className="py-1.5 text-right font-medium">Emails</th>
                </tr>
              </thead>
              <tbody>
                {dayRows.map((r) => (
                  <tr key={r.day} className="border-b border-line last:border-0">
                    <td className="py-1">{r.label}</td>
                    <td className="tabular py-1 text-right">{r.calls}</td>
                    <td className="tabular py-1 text-right">{r.whatsapp}</td>
                    <td className="tabular py-1 text-right">{r.emails}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <StackedColumns
            data={dayRows}
            series={[
              { key: "calls", label: "Calls", color: "var(--series-1)" },
              { key: "whatsapp", label: "WhatsApp", color: "var(--series-2)" },
              { key: "emails", label: "Emails", color: "var(--series-3)" },
            ]}
          />
          {d.days.every((x) => !x.calls && !x.whatsapp && !x.emails) ? <p className="mt-3 text-[12px] text-muted">No outreach logged yet. Bars appear as you log calls, WhatsApp messages and emails.</p> : null}
        </ChartCard>

        <ChartCard title="Conversion" subtitle="Converted ÷ contacted" table={<DataTable rows={d.funnel} />}>
          <div className="mb-4 flex items-end gap-3">
            <div className="text-[48px] font-semibold leading-none tracking-[-0.03em]">{ratePct}%</div>
            <div className="pb-1 text-[12px] text-muted">
              {k.converted} converted of {k.contacted} contacted
              {k.pipelineValue ? (
                <>
                  <br />
                  {inr(k.pipelineValue)} open pipeline
                </>
              ) : null}
            </div>
          </div>
          <Funnel stages={d.funnel} />
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title flex items-center gap-2">
              <Clock size={15} className="text-muted" /> Needs attention
            </h2>
            <Link href="/followups" className="text-[12px] text-accent-ink hover:underline">
              All follow-ups
            </Link>
          </div>
          <ul className="divide-y divide-[var(--line)] px-2 pb-2">
            {d.attention.length === 0 ? <li className="px-2 py-6 text-center text-[12.5px] text-muted">No follow-ups due today or overdue.</li> : null}
            {d.attention.map((l) => {
              const due = dueLabel(l.followUpDate);
              return (
                <li key={l.id}>
                  <Link href={`/leads/${l.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-surface-2">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{l.name}</span>
                      <span className="block truncate text-[12px] text-muted">{l.followUpNote || l.nextAction || l.category}</span>
                    </span>
                    {due ? <span className={due.tone === "bad" ? "badge bg-bad-soft text-bad-ink" : "badge bg-warn-soft text-warn-ink"}>{due.text}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title flex items-center gap-2">
              <PhoneCall size={15} className="text-muted" /> Next best leads to contact
            </h2>
            <Link href="/outreach" className="text-[12px] text-accent-ink hover:underline">
              Call plan
            </Link>
          </div>
          <ul className="divide-y divide-[var(--line)] px-2 pb-2">
            {d.nextBest.map((l) => (
              <li key={l.id}>
                <Link href={`/leads/${l.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-surface-2">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="tabular w-6 shrink-0 text-right text-[12px] text-muted">#{l.priorityRank}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{l.name}</span>
                      <span className="block truncate text-[12px] text-muted">
                        {l.category} · {l.locality}
                      </span>
                    </span>
                  </span>
                  <InterestBadge level={l.interestLevel} />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Recent activity</h2>
            <Link href="/communication" className="text-[12px] text-accent-ink hover:underline">
              Communication log
            </Link>
          </div>
          <ul className="space-y-0.5 px-2 pb-2">
            {d.recent.length === 0 ? <li className="px-2 py-6 text-center text-[12.5px] text-muted">Your calls, messages and status changes will appear here.</li> : null}
            {d.recent.map((a) => (
              <li key={a.id}>
                <Link href={`/leads/${a.businessId}`} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                  <span className="badge mt-0.5 shrink-0">{ACTIVITY_LABEL[a.type] ?? a.type}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium">{a.businessName}</span>
                    <span className="block truncate text-[12px] text-muted">{a.summary}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted">{relativeTime(a.occurredAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {d.recent.some((a) => a.type === "STATUS") ? null : (
            <div className="px-4 pb-4">
              <Link href="/leads" className="inline-flex items-center gap-1 text-[12px] text-accent-ink hover:underline">
                Start with the directory <ArrowRight size={12} />
              </Link>
            </div>
          )}
        </section>
      </div>
      <p className="mt-6 text-[11.5px] text-muted">
        Status badges: <StatusBadge status="Researched" /> <StatusBadge status="Called" /> <StatusBadge status="Interested" /> <StatusBadge status="Follow-up Required" /> <StatusBadge status="Converted" />{" "}
        <StatusBadge status="Not Interested" />
      </p>
    </>
  );
}
