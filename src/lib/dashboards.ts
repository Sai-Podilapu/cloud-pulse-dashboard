import type { Panel } from "@/config/panels";
import { panels as defaultPanels } from "@/config/panels";
import { authFetch } from "@/lib/auth";

export type Dashboard = { id: string; name: string; panels: Panel[] };

const LOCAL_KEY = "cloudpulse.dashboards";
const ACTIVE_KEY = "cloudpulse.activeDashboard";

export async function loadDashboards(): Promise<Dashboard[]> {
  // 1. Server is the source of truth
  try {
    const r = await authFetch("/dashboards-api/dashboards");
    if (r.ok) {
      const list = await r.json();
      if (Array.isArray(list) && list.length) return list;
    }
  } catch { /* fall through */ }

  // 2. Server empty: migrate this browser's old localStorage dashboards, or seed defaults
  let local: Dashboard[] = [];
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "null");
    if (Array.isArray(raw) && raw.length) local = raw;
  } catch { /* ignore */ }

  const seed: Dashboard[] = local.length
    ? local
    : [{ id: "default", name: "Overview", panels: [...defaultPanels] }];

  saveDashboards(seed); // push to server
  return seed;
}

export function saveDashboards(d: Dashboard[]) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(d)); } catch { /* offline backup only */ }
  authFetch("/dashboards-api/dashboards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d),
  }).catch(() => {});
}

export function loadActiveId(): string {
  if (typeof window === "undefined") return "default";
  return localStorage.getItem(ACTIVE_KEY) ?? "default";
}
export function saveActiveId(id: string) { localStorage.setItem(ACTIVE_KEY, id); }
export function newId(): string { return `d-${Date.now()}-${Math.floor(Math.random() * 1e4)}`; }
