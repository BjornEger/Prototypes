import { useEffect, useMemo, useState } from "react";
import { ApiOverview } from "@/lib/api";
import {
  addDays,
  formatWeekRange,
  fromISO,
  isoWeek,
  mondayOf,
  toISO,
} from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { CaretLeft, CaretRight, Warning, CheckCircle } from "@phosphor-icons/react";

const todayMonday = () => toISO(mondayOf(new Date()));

export default function Programoverblik() {
  const [weekStart, setWeekStart] = useState(todayMonday());
  const [data, setData] = useState(null);
  const monday = useMemo(() => fromISO(weekStart), [weekStart]);

  useEffect(() => {
    ApiOverview.get(weekStart).then(setData);
  }, [weekStart]);

  const shift = (d) => setWeekStart(toISO(addDays(monday, d * 7)));

  if (!data)
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-8 text-zinc-500">Indlæser overblik…</div>
    );

  const projectsTotal = data.breakdown.reduce((s, b) => s + b.hours, 0);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8" data-testid="programoverblik-page">
      <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6">
        <div>
          <div className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-1">
            Programoverblik · uge {isoWeek(monday)}
          </div>
          <h1 className="font-outfit text-3xl md:text-4xl font-semibold tracking-tight text-zinc-950">
            {formatWeekRange(monday)}
          </h1>
          <div className="text-sm text-zinc-500 mt-1">
            {data.total_users} medarbejdere · 4 projekter · programledelse og PMO
          </div>
        </div>
        <div className="md:ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(-1)} data-testid="ovw-prev">
            <CaretLeft size={16} />
          </Button>
          <Button variant="outline" onClick={() => setWeekStart(todayMonday())} className="h-9 text-sm" data-testid="ovw-today">
            Denne uge
          </Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)} data-testid="ovw-next">
            <CaretRight size={16} />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Kpi label="Timer i alt" value={data.total_hours.toFixed(1)} testId="ovw-kpi-hours" />
        <Kpi label="Uger gemt" value={`${data.saved_percent}%`} testId="ovw-kpi-saved" />
        <Kpi
          label="Manglende ugeindberetninger"
          value={data.missing_users.length}
          intent={data.missing_users.length > 0 ? "warn" : "ok"}
          testId="ovw-kpi-missing"
        />
      </div>

      {/* Breakdown */}
      <section className="bg-white border border-zinc-200 rounded-lg shadow-sm mb-6" data-testid="ovw-breakdown">
        <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between">
          <h2 className="font-outfit text-base font-semibold text-zinc-950">Fordeling pr. område</h2>
          <span className="text-xs text-zinc-500">{projectsTotal.toFixed(1)} timer total</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 bg-zinc-50">
              <th className="px-5 py-2.5 font-semibold">Område</th>
              <th className="px-5 py-2.5 font-semibold text-right">Timer</th>
              <th className="px-5 py-2.5 font-semibold">Andel</th>
              <th className="px-5 py-2.5 font-semibold text-right">Personer</th>
            </tr>
          </thead>
          <tbody>
            {data.breakdown.map((b) => {
              const pct = projectsTotal > 0 ? (b.hours / projectsTotal) * 100 : 0;
              return (
                <tr key={b.id} className="border-t border-zinc-100" data-testid={`ovw-row-${b.id}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                          b.level === "program"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {b.level === "program" ? "PROGRAM" : b.code}
                      </span>
                      <span className="font-medium text-zinc-950">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-ibm-plex-mono font-semibold text-zinc-950 tabular-nums">
                    {b.hours.toFixed(1)}
                  </td>
                  <td className="px-5 py-3 w-[40%]">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 bg-zinc-100 rounded-full flex-1 overflow-hidden">
                        <div
                          className="h-full bg-zinc-900"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-500 tabular-nums w-10 text-right">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-zinc-700">{b.people}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Missing */}
      <section className="bg-white border border-zinc-200 rounded-lg shadow-sm" data-testid="ovw-missing">
        <div className="px-5 py-3 border-b border-zinc-200 flex items-center gap-2">
          {data.missing_users.length > 0 ? (
            <Warning size={18} className="text-amber-600" />
          ) : (
            <CheckCircle size={18} className="text-emerald-600" />
          )}
          <h2 className="font-outfit text-base font-semibold text-zinc-950">
            Mangler at gemme ugen
          </h2>
          <span className="text-xs text-zinc-500 ml-auto">
            {data.missing_users.length} af {data.total_users}
          </span>
        </div>
        {data.missing_users.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-500">
            Alle har gemt ugen. Pænt arbejde.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {data.missing_users.map((u) => (
              <li key={u.id} className="px-5 py-2.5 flex items-center gap-3 text-sm" data-testid={`missing-${u.id}`}>
                <span className="h-7 w-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[11px] font-semibold">
                  {u.name
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <span className="font-medium text-zinc-950">{u.name}</span>
                <span className="text-xs text-zinc-500 ml-2">{u.email}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, intent, testId }) {
  const c = intent === "warn" ? "text-amber-700" : intent === "ok" ? "text-emerald-700" : "text-zinc-950";
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm" data-testid={testId}>
      <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-3xl font-outfit font-semibold tabular-nums ${c}`}>{value}</div>
    </div>
  );
}
