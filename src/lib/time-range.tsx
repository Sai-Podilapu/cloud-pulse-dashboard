import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export const TIME_RANGES = [
  { value: "1h", label: "Last 1 hour" },
  { value: "6h", label: "Last 6 hours" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
] as const;

export type TimeRangeValue = (typeof TIME_RANGES)[number]["value"];

const RANGE_PARAMS: Record<TimeRangeValue, string> = {
  "1h": "&from=now-1h&to=now",
  "6h": "&from=now-6h&to=now",
  "24h": "&from=now-24h&to=now",
  "7d": "&from=now-7d&to=now",
};

export function buildPanelSrc(baseUrl: string, range: TimeRangeValue) {
  return `${baseUrl}${RANGE_PARAMS[range]}&theme=dark&kiosk&refresh=60s`;
}

type Ctx = {
  range: TimeRangeValue;
  setRange: (r: TimeRangeValue) => void;
};

const TimeRangeContext = createContext<Ctx | null>(null);

export function TimeRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<TimeRangeValue>("6h");
  const value = useMemo(() => ({ range, setRange }), [range]);
  return <TimeRangeContext.Provider value={value}>{children}</TimeRangeContext.Provider>;
}

export function useTimeRange() {
  const ctx = useContext(TimeRangeContext);
  if (!ctx) throw new Error("useTimeRange must be used within TimeRangeProvider");
  return ctx;
}
