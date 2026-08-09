export type Panel = {
  title: string;
  baseUrl: string;
};

export const panels: Panel[] = [
  {
    title: "CPU Utilization",
    baseUrl: "http://localhost:3000/d-solo/REPLACE_ME?orgId=1&panelId=1",
  },
  {
    title: "Network In/Out",
    baseUrl: "http://localhost:3000/d-solo/REPLACE_ME?orgId=1&panelId=1",
  },
  {
    title: "Memory Usage",
    baseUrl: "http://localhost:3000/d-solo/REPLACE_ME?orgId=1&panelId=1",
  },
  {
    title: "Request Count",
    baseUrl: "http://localhost:3000/d-solo/REPLACE_ME?orgId=1&panelId=1",
  },
];
