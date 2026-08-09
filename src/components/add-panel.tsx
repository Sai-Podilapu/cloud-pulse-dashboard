import { useEffect, useState } from "react";
import type { Panel } from "@/config/panels";
import { listNamespaces, listMetrics, listDimensionKeys, listDimensionValues } from "@/lib/grafana-api";

const STATS = ["Average", "Sum", "Maximum"] as const;
const UNITS = ["count", "percent", "bytes"] as const;
const COLORS = ["#4f8ff7", "#e0894f", "#9d6ff7", "#5fd48a", "#f76f6f"];

type Dim = { key: string; value: string };

export function AddPanel({ dsUid, region, initial, onAdd, onClose }: {
  dsUid: string; region: string; initial?: Panel | null;
  onAdd: (p: Panel) => void; onClose: () => void;
}) {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [namespace, setNamespace] = useState(initial?.namespace ?? "AWS/EC2");
  const [metrics, setMetrics] = useState<string[]>([]);
  const [metricName, setMetricName] = useState(initial?.series[0]?.metricName ?? "");
  const [statistic, setStatistic] = useState<(typeof STATS)[number]>(
    (initial?.statistic as (typeof STATS)[number]) ?? "Average");
  const [unit, setUnit] = useState<(typeof UNITS)[number]>(
    (initial?.unit as (typeof UNITS)[number]) ?? "count");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [dims, setDims] = useState<Dim[]>(
    initial?.dimensions ? Object.entries(initial.dimensions).map(([key, value]) => ({ key, value })) : []);
  const [dimKeys, setDimKeys] = useState<string[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newValues, setNewValues] = useState<string[]>([]);
  const [newValue, setNewValue] = useState("");
  const [firstLoad, setFirstLoad] = useState(true);

  useEffect(() => { listNamespaces(dsUid, region).then(setNamespaces); }, [dsUid, region]);

  useEffect(() => {
    setMetrics([]);
    if (!firstLoad) { setMetricName(""); setDims([]); }
    listMetrics(dsUid, region, namespace).then((m) => {
      setMetrics(m);
      setMetricName((cur) => (cur && m.includes(cur) ? cur : (m[0] ?? "")));
      setFirstLoad(false);
    });
  }, [dsUid, region, namespace]);

  useEffect(() => {
    if (!metricName) { setDimKeys([]); return; }
    listDimensionKeys(dsUid, region, namespace, metricName).then((k) => {
      setDimKeys(k);
      if (k.length) setNewKey((cur) => cur && k.includes(cur) ? cur : k[0]);
    });
  }, [dsUid, region, namespace, metricName]);

  useEffect(() => {
    setNewValues([]); setNewValue("");
    if (!newKey || !metricName) return;
    listDimensionValues(dsUid, region, namespace, metricName, newKey).then((v) => {
      setNewValues(v);
      if (v.length) setNewValue(v[0]);
    });
  }, [dsUid, region, namespace, metricName, newKey]);

  const addDim = () => {
    if (!newKey || !newValue) return;
    setDims((d) => [...d.filter((x) => x.key !== newKey), { key: newKey, value: newValue }]);
  };

  const submit = () => {
    if (!metricName) return;
    const dimensions = Object.fromEntries(dims.map((d) => [d.key, d.value]));
    onAdd({
      title: title.trim() || `${metricName}${dims.length ? ` (${dims.map((d) => d.value).join(", ")})` : ""}`,
      unit, namespace, statistic, period: "300",
      series: [{
        label: metricName, metricName,
        color: initial?.series[0]?.color ?? COLORS[Math.floor(Math.random() * COLORS.length)],
      }],
      ...(dims.length ? { dimensions } : {}),
    });
    onClose();
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">{initial ? "Edit panel" : "Add panel"}</h3>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:underline">Cancel</button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Sel label="Namespace" value={namespace} onChange={setNamespace} options={namespaces} />
        <Sel label="Metric" value={metricName} onChange={setMetricName} options={metrics} />
        <Sel label="Statistic" value={statistic} onChange={(v) => setStatistic(v as typeof statistic)} options={[...STATS]} />
        <Sel label="Unit" value={unit} onChange={(v) => setUnit(v as typeof unit)} options={[...UNITS]} />
      </div>

      <div className="rounded border border-border p-3 space-y-2">
        <p className="text-xs font-medium text-foreground">Filter by resource (dimensions)</p>
        {dims.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {dims.map((d) => (
              <span key={d.key} className="flex items-center gap-1 rounded bg-background px-2 py-1 text-[11px] text-foreground border border-border">
                {d.key} = {d.value}
                <button onClick={() => setDims((x) => x.filter((y) => y.key !== d.key))}
                  className="text-muted-foreground hover:text-red-400">x</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <Sel label="Dimension" value={newKey} onChange={setNewKey} options={dimKeys} small />
          <Sel label="Value" value={newValue} onChange={setNewValue} options={newValues} small />
          <button onClick={addDim} disabled={!newKey || !newValue}
            className="rounded border border-border px-3 py-1.5 text-xs text-foreground hover:bg-white/5 disabled:opacity-40">
            Add filter
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          No filters = EC2 panels follow the selected instances; other namespaces aggregate across resources.
        </p>
      </div>

      <label className="block text-xs text-muted-foreground">Title (optional)
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={metricName || "Panel title"}
          className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground" />
      </label>
      <button onClick={submit} disabled={!metricName}
        className="rounded bg-[#4f8ff7] px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
        {initial ? "Save changes" : "Add panel"}
      </button>
    </div>
  );
}

function Sel({ label, value, onChange, options, small }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; small?: boolean;
}) {
  return (
    <label className={`block text-xs text-muted-foreground ${small ? "min-w-[140px]" : ""}`}>{label}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-sm text-foreground">
        {options.length === 0 && <option value="">-</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
