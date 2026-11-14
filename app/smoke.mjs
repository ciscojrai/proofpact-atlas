// ProofPact app/smoke.mjs — S2 seed-slice smoke test. No harness needed:
// spawns server.mjs, asserts the seed shape, kills it. Exit 0 = pass.
// NOTE: needs loopback TCP. Inside a sandbox that blocks `listen` (EPERM),
// run this outside the sandbox instead of "fixing" the server.
import { spawn } from "node:child_process";

const PORT = 8891;
const GOLDEN = "f949fea06e317440d5a3ea5de4f9218061165df595c469ff70889c0f1a7423fd";

const child = spawn("node", ["app/server.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"],
});
let childOut = "";
child.stdout.on("data", (d) => { childOut += d; });
child.stderr.on("data", (d) => { childOut += d; });
const kill = () => { try { child.kill(); } catch {} };
process.on("exit", kill);

async function get(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`SMOKE FAIL: ${msg}`);
    if (childOut.includes("EPERM")) {
      console.error("hint: loopback `listen` is blocked here (EPERM) — rerun outside the sandbox.");
    }
    if (childOut.trim()) console.error(`--- server output ---\n${childOut.trim().slice(-1500)}`);
    kill();
    process.exit(1);
  }
}

let seed = null;
for (let i = 0; i < 50; i++) {
  try { seed = await get("/api/demo/seed"); break; }
  catch { await new Promise((r) => setTimeout(r, 100)); }
}
assert(seed, "seed endpoint never answered");
assert(/^pp_[0-9a-f]{8}$/.test(seed.job_id), "job_id shape");
assert(seed.model_mode === "FIXTURE_AGENTS", "model_mode label");
assert(seed.chain_mode === "LOCAL_SIMULATION", "chain_mode label");
assert(seed.verification === "TRUSTED_RUNNER", "trust label");
assert(Array.isArray(seed.messages) && seed.messages.length >= 3, "messages present");
assert(seed.messages.every((m) => m.proto === "proofpact/1"), "envelope protos");
assert(seed.escrow && seed.escrow.state === "Active", "escrow state");
assert(seed.receipts?.[0]?.receipt_digest === GOLDEN, "golden receipt embedded");
console.log("SMOKE OK: seed endpoint serves frozen §7 shape with golden receipt");
kill();
process.exit(0);
