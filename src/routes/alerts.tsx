import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { listAccounts, listNamespaces, listMetrics, listDimensionKeys, listDimensionValues, type Account } from "@/lib/grafana-api";
import { authFetch, useRequireAuth } from "@/lib/auth";

export const Route = createFileRoute("/alerts")({
  head: () => ({ meta: [{ title: "Alerts - CloudPulse" }] }),
  component: Alerts,
});

type RuleState = { status: "firing" | "ok" | "no-data" | "pending"; lastValue?: number | null; since?: number };
type Rule = {
  id: string; name: string; dsUid: string; region: string; namespace: string;
  metricName: string; statistic: string; op: "<" | ">"; threshold: number;
  dimensions: Record<string, string>; webhook: string; enabled: boolean; state: RuleState;
};

function Alerts() {
  useRequireAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editRule, setEditRule] = useState<Rule | null>(null);

  const refresh = () =>
    authFetch("/alerts-api/rules").then((r) => r.json()).then(setRules).catch(() => {});

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, []);

  const toggle = (id: string) =>
    authFetch("/alerts-api/rules/toggle", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).then(refresh);

  const remove = (id: string) => {
    if (!window.confirm("Delete this alert rule?")) return;
    authFetch("/alerts-api/rules/delete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).then(refresh);
  };

  const badge = (s: RuleState["status"]) => {
    if (s === "firing") return <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs text-red-400">firing</span>;
    if (s === "ok") return <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">ok</span>;
    if (s === "no-data") return <span className="rounded bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-400">no data</span>;
    return <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">pending</span>;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Rules are evaluated every 60 seconds against the latest datapoint.</p>
        <button onClick={() => setShowForm(true)}
          className="rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-white/5">
          + New alert
        </button>
      </div>

      {showForm && <RuleForm initial={editRule} onDone={() => { setShowForm(false); setEditRule(null); refresh(); }} onCancel={() => { setShowForm(false); setEditRule(null); }} />}

      <div className="space-y-3">
        {rules.map((r) => (
          <div key={r.id} className={`flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 ${r.enabled === false ? "opacity-50" : ""}`}>
            {badge(r.enabled === false ? "pending" : r.state.status)}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {r.namespace} / {r.metricName} ({r.statistic}) {r.op} {r.threshold}
                {Object.entries(r.dimensions).map(([k, v]) => ` · ${k}=${v}`)}
                {" · "}{r.region}
                {r.state.lastValue != null && ` · latest: ${Number(r.state.lastValue).toFixed(2)}`}{(r as Rule & {email?: string}).email ? ` · ✉ ${(r as Rule & {email?: string}).email}` : ""}
              </p>
            </div>
            <button onClick={() => { setEditRule(r); setShowForm(true); }} className="text-xs text-muted-foreground hover:text-[#4f8ff7]">Edit</button>
            <button onClick={() => toggle(r.id)} className="text-xs text-muted-foreground hover:text-foreground">
              {r.enabled === false ? "Enable" : "Disable"}
            </button>
            <button onClick={() => remove(r.id)} className="text-xs text-muted-foreground hover:text-red-400">Delete</button>
          </div>
        ))}
        {rules.length === 0 && !showForm && (
          <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No alert rules yet — create one to start monitoring thresholds.
          </div>
        )}
      </div>
    </div>
  );
}

