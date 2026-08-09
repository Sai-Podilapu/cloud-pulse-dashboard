export type Account = {
  id: number; uid: string; name: string; type: string;
  jsonData?: { defaultRegion?: string };
};

// Grafana resource APIs return varying shapes across versions:
// strings, {text, value}, {value: {name, namespace}}, {name, namespace}...
// Normalize anything into a plain string.
function toStr(x: unknown): string {
  if (typeof x === "string") return x;
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    if (typeof o.value === "string") return o.value;
    if (o.value && typeof o.value === "object") {
      const v = o.value as Record<string, unknown>;
      if (typeof v.name === "string") return v.name;
    }
    if (typeof o.text === "string") return o.text;
    if (typeof o.name === "string") return o.name;
  }
  return "";
}

function toStrList(json: unknown): string[] {
  const arr = Array.isArray(json) ? json : [];
  return [...new Set(arr.map(toStr).filter(Boolean))];
}

export async function listAccounts(): Promise<Account[]> {
  const r = await fetch("/grafana/api/datasources");
  if (!r.ok) throw new Error("Failed to load accounts");
  const all = await r.json();
  return (Array.isArray(all) ? all : []).filter((d: Account) => d.type === "cloudwatch");
}

export async function addAccount(name: string, accessKey: string, secretKey: string, region: string) {
  const r = await fetch("/grafana/api/datasources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name, type: "cloudwatch", access: "proxy",
      jsonData: { authType: "keys", defaultRegion: region },
      secureJsonData: { accessKey, secretKey },
    }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error((e as { message?: string }).message || "Failed to add account");
  }
  return r.json();
}

export async function removeAccount(uid: string) {
  const r = await fetch(`/grafana/api/datasources/uid/${uid}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed to remove account");
}

export async function listInstances(dsUid: string, region: string): Promise<string[]> {
  try {
    const r = await fetch(
      `/grafana/api/datasources/uid/${dsUid}/resources/dimension-values?region=${region}&namespace=AWS/EC2&dimensionKey=InstanceId&metricName=CPUUtilization`
    );
    if (!r.ok) return [];
    return toStrList(await r.json());
  } catch { return []; }
}

export async function listNamespaces(dsUid: string, region: string): Promise<string[]> {
  try {
    const r = await fetch(`/grafana/api/datasources/uid/${dsUid}/resources/namespaces?region=${region}`);
    if (!r.ok) throw new Error();
    const list = toStrList(await r.json());
    if (list.length) return list;
    throw new Error();
  } catch {
    return ["AWS/EC2","AWS/EBS","AWS/S3","AWS/Lambda","AWS/RDS","AWS/ELB","AWS/ApplicationELB","AWS/Billing"];
  }
}

export async function listMetrics(dsUid: string, region: string, namespace: string): Promise<string[]> {
  try {
    const r = await fetch(
      `/grafana/api/datasources/uid/${dsUid}/resources/metrics?region=${region}&namespace=${encodeURIComponent(namespace)}`
    );
    if (!r.ok) return [];
    return toStrList(await r.json());
  } catch { return []; }
}
