import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";

const FILE = "/etc/cloudpulse/htpasswd";
const INVITE = process.env.INVITE_CODE || "";

const server = createServer((req, res) => {
  if (req.method !== "POST" || !["/register", "/change-password"].includes(req.url)) {
    res.writeHead(404).end(); return;
  }
  let body = "";
  req.on("data", (c) => { body += c; if (body.length > 4096) req.destroy(); });
  req.on("end", () => {
    const send = (code, obj) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(obj));
    };
    let data;
    try { data = JSON.parse(body); } catch { return send(400, { error: "Bad request" }); }

    if (req.url === "/change-password") {
      const { username, currentPassword, newPassword } = data;
      if (!username || !currentPassword) return send(400, { error: "Missing credentials" });
      if (typeof newPassword !== "string" || newPassword.length < 8)
        return send(400, { error: "New password must be at least 8 characters" });
      // verify current password first
      execFile("htpasswd", ["-vb", FILE, username, currentPassword], (verr) => {
        if (verr) return send(403, { error: "Current password is incorrect" });
        execFile("htpasswd", ["-b", FILE, username, newPassword], (err) => {
          if (err) return send(500, { error: "Could not update password" });
          send(200, { ok: true });
        });
      });
      return;
    }

    const { username, password } = data;

    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username || ""))
      return send(400, { error: "Username: 3-32 chars, letters/numbers/._- only" });
    if (typeof password !== "string" || password.length < 8)
      return send(400, { error: "Password must be at least 8 characters" });

    try {
      const existing = readFileSync(FILE, "utf8").split("\n")
        .map((l) => l.split(":")[0]).filter(Boolean);
      if (existing.includes(username)) return send(409, { error: "Username already taken" });
    } catch { /* file missing: htpasswd will create-fail below */ }

    execFile("htpasswd", ["-b", FILE, username, password], (err) => {
      if (err) return send(500, { error: "Could not create user" });
      send(200, { ok: true });
    });
  });
});

server.listen(8082, "127.0.0.1", () => console.log("auth service on 8082"));
