// ProofPact scripts/matrix.mjs — acceptance-matrix status (INTERFACES §9).
// Runs every check that exists, reports the rest as pending (stream not
// merged yet). Exit 0 when nothing FAILS; pending is not failure.
// NOTE: HTTP checks need loopback; run outside restricted sandboxes.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const run = (cmd, args, timeout = 120000) => {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", timeout });
  return { ok: r.status === 0, out: ((r.stdout || "") + (r.stderr || "")).slice(-400) };
};

const rows = [];
const row = (id, name, status, detail = "") => rows.push({ id, name, status, detail });

// D1: full lifecycle over HTTP.
{
  const r = run("node", ["scripts/demo-e2e.mjs"]);
  row("D1", "funded lifecycle pays once", r.ok ? "pass" : "fail",
    r.ok ? r.out.trim().split("\n").pop() : r.out.trim().split("\n").pop());
}
// D2/D4-app/D5-app/D9-app/D10-app: controller suite.
{
  const r = run("node", ["--test", "app/controller.test.mjs"]);
  const m = r.out.match(/ℹ (pass|fail) (\d+)/g) || [];
  row("D2/D4/D5/D9/D10-app", "controller guards (premature, lock, double, hostile, revision)",
    r.ok ? "pass" : "fail", m.join(" "));
}
// Receipts golden.
{
  const r = run("node", ["receipts/canonical.mjs", "--selftest"]);
  row("R1", "golden receipt recomputes", r.ok ? "pass" : "fail", r.out.trim());
}
// Seed smoke.
{
  const r = run("node", ["app/smoke.mjs"]);
  row("S1", "seed API serves frozen shape", r.ok ? "pass" : "fail", r.out.trim().split("\n").pop());
}
// Stream-owned suites: pending until merged.
{ const envReady = fs.existsSync("node_modules") &&
    fs.existsSync("contract/target/wasm32-unknown-unknown/release/proofpact.wasm");
  if (!fs.existsSync("contract/tests")) row("D3/D7/D8", "contract suite (S1)", "pending", "not merged");
  else if (!envReady) row("D3/D7/D8", "contract suite (S1)", "blocked", "run: npm ci && npm run setup:sandbox && npm run build:contract");
  else { const r = run("npx", ["jest", "--runInBand"], 420000);
    const m = r.out.match(/Tests:\s+\d+ passed/);
    row("D3/D7/D8", "contract suite (S1)", r.ok ? "pass" : "fail", m ? m[0] : r.out.trim().split("\n").pop()); } }
{ const r = run("node", ["family/run.mjs", "family/artifacts/reference.json", "family/fixtures", "--out", "/tmp/matrix-fam.json"]);
  row("D10Checks", "family runner 27/27 (S3)", r.ok ? "pass" : "fail", r.out.trim().split("\n")[0] || ""); }
{ const r = run("node", ["agents/fixture.mjs"]);
  row("AgentsLoop", "fixture loop + 13 hostile (S4)", r.ok ? "pass" : "fail",
    r.ok ? "RESULT pass" : r.out.trim().split("\n").pop()); }
{ if (!fs.existsSync("ui/test-ui.mjs")) row("UISeed", "console renders on seed (S5)", "pending", "not merged");
  else { const r = run("node", ["--test", "ui/test-ui.mjs"], 180000);
    const m = r.out.match(/ℹ pass (\d+)/);
    row("UISeed", "console renders on seed (S5)", r.ok ? "pass" : "fail", m ? m[0] : r.out.trim().split("\n").pop()); } }

const w = (s, n) => String(s).padEnd(n).slice(0, n);
console.log(`\n${w("ID", 22)}${w("STATUS", 14)}DETAIL`);
for (const r of rows) console.log(`${w(r.id, 22)}${w(r.status.toUpperCase(), 14)}${r.detail}`);
console.log("");
if (rows.some((r) => r.status === "fail")) process.exit(1);
