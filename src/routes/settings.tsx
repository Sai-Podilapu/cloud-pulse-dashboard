import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { listAccounts, addAccount, removeAccount, ALL_REGIONS, type Account } from "@/lib/grafana-api";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — CloudPulse" }] }),
  component: Settings,
});

const REGIONS = ALL_REGIONS;

function Settings() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () => listAccounts().then(setAccounts).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      await addAccount(name.trim(), accessKey.trim(), secretKey.trim(), region);
      setMsg("Account added");
      setName(""); setAccessKey(""); setSecretKey("");
      refresh();
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  };

  return (
    <div className="max-w-xl space-y-6">
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-medium text-foreground">Connect an AWS account</h2>
        <div className="space-y-3">
          <Field label="Account name" value={name} onChange={setName} placeholder="e.g. Production" />
          <Field label="Access Key ID" value={accessKey} onChange={setAccessKey} placeholder="AKIA..." />
          <Field label="Secret Access Key" value={secretKey} onChange={setSecretKey} placeholder="secret" password />
          <label className="block text-xs text-muted-foreground">Region
            <select value={region} onChange={(e) => setRegion(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground">
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
        </div>
        <button onClick={submit} disabled={busy || !name || !accessKey || !secretKey}
          className="rounded bg-[#4f8ff7] px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
          {busy ? "Adding..." : "Add account"}
        </button>
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Use an IAM user with only the CloudWatchReadOnlyAccess policy. Keys are stored in the backend and never sent to the browser.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-medium text-foreground">Connected accounts</h2>
        {accounts.length === 0 && <p className="text-xs text-muted-foreground">None yet.</p>}
        {accounts.map((a) => (
          <div key={a.uid} className="flex items-center justify-between rounded border border-border px-3 py-2">
            <div>
              <p className="text-sm text-foreground">{a.name}</p>
              <p className="text-[11px] text-muted-foreground">{a.jsonData?.defaultRegion}</p>
            </div>
            <button onClick={() => removeAccount(a.uid).then(refresh)}
              className="text-xs text-red-400 hover:underline">Remove</button>
          </div>
        ))}
      </section>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, password }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; password?: boolean;
}) {
  return (
    <label className="block text-xs text-muted-foreground">{label}
      <input type={password ? "password" : "text"} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground" />
    </label>
  );
}
