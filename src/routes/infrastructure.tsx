import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { listAccounts, listInstances, type Account } from "@/lib/grafana-api";
import { formatValue } from "@/hooks/use-metric";

export const Route = createFileRoute("/infrastructure")({
  head: () => ({ meta: [{ title: "Infrastructure - CloudPulse" }] }),
  component: Infrastructure,
});

type HostRow = {
  id: string;
  cpu: number | null;
  netIn: number | null;
  statusFailed: number | null;
};

function Infrastructure() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountUid, setAccountUid] = useState("");
  const [rows, setRows] = useState<HostRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listAccounts().then((a) => {
      setAccounts(a);
      if (a.length) setAccountUid((cur) => cur || a[0].uid);
    }).catch(() => {});
  }, []);

  const account = accounts.find((a) => a.uid === accountUid);
  const region = account?.jsonData?.defaultRegion ?? "us-east-1";

  useEffect(() => {
    if (!accountUid) return;
    setLoading(true); setRows([]);

    (async () => {
      const ids = await listInstances(accountUid, region);
      if (ids.length === 0) { setLoading(false); return; }

      // Batch: 3 metrics per instance in one query call
      const metricDefs = [
        { key: "cpu", metricName: "CPUUtilization", statistic: "Average" },
        { key: "netIn", metricName: "NetworkIn", statistic: "Average" },
        { key: "statusFailed", metricName: "StatusCheckFailed", statistic: "Maximum" },
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
        const res = await fetch("/grafana/api/ds/query", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: "now-30m", to: "now", queries }),
        });
        const json = await res.json();

        const latest = (refId: string): number | null => {
          const frames = json?.results?.[refId]?.frames ?? [];
          for (const f of frames) {
            const vals = f?.data?.values?.[1] ?? [];
            for (let k = vals.length - 1; k >= 0; k--) {
              if (vals[k] != null) return vals[k];
            }
          }
          return null;
        };

        setRows(ids.map((id, i) => ({
          id,
          cpu: latest(`r${i}_0`),
          netIn: latest(`r${i}_1`),
          statusFailed: latest(`r${i}_2`),
        })));
      } catch { /* leave rows empty */ }
      setLoading(false);
    })();
  }, [accountUid, region]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Account
          <select value={accountUid} onChange={(e) => setAccountUid(e.target.value)}
            className="rounded border border-border bg-card px-2 py-1.5 text-sm text-foreground">
            {accounts.map((a) => <option key={a.uid} value={a.uid}>{a.name}</option>)}
          </select>
        </label>
        <span className="text-xs text-muted-foreground">{region}</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Instance</th>
              <th className="px-4 py-3 font-medium">CPU</th>
              <th className="px-4 py-3 font-medium">Network In</th>
              <th className="px-4 py-3 font-medium">Health</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-foreground">{r.id}</td>
                <td className="px-4 py-3 text-foreground">
                  {r.cpu === null ? "-" : (
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-1.5 w-16 overflow-hidden rounded bg-background">
                        <span className="block h-full rounded bg-[#4f8ff7]"
                          style={{ width: `${Math.min(100, r.cpu)}%` }} />
                      </span>
                      {formatValue(r.cpu, "percent")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-foreground">{r.netIn === null ? "-" : formatValue(r.netIn, "bytes")}</td>
                <td className="px-4 py-3">
                  {r.statusFailed === null ? (
                    <span className="text-xs text-muted-foreground">unknown</span>
                  ) : r.statusFailed > 0 ? (
                    <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs text-red-400">failing</span>
                  ) : (
                    <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">healthy</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground">
                {loading ? "Loading fleet..." : "No instances found in this account/region."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">Values are the latest datapoint from the last 30 minutes.</p>
    </div>
  );
}
