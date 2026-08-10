import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PanelCard } from "@/components/panel-card";
import { AddPanel } from "@/components/add-panel";
import type { Panel } from "@/config/panels";
import { listAccounts, listInstances, listRegions, ALL_REGIONS, type Account } from "@/lib/grafana-api";
import {
  loadDashboards, saveDashboards, loadActiveId, saveActiveId, newId, type Dashboard,
} from "@/lib/dashboards";
import { useRequireAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Overview - CloudPulse Monitoring" }] }),
  component: Overview,
});

function Overview() {
  useRequireAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountUid, setAccountUid] = useState("");
  const [instances, setInstances] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [regionOverride, setRegionOverride] = useState("");
  const [regions, setRegions] = useState<string[]>(ALL_REGIONS);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeId, setActiveId] = useState("default");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  useEffect(() => {
    loadDashboards().then(setDashboards);
    setActiveId(loadActiveId());
    listAccounts().then((a) => {
      setAccounts(a);
      if (a.length) setAccountUid((cur) => cur || a[0].uid);
    }).catch(() => {});
  }, []);

  const account = accounts.find((a) => a.uid === accountUid);
  const defaultRegion = account?.jsonData?.defaultRegion ?? "us-east-1";
  const region = regionOverride || defaultRegion;
  const active = dashboards.find((d) => d.id === activeId) ?? dashboards[0];

  useEffect(() => {
    setRegionOverride("");
    if (accountUid) listRegions(accountUid).then(setRegions);
  }, [accountUid]);

  useEffect(() => {
    if (!accountUid) return;
    setInstances([]); setSelectedIds([]);
    listInstances(accountUid, region).then((ids) => {
      setInstances(ids);
      if (ids.length) setSelectedIds([ids[0]]);
    });
  }, [accountUid, region]);

  const update = (next: Dashboard[]) => { setDashboards(next); saveDashboards(next); };
  const switchTo = (id: string) => { setActiveId(id); saveActiveId(id); };

  const createDashboard = () => {
    const name = window.prompt("Dashboard name:", "New dashboard");
    if (!name?.trim()) return;
    const d: Dashboard = { id: newId(), name: name.trim(), panels: [] };
    update([...dashboards, d]);
    switchTo(d.id);
  };

  const renameDashboard = () => {
    if (!active) return;
    const name = window.prompt("Rename dashboard:", active.name);
    if (!name?.trim()) return;
    update(dashboards.map((d) => d.id === active.id ? { ...d, name: name.trim() } : d));
  };

  const deleteDashboard = () => {
    if (!active || dashboards.length <= 1) return;
    if (!window.confirm(`Delete dashboard "${active.name}"?`)) return;
    const next = dashboards.filter((d) => d.id !== active.id);
    update(next);
    switchTo(next[0].id);
  };

  const savePanel = (p: Panel) => {
    if (!active) return;
    update(dashboards.map((d) => {
      if (d.id !== active.id) return d;
      const panels = editIndex === null
        ? [...d.panels, p]
        : d.panels.map((old, i) => (i === editIndex ? p : old));
      return { ...d, panels };
    }));
    setEditIndex(null);
  };

  const removePanel = (idx: number) => {
    if (!active) return;
    update(dashboards.map((d) =>
      d.id === active.id ? { ...d, panels: d.panels.filter((_, i) => i !== idx) } : d
    ));
  };

  const openAdd = () => { setEditIndex(null); setEditorOpen(true); };
  const openEdit = (idx: number) => { setEditIndex(idx); setEditorOpen(true); };
  const closeEditor = () => { setEditorOpen(false); setEditIndex(null); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Select label="Dashboard" value={active?.id ?? ""} onChange={switchTo}
          options={dashboards.map((d) => ({ value: d.id, label: d.name }))} />
        <button onClick={createDashboard} className="rounded border border-border bg-card px-2.5 py-1.5 text-xs text-foreground hover:bg-white/5">+ New</button>
        <button onClick={renameDashboard} className="rounded border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-white/5">Rename</button>
        {dashboards.length > 1 && (
          <button onClick={deleteDashboard} className="rounded border border-border bg-card px-2.5 py-1.5 text-xs text-red-400 hover:bg-white/5">Delete</button>
        )}
        <span className="mx-1 h-5 w-px bg-border" />
        <Select label="Account" value={accountUid} onChange={setAccountUid}
          options={accounts.map((a) => ({ value: a.uid, label: a.name }))} />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Region
          <select value={regionOverride} onChange={(e) => setRegionOverride(e.target.value)}
            className="rounded border border-border bg-card px-2 py-1.5 text-sm text-foreground">
            <option value="">Default ({defaultRegion})</option>
            {regions.filter((r) => r !== defaultRegion).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <InstancePicker instances={instances} selected={selectedIds} onChange={setSelectedIds} />
        <button onClick={openAdd}
          className="ml-auto rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-white/5">
          + Add panel
        </button>
      </div>

      {editorOpen && accountUid && active && (
        <AddPanel dsUid={accountUid} region={region}
          initial={editIndex !== null ? active.panels[editIndex] : null}
          onAdd={savePanel} onClose={closeEditor} />
      )}

      {accountUid && active ? (
        active.panels.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
            {active.panels.map((panel, idx) => (
              <div key={`${active.id}-${idx}-${panel.title}`} className="relative">
                <div className="absolute right-3 top-3 z-10 flex gap-3">
                  <button onClick={() => openEdit(idx)}
                    className="text-[11px] text-muted-foreground hover:text-[#4f8ff7]">edit</button>
                  <button onClick={() => removePanel(idx)}
                    className="text-[11px] text-muted-foreground hover:text-red-400">remove</button>
                </div>
                <PanelCard panel={panel} dsUid={accountUid} instanceIds={selectedIds} region={region} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Empty dashboard - click "+ Add panel" to build it.</p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          {accounts.length === 0 ? "No accounts connected - add one in Settings." : "Loading..."}
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
        {options.length === 0 && <option value="">-</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function InstancePicker({ instances, selected, onChange }: {
  instances: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="relative text-xs text-muted-foreground">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1.5 text-sm text-foreground">
        Instances
        <span className="rounded bg-background px-1.5 py-0.5 text-[11px]">{selected.length}/{instances.length}</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-64 overflow-auto rounded border border-border bg-card p-2 shadow-lg">
          <div className="mb-1 flex gap-2">
            <button onClick={() => onChange([...instances])} className="text-[11px] hover:underline">All</button>
            <button onClick={() => onChange([])} className="text-[11px] hover:underline">None</button>
          </div>
          {instances.map((id) => (
            <label key={id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-white/5">
              <input type="checkbox" checked={selected.includes(id)} onChange={() => toggle(id)} />
              <span className="text-foreground">{id}</span>
            </label>
          ))}
          {instances.length === 0 && <p className="px-1 py-1">No instances found.</p>}
        </div>
      )}
    </div>
  );
}
