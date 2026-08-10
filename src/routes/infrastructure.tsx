import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { listAccounts, listInstances, listRegions, ALL_REGIONS, type Account } from "@/lib/grafana-api";
import { formatValue } from "@/hooks/use-metric";
import { authFetch, useRequireAuth } from "@/lib/auth";
import { useTimeRange } from "@/lib/time-range";

export const Route = createFileRoute("/infrastructure")({
  head: () => ({ meta: [{ title: "Infrastructure - CloudPulse" }] }),
  component: Infrastructure,
});

type HostRow = {
  id: string;
  cpu: number | null;
  cpuSeries: { v: number }[];
  netIn: number | null;
  netOut: number | null;
  statusFailed: number | null;
};

type SortKey = "id" | "cpu" | "netIn" | "netOut";

function Infrastructure() {
  useRequireAuth();
  const { range } = useTimeRange();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountUid, setAccountUid] = useState("");
  const [regions, setRegions] = useState<string[]>(ALL_REGIONS);
  const [regionOverride, setRegionOverride] = useState("");
  const [rows, setRows] = useState<HostRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("cpu");
  const [sortDesc, setSortDesc] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    listAccounts().then((a) => {
      setAccounts(a);
      if (a.length) setAccountUid((cur) => cur || a[0].uid);
    }).catch(() => {});
  }, []);

  const account = accounts.find((a) => a.uid === accountUid);
  const defaultRegion = account?.jsonData?.defaultRegion ?? "us-east-1";
  const region = regionOverride || defaultRegion;

  useEffect(() => {
    setRegionOverride("");
    if (accountUid) listRegions(accountUid).then(setRegions);
  }, [accountUid]);

  useEffect(() => {
    if (!accountUid) return;
    let cancelled = false;

    const load = async (initial: boolean) => {
      if (initial) { setLoading(true); setRows([]); }
      const ids = await listInstances(accountUid, region);
      if (cancelled) return;
      if (ids.length === 0) { setRows([]); setLoading(false); setUpdatedAt(new Date()); return; }

      const metricDefs = [
        { metricName: "CPUUtilization", statistic: "Average" },
        { metricName: "NetworkIn", statistic: "Average" },
        { metricName: "NetworkOut", statistic: "Average" },
        { metricName: "StatusCheckFailed", statistic: "Maximum" },
      ] as const;

      const queries = ids.flatMap((inst, i) =>
        metricDefs.map((m, j) => ({
          refId: `r${i}_${j}`,
          datasource: { type: "cloudwatch", uid: accountUid },
          queryMode: "Metrics", metricQueryType: 0, metricEditorMode: 0,
          namespace: "AWS/EC2", metricName: m.metricName,
          dimensions: { InstanceId: inst },
          statistic: m.statistic, period: "300", region, matchExact: true,
        }))
      );

      try {
        const res = await authFetch("/grafana/api/ds/query", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: `now-${range}`, to: "now", queries }),
        });
        const json = await res.json();
        if (cancelled) return;

        const values = (refId: string): number[] => {
          const frames = json?.results?.[refId]?.frames ?? [];
          const out: number[] = [];
          for (const f of frames) {
            const vals = f?.data?.values?.[1] ?? [];
            for (const v of vals) if (v != null) out.push(v);
          }
          return out;
        };
        const last = (arr: number[]) => (arr.length ? arr[arr.length - 1] : null);

        setRows(ids.map((id, i) => {
          const cpuVals = values(`r${i}_0`);
          return {
            id,
            cpu: last(cpuVals),
            cpuSeries: cpuVals.map((v) => ({ v })),
            netIn: last(values(`r${i}_1`)),
            netOut: last(values(`r${i}_2`)),
            statusFailed: last(values(`r${i}_3`)),
          };
        }));
        setUpdatedAt(new Date());
      } catch { /* keep previous rows */ }
      setLoading(false);
    };

    load(true);
    const t = setInterval(() => load(false), 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [accountUid, region, range]);

  const visible = useMemo(() => {
    const filtered = rows.filter((r) => r.id.toLowerCase().includes(search.toLowerCase()));
    const dir = sortDesc ? -1 : 1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "id") return dir * a.id.localeCompare(b.id);
      const av = a[sortKey] ?? -1, bv = b[sortKey] ?? -1;
      return dir * (av - bv);
    });
  }, [rows, search, sortKey, sortDesc]);

  const clickSort = (k: SortKey) => {
    if (k === sortKey) setSortDesc((d) => !d);
    else { setSortKey(k); setSortDesc(true); }
  };
  const arrow = (k: SortKey) => (k === sortKey ? (sortDesc ? " \u2193" : " \u2191") : "");

  const activeCount = rows.filter((r) => r.cpu !== null).length;
  const staleCount = rows.length - activeCount;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Account
          <select value={accountUid} onChange={(e) => setAccountUid(e.target.value)}
            className="rounded border border-border bg-card px-2 py-1.5 text-sm text-foreground">
            {accounts.map((a) => <option key={a.uid} value={a.uid}>{a.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Region
          <select value={regionOverride} onChange={(e) => setRegionOverride(e.target.value)}
            className="rounded border border-border bg-card px-2 py-1.5 text-sm text-foreground">
            <option value="">Default ({defaultRegion})</option>
            {regions.filter((r) => r !== defaultRegion).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search instance id..."
          className="rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground" />
        <span className="ml-auto text-[11px] text-muted-foreground">
          {activeCount} active{staleCount > 0 ? ` \u00b7 ${staleCount} stale` : ""}
          {updatedAt ? ` \u00b7 updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="cursor-pointer px-4 py-3 font-medium" onClick={() => clickSort("id")}>Instance{arrow("id")}</th>
              <th className="cursor-pointer px-4 py-3 font-medium" onClick={() => clickSort("cpu")}>CPU{arrow("cpu")}</th>
              <th className="px-4 py-3 font-medium">CPU ({range})</th>
              <th className="cursor-pointer px-4 py-3 font-medium" onClick={() => clickSort("netIn")}>Net In{arrow("netIn")}</th>
              <th className="cursor-pointer px-4 py-3 font-medium" onClick={() => clickSort("netOut")}>Net Out{arrow("netOut")}</th>
              <th className="px-4 py-3 font-medium">Health</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const stale = r.cpu === null;
              return (
                <tr key={r.id} className={`border-b border-border last:border-0 ${stale ? "opacity-45" : ""}`}>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{r.id}</td>
                  <td className="px-4 py-3 text-foreground">
                    {stale ? "-" : (
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-1.5 w-16 overflow-hidden rounded bg-background">
                          <span className="block h-full rounded"
                            style={{
                              width: `${Math.min(100, r.cpu!)}%`,
                              background: r.cpu! > 80 ? "#f76f6f" : r.cpu! > 50 ? "#f7d34f" : "#4f8ff7",
                            }} />
                        </span>
                        {formatValue(r.cpu!, "percent")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2" style={{ width: 120 }}>
                    {r.cpuSeries.length > 1 && (
                      <div style={{ width: 100, height: 28 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={r.cpuSeries} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                            <Area type="monotone" dataKey="v" stroke="#4f8ff7" strokeWidth={1.5}
                              fill="#4f8ff7" fillOpacity={0.12} dot={false} isAnimationActive={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground">{r.netIn === null ? "-" : formatValue(r.netIn, "bytes")}</td>
                  <td className="px-4 py-3 text-foreground">{r.netOut === null ? "-" : formatValue(r.netOut, "bytes")}</td>
                  <td className="px-4 py-3">
                    {stale ? (
                      <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">no recent data</span>
                    ) : r.statusFailed !== null && r.statusFailed > 0 ? (
                      <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs text-red-400">failing</span>
                    ) : (
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">healthy</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-xs text-muted-foreground">
                {loading ? "Loading fleet..." : search ? "No instances match your search." : "No instances found in this account/region."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Auto-refreshes every 60s. Values show the latest datapoint; sparkline covers the selected time range. "No recent data" usually means a stopped or terminated instance (CloudWatch keeps history ~2 weeks).
      </p>
    </div>
  );
}
