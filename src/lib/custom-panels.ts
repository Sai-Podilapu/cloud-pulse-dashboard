import type { Panel } from "@/config/panels";

const KEY = "cloudpulse.customPanels";

export function loadCustomPanels(): Panel[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}

export function saveCustomPanels(panels: Panel[]) {
  localStorage.setItem(KEY, JSON.stringify(panels));
}
