import type { Panel } from "@/config/panels";
import { panels as defaultPanels } from "@/config/panels";

export type Dashboard = { id: string; name: string; panels: Panel[] };

const KEY = "cloudpulse.dashboards";
const ACTIVE_KEY = "cloudpulse.activeDashboard";

export function loadDashboards(): Dashboard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (Array.isArray(raw) && raw.length) return raw;
  } catch { /* fall through to seed */ }
  // First run: seed with the built-in panels + any panels from the old system
  let legacy: Panel[] = [];
  try { legacy = JSON.parse(localStorage.getItem("cloudpulse.customPanels") ?? "[]"); } catch { /* ignore */ }
  const seed: Dashboard[] = [{ id: "default", name: "Overview", panels: [...defaultPanels, ...legacy] }];
  localStorage.setItem(KEY, JSON.stringify(seed));
  return seed;
}

export function saveDashboards(d: Dashboard[]) {
  localStorage.setItem(KEY, JSON.stringify(d));
}

export function loadActiveId(): string {
  if (typeof window === "undefined") return "default";
  return localStorage.getItem(ACTIVE_KEY) ?? "default";
}

export function saveActiveId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function newId(): string {
  return `d-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
}
