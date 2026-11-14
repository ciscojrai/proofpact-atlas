/**
 * ProofPact Static UI Console — Automated Verification Suite
 * Stream S5 (stream/ui)
 *
 * Verifies:
 * 1. Brand Quarantine: 100% absence of legacy hackathon name across all UI files.
 * 2. Static Assets: Semantic HTML5, CSS design tokens, zero external dependencies.
 * 3. Standalone Seed Fallback: Offline rendering matching app/seed.mjs.
 * 4. Live Server Compatibility: Connects to app/server.mjs GET /api/demo/seed.
 * 5. Headless Chrome DOM Verification: Real browser rendering via Google Chrome.
 * 6. INTERFACES §9 Acceptance States: 5 distinct visual presentation states.
 * 7. Cryptographic In-Browser SHA-256 Receipt Verification.
 * 8. Accessibility: Keyboard focus, ARIA semantics, prefers-reduced-motion.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// Helper to run headless chrome and dump DOM
function dumpChromeDom(url) {
  assert.ok(fs.existsSync(CHROME_PATH), `Google Chrome binary must exist at ${CHROME_PATH}`);
  const cmd = `"${CHROME_PATH}" --headless=new --disable-gpu --dump-dom "${url}" 2>/dev/null`;
  return execSync(cmd, { encoding: "utf8", timeout: 30000 });
}

// ----------------------------------------------------------------------------
// 1. Brand Quarantine Audit
// ----------------------------------------------------------------------------
test("Brand Quarantine: zero occurrences of legacy name across all ui files", () => {
  const uiFiles = fs.readdirSync(__dirname).filter((f) => !f.startsWith("."));
  assert.ok(uiFiles.length >= 3, "Expected at least index.html, styles.css, app.js in ui/");

  const forbiddenStr = ["Proof", "gate"].join("");
  const forbiddenPattern = new RegExp(forbiddenStr, "i");
  for (const file of uiFiles) {
    const filePath = path.join(__dirname, file);
    const content = fs.readFileSync(filePath, "utf8");
    const match = content.match(forbiddenPattern);
    assert.equal(
      match,
      null,
      `BRAND QUARANTINE VIOLATION: Found '${match && match[0]}' in ui/${file}`
    );
  }
});

// ----------------------------------------------------------------------------
// 2. Static File Structure & Design Tokens
// ----------------------------------------------------------------------------
test("Static Assets: index.html, styles.css, app.js exist and adhere to specs", () => {
  const htmlPath = path.join(__dirname, "index.html");
  const cssPath = path.join(__dirname, "styles.css");
  const jsPath = path.join(__dirname, "app.js");

  assert.ok(fs.existsSync(htmlPath), "ui/index.html must exist");
  assert.ok(fs.existsSync(cssPath), "ui/styles.css must exist");
  assert.ok(fs.existsSync(jsPath), "ui/app.js must exist");

  const html = fs.readFileSync(htmlPath, "utf8");
  const css = fs.readFileSync(cssPath, "utf8");
  const js = fs.readFileSync(jsPath, "utf8");

  // Zero external dependencies
  assert.ok(!html.includes("cdn.tailwindcss.com"), "No Tailwind CDN in index.html");
  assert.ok(!html.includes("react"), "No React in index.html");
  assert.ok(!html.includes("vue"), "No Vue in index.html");
  assert.ok(!html.includes("near-api-js"), "No near-api-js in browser index.html");

  // Semantic elements
  assert.ok(html.includes("<header"), "Header element present");
  assert.ok(html.includes("<main"), "Main element present");
  assert.ok(html.includes("<footer"), "Footer element present");
  assert.ok(html.includes("aria-live="), "ARIA live regions present");

  // CSS Design tokens
  assert.ok(css.includes("--bg:"), "CSS variable --bg defined");
  assert.ok(css.includes("--fg:"), "CSS variable --fg defined");
  assert.ok(css.includes("--card:"), "CSS variable --card defined");
  assert.ok(css.includes("--acc:"), "CSS variable --acc defined");
  assert.ok(css.includes("--ok:"), "CSS variable --ok defined");
  assert.ok(css.includes("--bad:"), "CSS variable --bad defined");
  assert.ok(css.includes("--warn:"), "CSS variable --warn defined");
  assert.ok(css.includes("backdrop-filter: blur"), "Glassmorphism backdrop-filter present");
  assert.ok(css.includes("prefers-reduced-motion"), "prefers-reduced-motion query present");
  assert.ok(css.includes(":focus-visible"), "focus-visible styling present");
});

// ----------------------------------------------------------------------------
// 3. Standalone Seed Fallback & Canonical Digest Recomputation
// ----------------------------------------------------------------------------
test("Standalone Fallback: app.js exports match canonical receipts golden vector", async () => {
  const jsContent = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
  assert.ok(jsContent.includes("FALLBACK_SEED"), "Embedded fallback seed present");
  assert.ok(jsContent.includes("pp_89abcdef"), "Job ID pp_89abcdef in seed");
  assert.ok(jsContent.includes("FIXTURE_AGENTS"), "FIXTURE_AGENTS mode in seed");
  assert.ok(jsContent.includes("LOCAL_SIMULATION"), "LOCAL_SIMULATION mode in seed");
  assert.ok(jsContent.includes("TRUSTED_RUNNER"), "TRUSTED_RUNNER trust label in seed");

  const { default: vm } = await import("node:vm");
  const { webcrypto } = await import("node:crypto");
  const sandbox = {
    globalThis: {},
    console,
    crypto: webcrypto,
    TextEncoder,
    setTimeout,
    clearTimeout
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(jsContent, sandbox);

  const appExports = sandbox.globalThis;
  assert.ok(appExports.FALLBACK_SEED, "FALLBACK_SEED exported");
  assert.equal(appExports.FALLBACK_SEED.job_id, "pp_89abcdef");

  const goldenReceipt = appExports.FALLBACK_SEED.receipts[0];
  const { verified, computed, expected } = await appExports.verifyReceiptDigest(goldenReceipt);

  assert.equal(verified, true, `Receipt verification failed: computed ${computed} != expected ${expected}`);
  assert.equal(
    computed,
    "f949fea06e317440d5a3ea5de4f9218061165df595c469ff70889c0f1a7423fd",
    "Computed SHA-256 must match golden vector digest byte-for-byte"
  );
});

// ----------------------------------------------------------------------------
// 4. Live Server Integration (app/server.mjs)
// ----------------------------------------------------------------------------
test("Live Server: GET /api/demo/seed returns expected frozen §7 shape", async () => {
  const PORT = 8899;
  const serverProcess = spawn("node", ["app/server.mjs"], {
    cwd: REPO_ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: "pipe"
  });

  try {
    // Wait for server to listen
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Server start timeout")), 5000);
      serverProcess.stdout.on("data", (data) => {
        if (data.toString().includes("proofpact app on http://")) {
          clearTimeout(timer);
          resolve();
        }
      });
      serverProcess.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    // Fetch GET /api/demo/seed
    const res = await fetch(`http://127.0.0.1:${PORT}/api/demo/seed`);
    assert.equal(res.status, 200, "Seed endpoint returned HTTP 200");
    const data = await res.json();

    assert.equal(data.job_id, "pp_89abcdef");
    assert.equal(data.model_mode, "FIXTURE_AGENTS");
    assert.equal(data.chain_mode, "LOCAL_SIMULATION");
    assert.equal(data.verification, "TRUSTED_RUNNER");
    assert.equal(data.criteria.length, 6);
    assert.equal(data.receipts[0].receipt_digest, "f949fea06e317440d5a3ea5de4f9218061165df595c469ff70889c0f1a7423fd");
  } finally {
    serverProcess.kill("SIGTERM");
  }
});

// ----------------------------------------------------------------------------
// 5. Headless Chrome DOM Verification (Standalone file://)
// ----------------------------------------------------------------------------
test("Headless Chrome: full DOM renders cleanly from standalone file://", () => {
  const indexUrl = `file://${path.resolve(__dirname, "index.html")}`;
  const dom = dumpChromeDom(indexUrl);

  // Assert Title & Headers
  assert.ok(dom.includes("<title>ProofPact · Verified Escrow Console</title>"), "Title rendered");
  assert.ok(dom.includes("Verified CSV Transformation Escrow"), "Hero H1 rendered");

  // Assert Mode Chips
  assert.ok(dom.includes("CHAIN · LOCAL_SIMULATION"), "Chain mode chip rendered");
  assert.ok(dom.includes("AGENTS · FIXTURE_AGENTS"), "Model mode chip rendered");
  assert.ok(dom.includes("VERIFIER · TRUSTED_RUNNER"), "Verifier trust chip rendered");

  // Assert Standalone Mode Detection
  assert.ok(dom.includes("Standalone Seed Mode"), "Standalone seed mode status rendered");

  // Assert Criteria Matrix CSV-01..CSV-06
  assert.ok(dom.includes("CSV-01"), "Criterion CSV-01 rendered");
  assert.ok(dom.includes("CSV-02"), "Criterion CSV-02 rendered");
  assert.ok(dom.includes("CSV-03"), "Criterion CSV-03 rendered");
  assert.ok(dom.includes("CSV-04"), "Criterion CSV-04 rendered");
  assert.ok(dom.includes("CSV-05"), "Criterion CSV-05 rendered");
  assert.ok(dom.includes("CSV-06"), "Criterion CSV-06 rendered");

  // Assert Stepper Flow
  assert.ok(dom.includes("data-s=\"Funded\""), "Funded step rendered");
  assert.ok(dom.includes("data-s=\"Active\""), "Active step rendered");
  assert.ok(dom.includes("data-s=\"Paid\""), "Paid step rendered");

  // Assert Sealed Receipt & Verification Badge
  assert.ok(dom.includes("VERIFIED DIGEST"), "Receipt verification badge rendered");
  assert.ok(
    dom.includes("f949fea06e317440d5a3ea5de4f9218061165df595c469ff70889c0f1a7423fd"),
    "Golden vector receipt digest rendered"
  );
});

// ----------------------------------------------------------------------------
// 6. INTERFACES §9 Acceptance States Visual Presentation Verification
// ----------------------------------------------------------------------------
test("Acceptance Matrix §9: distinct visual presentation of all 5 states", () => {
  const indexUrl = `file://${path.resolve(__dirname, "index.html")}`;

  // Helper to dump DOM with state applied via script
  function dumpDomForState(stateKey) {
    const tempHtml = fs.readFileSync(path.join(__dirname, "index.html"), "utf8")
      .replace(
        '<script src="app.js"></script>',
        '<script src="app.js"></script><script>applyAcceptanceState("' + stateKey + '");</script>'
      );
    const tempPath = path.join(__dirname, `_temp_test_${stateKey}.html`);
    fs.writeFileSync(tempPath, tempHtml, "utf8");
    try {
      return dumpChromeDom(`file://${tempPath}`);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }

  // 1. Failed Verification (D6)
  {
    const dom = dumpDomForState("failed-verification");
    assert.ok(dom.includes("VERIFICATION_FAILED"), "Failed verification panic code rendered");
    assert.ok(dom.includes("Escrow preserved"), "Preserved escrow banner rendered");
    assert.ok(dom.includes("crit-badge fail mono"), "Failing criterion badge rendered");
  }

  // 2. Rejected Auth (D3)
  {
    const dom = dumpDomForState("rejected-auth");
    assert.ok(dom.includes("NOT_VERIFIER"), "NOT_VERIFIER panic code rendered");
    assert.ok(dom.includes("attacker.testnet"), "Unauthorized caller ID rendered");
    assert.ok(dom.includes("verifier.testnet"), "Designated verifier ID rendered");
    assert.ok(dom.includes("State completely unchanged"), "State immutability assurance rendered");
  }

  // 3. Pending Transaction (D1 in-flight)
  {
    const dom = dumpDomForState("pending-tx");
    assert.ok(dom.includes("TRANSFER_IN_FLIGHT"), "TRANSFER_IN_FLIGHT alert rendered");
    assert.ok(dom.includes("PayoutPending"), "PayoutPending state pill rendered");
    assert.ok(dom.includes("sim:tx_in_flight..."), "In-flight tx reference rendered");
  }

  // 4. Failed Transfer (D8)
  {
    const dom = dumpDomForState("failed-transfer");
    assert.ok(dom.includes("PayoutFailed"), "PayoutFailed status rendered");
    assert.ok(dom.includes("safe retry available"), "Safe retry guidance rendered");
  }

  // 5. Confirmed Payment (D1/D10 completed)
  {
    const dom = dumpDomForState("confirmed-payment");
    assert.ok(dom.includes("sim:tx_d74be95d"), "Confirmed payment tx_ref rendered");
    assert.ok(dom.includes("data-s=\"Paid\""), "Terminal Paid step rendered");
  }
});
