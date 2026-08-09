import { useCallback, useEffect, useRef, useState } from "react";
import type { Panel } from "@/config/panels";
import type { TimeRangeValue } from "@/lib/time-range";

export type MetricRow = Record<string, number> & { time: number };

export function useMetric(panel: Panel, range: TimeRangeValue, dsUid: string, instanceId: string, region: string) {
  const [data, setData] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!dsUid || !instanceId) { setLoading(false); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);

    const queries = panel.series.map((s, i) => ({
      refId: String.fromCharCode(65 + i),
      datasource: { type: "cloudwatch", uid: dsUid },
      queryMode: "Metrics", metricQueryType: 0, metricEditorMode: 0,
      namespace: panel.namespace, metricName: s.metricName,
      dimensions: panel.namespace === "AWS/EC2" ? { InstanceId: instanceId } : {},
      statistic: panel.statistic, period: panel.period,
      region, matchExact: true,
    }));

    try {
      const res = await fetch("/grafana/api/ds/query", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: `now-${range}`, to: "now", queries }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Query failed (${res.status})`);
      const json = await res.json();
      const merged = new Map<number, MetricRow>();
      panel.series.forEach((s, i) => {
        const refId = String.fromCharCode(65 + i);
        const frames = json?.results?.[refId]?.frames ?? [];
        for (const frame of frames) {
          const [ts, vals] = frame?.data?.values ?? [[], []];
          ts.forEach((t: number, idx: number) => {
            const row = merged.get(t) ?? ({ time: t } as MetricRow);
            if (vals[idx] != null) row[s.label] = vals[idx];
            merged.set(t, row);
          });
        }
      });
      setData([...merged.values()].sort((a, b) => a.time - b.time));
      setLoading(false);
    } catch (e: unknown) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message || "Failed to load");
      setLoading(false);
    }
  }, [panel, range, dsUid, instanceId, region]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => { clearInterval(id); abortRef.current?.abort(); };
  }, [fetchData]);

  return { data, loading, error, retry: fetchData };
}

export function formatValue(v: number, unit: "percent" | "bytes" | "count") {
  if (unit === "percent") return `${v.toFixed(1)}%`;
  if (unit === "bytes") {
    if (v >= 1048576) return `${(v / 1048576).toFixed(1)} MB`;
    if (v >= 1024) return `${(v / 1024).toFixed(1)} KB`;
    return `${v.toFixed(0)} B`;
  }
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}`;
}
