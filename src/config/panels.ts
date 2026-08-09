export type MetricSeries = { label: string; metricName: string; color?: string };
export type Panel = {
  title: string;
  unit: "percent" | "bytes" | "count";
  namespace: string;
  statistic: "Average" | "Sum" | "Maximum";
  period: string;
  series: MetricSeries[];
};

export const panels: Panel[] = [
  { title: "CPU Utilization", unit: "percent", namespace: "AWS/EC2", statistic: "Average", period: "300",
    series: [{ label: "CPU %", metricName: "CPUUtilization" }] },
  { title: "Network In / Out", unit: "bytes", namespace: "AWS/EC2", statistic: "Average", period: "300",
    series: [
      { label: "In", metricName: "NetworkIn" },
      { label: "Out", metricName: "NetworkOut", color: "#e0894f" },
    ] },
  { title: "CPU Credit Balance", unit: "count", namespace: "AWS/EC2", statistic: "Average", period: "300",
    series: [{ label: "Credits", metricName: "CPUCreditBalance", color: "#9d6ff7" }] },
  { title: "Status Check Failed", unit: "count", namespace: "AWS/EC2", statistic: "Maximum", period: "300",
    series: [{ label: "Failures", metricName: "StatusCheckFailed", color: "#f76f6f" }] },
];
