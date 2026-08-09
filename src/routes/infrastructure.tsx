import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/infrastructure")({
  head: () => ({
    meta: [
      { title: "Infrastructure — CloudPulse" },
      { name: "description", content: "Inventory of hosts, clusters and services monitored by CloudPulse." },
      { property: "og:title", content: "Infrastructure — CloudPulse" },
      { property: "og:description", content: "Inventory of hosts, clusters and services monitored by CloudPulse." },
    ],
  }),
  component: () => (
    <div className="rounded-lg border border-border bg-card p-8">
      <h2 className="text-sm font-medium text-foreground">Infrastructure</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Host and cluster inventory will appear here.
      </p>
    </div>
  ),
});
