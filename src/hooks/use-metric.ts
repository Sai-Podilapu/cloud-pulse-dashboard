import { useCallback, useEffect, useRef, useState } from "react";
import type { Panel } from "@/config/panels";
import { authFetch } from "@/lib/auth";
import type { TimeRangeValue } from "@/lib/time-range";

export type MetricRow = Record<string, number> & { time: number };
export type SeriesInfo = { key: string; color?: string };

const PALETTE = ["#4f8ff7", "#e0894f", "#9d6ff7", "#5fd48a", "#f76f6f", "#f7d34f", "#6fd0f7", "#f76fc8"];

export function useMetric(panel: Panel, range: TimeRangeValue, dsUid: string, instanceIds: string[], region: string) {
  const [data, setData] = useState<MetricRow[]>([]);
  const [series, setSeries] = useState<SeriesInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    const isEC2Default = !panel.dimensions && panel.namespace === "AWS/EC2";
    if (!dsUid || (isEC2Default && instanceIds.length === 0)) { setLoading(false); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);

    // Build queries: for EC2-default panels, one query per (series x instance).
    // Panels with explicit dimensions keep their own dims (one query per series).
    type Q = { refId: string; label: string; color?: string; body: Record<string, unknown> };
    const qs: Q[] = [];
    const multi = isEC2Default && instanceIds.length > 1;

    panel.series.forEach((s) => {
      const targets = isEC2Default ? instanceIds : [""];
      targets.forEach((inst) => {
        const refId = `q${qs.length}`;
        const shortInst = inst ? inst.slice(-8) : "";
        const label = multi
          ? (panel.series.length > 1 ? `${s.label} ${shortInst}` : shortInst)
          : s.label;
        qs.push({
          refId, label,
          color: multi ? PALETTE[qs.length % PALETTE.length] : s.color,
          body: {
            refId,
            datasource: { type: "cloudwatch", uid: dsUid },
            queryMode: "Metrics", metricQueryType: 0, metricEditorMode: 0,
            namespace: panel.namespace, metricName: s.metricName,
            dimensions: panel.dimensions ?? (isEC2Default ? { InstanceId: inst } : {}),
            statistic: panel.statistic, period: panel.period,
            region, matchExact: true,
          },
        });
      });
    });

    try {
      const res = await authFetch("/grafana/api/ds/query", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: `now-${range}`, to: "now", queries: qs.map((q) => q.body) }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Query failed (${res.status})`);
      const json = await res.json();

      const merged = new Map<number, MetricRow>();
      qs.forEach((q) => {
        const frames = json?.results?.[q.refId]?.frames ?? [];
        for (const frame of frames) {
          const [ts, vals] = frame?.data?.values ?? [[], []];
          ts.forEach((t: number, idx: number) => {
            const row = merged.get(t) ?? ({ time: t } as MetricRow);
            if (vals[idx] != null) row[q.label] = vals[idx];
            merged.set(t, row);
          });
        }
      });
      setData([...merged.values()].sort((a, b) => a.time - b.time));
      setSeries(qs.map((q) => ({ key: q.label, color: q.color })));
      setLoading(false);
    } catch (e: unknown) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message || "Failed to load");
      setLoading(false);
    }
  }, [panel, range, dsUid, instanceIds, region]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => { clearInterval(id); abortRef.current?.abort(); };
  }, [fetchData]);

  return { data, series, loading, error, retry: fetchData };
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
