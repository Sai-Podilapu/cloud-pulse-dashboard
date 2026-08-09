import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CloudPulse" },
      { name: "description", content: "Configure dashboard sources, refresh cadence and display options." },
      { property: "og:title", content: "Settings — CloudPulse" },
      { property: "og:description", content: "Configure dashboard sources, refresh cadence and display options." },
    ],
  }),
  component: () => (
    <div className="rounded-lg border border-border bg-card p-8">
      <h2 className="text-sm font-medium text-foreground">Settings</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Dashboard sources and preferences will live here.
      </p>
    </div>
  ),
});
