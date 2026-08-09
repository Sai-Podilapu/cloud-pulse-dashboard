import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PanelCard } from "@/components/panel-card";
import { AddPanel } from "@/components/add-panel";
import { panels as defaultPanels, type Panel } from "@/config/panels";
import { listAccounts, listInstances, type Account } from "@/lib/grafana-api";
import { loadCustomPanels, saveCustomPanels } from "@/lib/custom-panels";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Overview — CloudPulse Monitoring" }] }),
  component: Overview,
});

function Overview() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountUid, setAccountUid] = useState("");
  const [instances, setInstances] = useState<string[]>([]);
  const [instanceId, setInstanceId] = useState("");
  const [customPanels, setCustomPanels] = useState<Panel[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setCustomPanels(loadCustomPanels());
    listAccounts().then((a) => {
      setAccounts(a);
      if (a.length) setAccountUid((cur) => cur || a[0].uid);
    }).catch(() => {});
  }, []);

  const account = accounts.find((a) => a.uid === accountUid);
  const region = account?.jsonData?.defaultRegion ?? "us-east-1";

  useEffect(() => {
    if (!accountUid) return;
    setInstances([]); setInstanceId("");
    listInstances(accountUid, region).then((ids) => {
      setInstances(ids);
      if (ids.length) setInstanceId(ids[0]);
    });
  }, [accountUid, region]);

  const addPanel = (p: Panel) => {
    const next = [...customPanels, p];
    setCustomPanels(next); saveCustomPanels(next);
  };
  const removePanel = (idx: number) => {
    const next = customPanels.filter((_, i) => i !== idx);
    setCustomPanels(next); saveCustomPanels(next);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Select label="Account" value={accountUid} onChange={setAccountUid}
          options={accounts.map((a) => ({ value: a.uid, label: a.name }))} />
        <Select label="Instance" value={instanceId} onChange={setInstanceId}
          options={instances.map((i) => ({ value: i, label: i }))} />
        <button onClick={() => setAdding(true)}
          className="ml-auto rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-white/5">
          + Add panel
        </button>
      </div>

      {adding && accountUid && (
        <AddPanel dsUid={accountUid} region={region} onAdd={addPanel} onClose={() => setAdding(false)} />
      )}

      {accountUid && instanceId ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
          {defaultPanels.map((panel) => (
            <PanelCard key={panel.title} panel={panel} dsUid={accountUid} instanceId={instanceId} region={region} />
          ))}
          {customPanels.map((panel, idx) => (
            <div key={`c-${idx}-${panel.title}`} className="relative">
              <button onClick={() => removePanel(idx)}
                className="absolute right-3 top-3 z-10 text-[11px] text-muted-foreground hover:text-red-400">
                remove
              </button>
              <PanelCard panel={panel} dsUid={accountUid} instanceId={instanceId} region={region} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {accounts.length === 0 ? "No accounts connected — add one in Settings." : "Loading instances…"}
        </p>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded border border-border bg-card px-2 py-1.5 text-sm text-foreground">
        {options.length === 0 && <option value="">—</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
