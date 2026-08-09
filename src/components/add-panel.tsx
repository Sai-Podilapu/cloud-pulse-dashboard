import { useEffect, useState } from "react";
import type { Panel } from "@/config/panels";
import { listNamespaces, listMetrics } from "@/lib/grafana-api";

const STATS = ["Average", "Sum", "Maximum"] as const;
const UNITS = ["count", "percent", "bytes"] as const;
const COLORS = ["#4f8ff7", "#e0894f", "#9d6ff7", "#5fd48a", "#f76f6f"];

export function AddPanel({ dsUid, region, onAdd, onClose }: {
  dsUid: string; region: string; onAdd: (p: Panel) => void; onClose: () => void;
}) {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [namespace, setNamespace] = useState("AWS/EC2");
  const [metrics, setMetrics] = useState<string[]>([]);
  const [metricName, setMetricName] = useState("");
  const [statistic, setStatistic] = useState<(typeof STATS)[number]>("Average");
  const [unit, setUnit] = useState<(typeof UNITS)[number]>("count");
  const [title, setTitle] = useState("");

  useEffect(() => { listNamespaces(dsUid, region).then(setNamespaces); }, [dsUid, region]);
  useEffect(() => {
    setMetrics([]); setMetricName("");
    listMetrics(dsUid, region, namespace).then((m) => { setMetrics(m); if (m.length) setMetricName(m[0]); });
  }, [dsUid, region, namespace]);

  const submit = () => {
    if (!metricName) return;
    onAdd({
      title: title.trim() || metricName,
      unit, namespace, statistic, period: "300",
      series: [{ label: metricName, metricName, color: COLORS[Math.floor(Math.random() * COLORS.length)] }],
    });
    onClose();
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Add panel</h3>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:underline">Cancel</button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Sel label="Namespace" value={namespace} onChange={setNamespace} options={namespaces} />
        <Sel label="Metric" value={metricName} onChange={setMetricName} options={metrics} />
        <Sel label="Statistic" value={statistic} onChange={(v) => setStatistic(v as typeof statistic)} options={[...STATS]} />
        <Sel label="Unit" value={unit} onChange={(v) => setUnit(v as typeof unit)} options={[...UNITS]} />
      </div>
      <label className="block text-xs text-muted-foreground">Title (optional)
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={metricName || "Panel title"}
          className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground" />
      </label>
      <button onClick={submit} disabled={!metricName}
        className="rounded bg-[#4f8ff7] px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
        Add panel
      </button>
      {namespace !== "AWS/EC2" && (
        <p className="text-[11px] text-muted-foreground">
          Note: non-EC2 metrics are queried without an instance filter — some need extra dimensions and may show aggregate or no data. Full dimension support comes in Phase 3.
        </p>
      )}
    </div>
  );
}

function Sel({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <label className="block text-xs text-muted-foreground">{label}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-sm text-foreground">
        {options.length === 0 && <option value="">Loading…</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
