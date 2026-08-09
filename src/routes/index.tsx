import { createFileRoute } from "@tanstack/react-router";

import { PanelCard } from "@/components/panel-card";
import { panels } from "@/config/panels";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — CloudPulse Monitoring" },
      {
        name: "description",
        content:
          "Live CloudPulse overview: CPU, memory, network and request metrics across a selectable time range.",
      },
      { property: "og:title", content: "Overview — CloudPulse Monitoring" },
      {
        property: "og:description",
        content:
          "Live CloudPulse overview: CPU, memory, network and request metrics across a selectable time range.",
      },
    ],
  }),
  component: Overview,
});

function Overview() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
      {panels.map((panel) => (
        <PanelCard key={panel.title} panel={panel} />
      ))}
    </div>
  );
}