function RuleForm({ initial, onDone, onCancel }: { initial?: Rule | null; onDone: () => void; onCancel: () => void }) {
  const init = initial ?? null;
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dsUid, setDsUid] = useState(init?.dsUid ?? "");
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [namespace, setNamespace] = useState(init?.namespace ?? "AWS/EC2");
  const [metrics, setMetrics] = useState<string[]>([]);
  const [metricName, setMetricName] = useState(init?.metricName ?? "");
  const [statistic, setStatistic] = useState(init?.statistic ?? "Average");
  const [op, setOp] = useState<"<" | ">">(init?.op ?? ">");
  const [threshold, setThreshold] = useState(init ? String(init.threshold) : "80");
  const [name, setName] = useState(init?.name ?? "");
  const [webhook, setWebhook] = useState(init?.webhook ?? "");
  const [email, setEmail] = useState(init?.email ?? "");
  const [dimKeys, setDimKeys] = useState<string[]>([]);
  const initDimKey = init ? Object.keys(init.dimensions ?? {})[0] ?? "" : "";
  const [dimKey, setDimKey] = useState(initDimKey);
  const [dimValues, setDimValues] = useState<string[]>([]);
  const [dimValue, setDimValue] = useState(initDimKey ? (init?.dimensions?.[initDimKey] ?? "") : "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAccounts().then((a) => { setAccounts(a); if (a.length) setDsUid((cur) => cur || a[0].uid); });
  }, []);
  const account = accounts.find((a) => a.uid === dsUid);
  const region = account?.jsonData?.defaultRegion ?? "us-east-1";

  useEffect(() => { if (dsUid) listNamespaces(dsUid, region).then(setNamespaces); }, [dsUid, region]);
  useEffect(() => {
    if (!dsUid) return;
    listMetrics(dsUid, region, namespace).then((m) => { setMetrics(m); setMetricName((cur) => (cur && m.includes(cur)) ? cur : (m[0] ?? "")); });
  }, [dsUid, region, namespace]);
  useEffect(() => {
    if (!metricName) { setDimKeys([]); return; }
    listDimensionKeys(dsUid, region, namespace, metricName).then(setDimKeys);
  }, [dsUid, region, namespace, metricName]);
  useEffect(() => {
    if (!dimKey) { setDimValues([]); setDimValue(""); return; }
    listDimensionValues(dsUid, region, namespace, metricName, dimKey).then((v) => {
      setDimValues(v);
      setDimValue((cur) => (cur && v.includes(cur)) ? cur : (v[0] ?? ""));
    });
  }, [dsUid, region, namespace, metricName, dimKey]);

  const submit = async () => {
    setError(null);
    const t = parseFloat(threshold);
    if (Number.isNaN(t)) { setError("Threshold must be a number"); return; }
    const res = await authFetch(init ? "/alerts-api/rules/update" : "/alerts-api/rules", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(init ? { id: init.id } : {}),
        name: name.trim() || `${metricName} ${op} ${threshold}`,
        dsUid, region, namespace, metricName, statistic, op, threshold: t,
        dimensions: dimKey && dimValue ? { [dimKey]: dimValue } : {},
        webhook: webhook.trim(),
        email: email.trim(),
      }),
    });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || "Failed to create"); return; }
    onDone();
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">{init ? "Edit alert rule" : "New alert rule"}</h3>
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:underline">Cancel</button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Sel label="Account" value={dsUid} onChange={setDsUid}
          options={accounts.map((a) => ({ v: a.uid, l: a.name }))} />
        <Sel label="Namespace" value={namespace} onChange={setNamespace}
          options={namespaces.map((n) => ({ v: n, l: n }))} />
        <Sel label="Metric" value={metricName} onChange={setMetricName}
          options={metrics.map((m) => ({ v: m, l: m }))} />
        <Sel label="Statistic" value={statistic} onChange={setStatistic}
          options={["Average", "Sum", "Maximum"].map((s) => ({ v: s, l: s }))} />
        <Sel label="Resource (optional)" value={dimKey} onChange={setDimKey}
          options={[{ v: "", l: "Any / aggregate" }, ...dimKeys.map((k) => ({ v: k, l: k }))]} />
        {dimKey && (
          <Sel label="Value" value={dimValue} onChange={setDimValue}
            options={dimValues.map((v) => ({ v, l: v }))} />
        )}
        <label className="block text-xs text-muted-foreground">Condition
          <div className="mt-1 flex gap-2">
            <select value={op} onChange={(e) => setOp(e.target.value as "<" | ">")}
              className="rounded border border-border bg-background px-2 py-2 text-sm text-foreground">
              <option value=">">above</option>
              <option value="<">below</option>
            </select>
            <input value={threshold} onChange={(e) => setThreshold(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground" />
          </div>
        </label>
        <label className="block text-xs text-muted-foreground sm:col-span-2">Name (optional)
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="High CPU on prod"
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground" />
        </label>
        <label className="block text-xs text-muted-foreground sm:col-span-3">Email (optional — notifies on fire/resolve)
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com"
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground" />
        </label>
        <label className="block text-xs text-muted-foreground sm:col-span-3">Webhook URL (optional — Slack, Discord, or any endpoint)
          <input value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/..."
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground" />
        </label>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button onClick={submit} disabled={!dsUid || !metricName}
        className="rounded bg-[#4f8ff7] px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
        {init ? "Save changes" : "Create alert"}
      </button>
    </div>
  );
}

function Sel({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[];
}) {
  return (
    <label className="block text-xs text-muted-foreground">{label}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-sm text-foreground">
        {options.length === 0 && <option value="">-</option>}
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}
