import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";

import nodemailer from "nodemailer";

const mailer = (process.env.GMAIL_USER && process.env.GMAIL_PASS)

  ? nodemailer.createTransport({

      service: "gmail",

      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },

    })

  : null;

const FILE = "/etc/cloudpulse/alerts.json";
const GRAFANA = "http://127.0.0.1:3000";
const TOKEN = process.env.GRAFANA_TOKEN || "";

let rules = load();

const DASH_FILE = "/etc/cloudpulse/dashboards.json";
let dashboards = (() => { try { return JSON.parse(readFileSync(DASH_FILE, "utf8")); } catch { return []; } })();
function saveDash() { writeFileSync(DASH_FILE, JSON.stringify(dashboards, null, 2)); }
const state = new Map(); // id -> { status, lastValue, lastEval, since }

function load() { try { return JSON.parse(readFileSync(FILE, "utf8")); } catch { return []; } }
function save() { writeFileSync(FILE, JSON.stringify(rules, null, 2)); }

async function evaluateRule(r) {
  const body = {
    from: "now-15m", to: "now",
    queries: [{
      refId: "A", datasource: { type: "cloudwatch", uid: r.dsUid },
      queryMode: "Metrics", metricQueryType: 0, metricEditorMode: 0,
      namespace: r.namespace, metricName: r.metricName,
      dimensions: r.dimensions || {}, statistic: r.statistic,
      period: "300", region: r.region, matchExact: true,
    }],
  };
  const res = await fetch(`${GRAFANA}/api/ds/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  const frames = json?.results?.A?.frames ?? [];
  let latest = null;
  for (const f of frames) {
    const vals = f?.data?.values?.[1] ?? [];
    for (let i = vals.length - 1; i >= 0; i--) if (vals[i] != null) { latest = vals[i]; break; }
    if (latest != null) break;
  }
  return latest;
}

async function notify(r, text) {
  if (!r.webhook) return;
  try {
    await fetch(r.webhook, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {}
}

async function evaluateAll() {
  for (const r of rules) {
    if (r.enabled === false) continue;
    try {
      const latest = await evaluateRule(r);
      const prev = state.get(r.id)?.status;
      let status = "no-data";
      if (latest != null) {
        const breach = r.op === "<" ? latest < r.threshold : latest > r.threshold;
        status = breach ? "firing" : "ok";
      }
      const old = state.get(r.id) || {};
      state.set(r.id, {
        status, lastValue: latest, lastEval: Date.now(),
        since: status !== prev ? Date.now() : (old.since || Date.now()),
      });
      if (status === "firing" && prev !== "firing")
        notify(r, `🔴 CloudPulse ALERT: ${r.name} — ${r.metricName} is ${latest?.toFixed?.(2)} (${r.op} ${r.threshold})`);
      if (status === "ok" && prev === "firing")
        notify(r, `🟢 CloudPulse resolved: ${r.name} — back to normal (${latest?.toFixed?.(2)})`);
    } catch {}
  }
}
setInterval(evaluateAll, 60_000);
evaluateAll();

const server = createServer((req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  const url = new URL(req.url, "http://x");

  if (req.method === "GET" && url.pathname === "/dashboards") {
    return send(200, dashboards);
  }
  if (req.method === "GET" && url.pathname === "/rules") {
    return send(200, rules.map((r) => ({ ...r, state: state.get(r.id) || { status: "pending" } })));
  }

  let body = "";
  req.on("data", (c) => { body += c; if (body.length > 8192) req.destroy(); });
  req.on("end", () => {
    let data = {};
    try { data = body ? JSON.parse(body) : {}; } catch { return send(400, { error: "Bad JSON" }); }

    if (req.method === "POST" && url.pathname === "/dashboards") {
      if (!Array.isArray(data)) return send(400, { error: "Expected an array" });
      if (JSON.stringify(data).length > 512 * 1024) return send(400, { error: "Too large" });
      dashboards = data; saveDash();
      return send(200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/rules") {
      const { name, dsUid, region, namespace, metricName, statistic, op, threshold, dimensions, webhook, email } = data;
      if (!name || !dsUid || !region || !namespace || !metricName || !statistic || !["<", ">"].includes(op) || typeof threshold !== "number")
        return send(400, { error: "Missing or invalid fields" });
      const rule = {
        id: `a-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
        name, dsUid, region, namespace, metricName, statistic, op, threshold,
        dimensions: dimensions || {}, webhook: webhook || "", email: email || "", enabled: true,
      };
      rules.push(rule); save();
      evaluateAll();
      return send(200, rule);
    }
    if (req.method === "POST" && url.pathname === "/rules/update") {
      const r = rules.find((x) => x.id === data.id);
      if (!r) return send(404, { error: "Not found" });
      const { name, dsUid, region, namespace, metricName, statistic, op, threshold, dimensions, webhook, email } = data;
      if (!name || !dsUid || !region || !namespace || !metricName || !statistic || !["<", ">"].includes(op) || typeof threshold !== "number")
        return send(400, { error: "Missing or invalid fields" });
      Object.assign(r, {
        name, dsUid, region, namespace, metricName, statistic, op, threshold,
        dimensions: dimensions || {}, webhook: webhook || "", email: email || "",
      });
      save();
      state.delete(r.id);   // force fresh evaluation under the new definition
      evaluateAll();
      return send(200, r);
    }
    if (req.method === "POST" && url.pathname === "/rules/toggle") {
      const r = rules.find((x) => x.id === data.id);
      if (!r) return send(404, { error: "Not found" });
      r.enabled = r.enabled === false; save();
      return send(200, r);
    }
    if (req.method === "POST" && url.pathname === "/rules/delete") {
      rules = rules.filter((x) => x.id !== data.id); save(); state.delete(data.id);
      return send(200, { ok: true });
    }
    send(404, { error: "Not found" });
  });
});
server.listen(8083, "127.0.0.1", () => console.log("alerts service on 8083"));
