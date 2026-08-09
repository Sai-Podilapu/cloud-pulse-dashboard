import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTimeRange } from "@/lib/time-range";
import type { Panel } from "@/config/panels";
import { useMetric, formatValue } from "@/hooks/use-metric";

const ACCENT = "#4f8ff7";

export function PanelCard({ panel, dsUid, instanceId, region }: { panel: Panel; dsUid: string; instanceId: string; region: string }) {
  const { range } = useTimeRange();
  const { data, loading, error, retry } = useMetric(panel, range, dsUid, instanceId, region);
  const latest = data.length ? data[data.length - 1][panel.series[0].label] : undefined;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="truncate text-sm font-medium text-foreground">{panel.title}</h2>
        {latest !== undefined && (
          <span className="text-base font-semibold" style={{ color: ACCENT }}>
            {formatValue(latest, panel.unit)}
          </span>
        )}
      </header>
      <div className="relative h-[340px] p-2">
        {loading && data.length === 0 && !error && (
          <div className="absolute inset-0 bg-card"><div className="shimmer h-full w-full" /></div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-xs text-muted-foreground">{error}</p>
            <button onClick={retry} className="rounded border border-border px-3 py-1 text-xs text-foreground hover:bg-white/5">
              Retry
            </button>
          </div>
        )}
        {!error && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                {panel.series.map((s, i) => (
                  <linearGradient key={i} id={`g${panel.title.replace(/\W/g, "")}${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color ?? ACCENT} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={s.color ?? ACCENT} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="#2c3235" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="time" stroke="#8e939c" fontSize={11} tickLine={false} axisLine={false} minTickGap={40}
                tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} />
              <YAxis stroke="#8e939c" fontSize={11} tickLine={false} axisLine={false} width={52}
                tickFormatter={(v) => formatValue(v, panel.unit)} />
              <Tooltip
                contentStyle={{ background: "#181b1f", border: "1px solid #2c3235", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(t) => new Date(t as number).toLocaleString()}
                formatter={(value: number, name: string) => [formatValue(value, panel.unit), name]} />
              {panel.series.map((s, i) => (
                <Area key={s.label} type="monotone" dataKey={s.label} stroke={s.color ?? ACCENT} strokeWidth={2}
                  fill={`url(#g${panel.title.replace(/\W/g, "")}${i})`} dot={false} connectNulls isAnimationActive={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
        {!error && !loading && data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">No data yet — new metrics can take a few minutes.</p>
          </div>
        )}
      </div>
    </section>
  );
}
