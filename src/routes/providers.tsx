import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRequireAuth, clearCreds } from "@/lib/auth";

export const Route = createFileRoute("/providers")({
  head: () => ({ meta: [{ title: "Cloud Providers - CloudPulse" }] }),
  component: Providers,
});

const PROVIDERS = [
  {
    id: "aws", name: "Amazon Web Services", short: "AWS",
    desc: "EC2, EBS, Lambda, RDS and every CloudWatch namespace.",
    color: "#ff9900", live: true,
  },
  {
    id: "azure", name: "Microsoft Azure", short: "Az",
    desc: "Azure Monitor metrics across your subscriptions.",
    color: "#0089d6", live: false,
  },
  {
    id: "gcp", name: "Google Cloud", short: "G",
    desc: "Cloud Monitoring for GCE, GKE, Cloud Run and more.",
    color: "#34a853", live: false,
  },
  {
    id: "oracle", name: "Oracle Cloud", short: "O",
    desc: "OCI Monitoring for compute, storage and databases.",
    color: "#f80000", live: false,
  },
  {
    id: "huawei", name: "Huawei Cloud", short: "H",
    desc: "Cloud Eye metrics for ECS, OBS and RDS.",
    color: "#cf0a2c", live: false,
  },
];

function Providers() {
  useRequireAuth();
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-40 overflow-auto bg-[#181b1f]">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">CloudPulse</h1>
          <button onClick={() => { clearCreds(); location.href = "/login"; }}
            className="text-xs text-muted-foreground hover:text-red-400">Sign out</button>
        </div>
        <p className="mb-8 text-sm text-muted-foreground">Choose a cloud provider to monitor.</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROVIDERS.map((p) => (
            <button key={p.id}
              onClick={() => p.live && navigate({ to: "/" })}
              disabled={!p.live}
              className={`group relative flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-5 text-left transition-colors ${
                p.live ? "cursor-pointer hover:border-[#4f8ff7]/60 hover:bg-white/[0.03]" : "cursor-not-allowed opacity-55"
              }`}>
              <div className="flex w-full items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold text-white"
                  style={{ background: p.color }}>
                  {p.short}
                </span>
                {p.live ? (
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-400">Connected</span>
                ) : (
                  <span className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-muted-foreground">Coming soon</span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{p.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.desc}</p>
              </div>
              {p.live && (
                <span className="mt-auto text-xs text-[#4f8ff7] opacity-0 transition-opacity group-hover:opacity-100">
                  Open dashboards →
                </span>
              )}
            </button>
          ))}
        </div>

        <p className="mt-8 text-[11px] text-muted-foreground">
          More providers are on the roadmap. AWS is fully supported today.
        </p>
      </div>
    </div>
  );
}
