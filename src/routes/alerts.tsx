import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts — CloudPulse" },
      { name: "description", content: "Active and resolved monitoring alerts across your cloud estate." },
      { property: "og:title", content: "Alerts — CloudPulse" },
      { property: "og:description", content: "Active and resolved monitoring alerts across your cloud estate." },
    ],
  }),
  component: () => (
    <div className="rounded-lg border border-border bg-card p-8">
      <h2 className="text-sm font-medium text-foreground">Alerts</h2>
      <p className="mt-2 text-sm text-muted-foreground">No alert rules configured yet.</p>
    </div>
  ),
});
