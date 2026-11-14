// ProofPact scripts/demo-e2e.mjs — D1 over HTTP: fund -> artifact -> verify ->
// settle, then prove exactly-once (second settle rejected). Spawns its own
// server on a scratch port with a scratch DATA_PATH. Exit 0 = pass.
// NOTE: needs loopback TCP; run outside network-restricted sandboxes.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 8893;
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DATA_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pp-e2e-")), "store.json");

const child = spawn("node", ["app/server.mjs"], {
  cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_PATH }, stdio: ["ignore", "pipe", "pipe"],
});
let childOut = "";
child.stdout.on("data", (d) => { childOut += d; });
child.stderr.on("data", (d) => { childOut += d; });
const kill = () => { try { child.kill(); } catch {} };
process.on("exit", kill);

function fail(msg) {
  console.error(`E2E FAIL: ${msg}`);
  if (childOut.trim()) console.error(`--- server output ---\n${childOut.trim().slice(-1500)}`);
  kill();
  process.exit(1);
}
const assert = (c, m) => { if (!c) fail(m); };

async function api(method, p, body) {
  const res = await fetch(`http://127.0.0.1:${PORT}${p}`, {
    method, headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

for (let i = 0; i < 50; i++) {
  try { await api("GET", "/api/demo/seed"); break; }
  catch { await new Promise((r) => setTimeout(r, 100)); if (i === 49) fail("server never came up"); }
}

const ART = { format: "csv-xform/1", ops: ["select_columns", "emit_invoice"] };
const created = await api("POST", "/api/jobs", { title: "e2e invoice", payout_near: "0.5", deadline_ms: Date.now() + 60000 });
assert(created.status === 200, `create -> ${created.status}`);
const id = created.json.job_id;
const art = await api("POST", `/api/jobs/${id}/artifact`, { artifact: ART });
assert(art.status === 200 && art.json.rev === 1, "artifact rev 1");
const ver = await api("POST", `/api/jobs/${id}/verify`);
assert(ver.status === 200 && ver.json.pass === true, "verify passes");
const set1 = await api("POST", `/api/jobs/${id}/settle`);
assert(set1.status === 200 && set1.json.state === "Paid", "first settle pays");
const set2 = await api("POST", `/api/jobs/${id}/settle`);
assert(set2.status === 409, `second settle must be rejected, got ${set2.status}`);
const view = await api("GET", `/api/jobs/${id}`);
assert(view.json.state === "Paid" && view.json.settlement.tx_ref === set1.json.tx_ref, "one settlement stands");
const rcpt = await api("GET", `/api/receipts/${ver.json.receipt_ref}`);
assert(rcpt.status === 200 && rcpt.json.exit === "pass", "receipt retrievable");
console.log(`E2E OK: job ${id} PAID exactly once (${set1.json.tx_ref}); double-settle rejected (${set2.json.error})`);
kill();
process.exit(0);
