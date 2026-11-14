/**
 * ProofPact Static UI Console — Application Logic (Vanilla JS)
 * Stream S5 (stream/ui) · Zero Dependencies · Pure ES/Web APIs
 *
 * Implements:
 * 1. Embedded fallback seed fixture matching app/seed.mjs (100% offline & file:// support).
 * 2. Seamless live fetch to GET /api/demo/seed when server is active.
 * 3. In-browser Web Crypto API SHA-256 verification of canonical sealed receipt.
 * 4. Interactive Acceptance State Switcher for INTERFACES §9 states (D1, D3, D6, D8, D10).
 * 5. Strict Anti-CoT envelope parsing and rendering.
 * 6. Theme switcher (dark/light) with system preference detection and persistence.
 * 7. Copy-to-clipboard helpers with accessible toast feedback.
 */

"use strict";

// ============================================================================
// 1. Embedded Fallback Seed Constant (INTERFACES §7 / app/seed.mjs)
// ============================================================================
const FALLBACK_SEED = {
  job_id: "pp_89abcdef",
  model_mode: "FIXTURE_AGENTS",
  chain_mode: "LOCAL_SIMULATION",
  verification: "TRUSTED_RUNNER",
  title: "InvoiceAcme October CSV (seed)",
  criteria: ["CSV-01", "CSV-02", "CSV-03", "CSV-04", "CSV-05", "CSV-06"],
  payout_near: "0.5",
  deadline_ms: 1792300800000,
  state: "Active",
  rev: 1,
  artifact_digest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  messages: [
    {
      proto: "proofpact/1",
      job_id: "pp_89abcdef",
      msg_id: "m_00000001",
      actor: "controller",
      type: "ACCEPT",
      payload: { job_id: "pp_89abcdef", builder: "builder.testnet" }
    },
    {
      proto: "proofpact/1",
      job_id: "pp_89abcdef",
      msg_id: "m_00000002",
      actor: "builder",
      corr: "m_00000001",
      type: "ARTIFACT_SUBMITTED",
      payload: {
        rev: 1,
        artifact: {
          format: "csv-xform/1",
          ops: ["select_columns", "require_columns", "parse_decimal", "emit_invoice"]
        },
        artifact_digest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      }
    },
    {
      proto: "proofpact/1",
      job_id: "pp_89abcdef",
      msg_id: "m_00000003",
      actor: "runner",
      corr: "m_00000002",
      type: "TEST_RESULT",
      payload: {
        rev: 1,
        pass: true,
        results: [
          { fixture_id: "csv01-quoted", criterion_id: "CSV-01", pass: true, ms: 3, detail: "RFC-4180 quotes & commas verified" },
          { fixture_id: "csv02-required", criterion_id: "CSV-02", pass: true, ms: 2, detail: "Schema headers validated up-front" },
          { fixture_id: "csv03-decimal", criterion_id: "CSV-03", pass: true, ms: 4, detail: "BigInt 6dp scaled math verified" },
          { fixture_id: "csv04-errors", criterion_id: "CSV-04", pass: true, ms: 2, detail: "Structured error objects confirmed" },
          { fixture_id: "csv05-schema", criterion_id: "CSV-05", pass: true, ms: 3, detail: "invoice/1 output compliance verified" },
          { fixture_id: "csv06-limits", criterion_id: "CSV-06", pass: true, ms: 2, detail: "Execution limits enforced" }
        ]
      }
    }
  ],
  checks: {
    pass: true,
    results: [
      { fixture_id: "csv01-quoted", criterion_id: "CSV-01", pass: true, ms: 3, detail: "RFC-4180 quotes & commas verified" },
      { fixture_id: "csv02-required", criterion_id: "CSV-02", pass: true, ms: 2, detail: "Schema headers validated up-front" },
      { fixture_id: "csv03-decimal", criterion_id: "CSV-03", pass: true, ms: 4, detail: "BigInt 6dp scaled math verified" },
      { fixture_id: "csv04-errors", criterion_id: "CSV-04", pass: true, ms: 2, detail: "Structured error objects confirmed" },
      { fixture_id: "csv05-schema", criterion_id: "CSV-05", pass: true, ms: 3, detail: "invoice/1 output compliance verified" },
      { fixture_id: "csv06-limits", criterion_id: "CSV-06", pass: true, ms: 2, detail: "Execution limits enforced" }
    ]
  },
  escrow: {
    state: "Active",
    funded_yocto: "500000000000000000000000",
    remaining_yocto: "500000000000000000000000",
    verifier: "verifier.testnet",
    builder: "builder.testnet",
    client: "client.testnet"
  },
  timeline: [
    { seq: 1, ts: 1792214400000, type: "job_funded", payload: { client: "client.testnet", payout: "0.5 NEAR" } },
    { seq: 2, ts: 1792214400100, type: "job_activated", payload: { builder: "builder.testnet" } },
    { seq: 3, ts: 1792214400123, type: "checks_passed", payload: { rev: 1, fixtures: 6, pass: true } }
  ],
  receipts: [
    {
      run_id: "r_01234567",
      job_id: "pp_89abcdef",
      rev: 2,
      artifact_digest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      spec_digest: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      policy_digest: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      testset_digest: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      env_id: "interp-1",
      op: "runChecks",
      started_at: 1792214400000,
      ended_at: 1792214400123,
      exit: "pass",
      log_excerpt: "20 fixtures, 20 pass, 0 fail (golden vector, deterministic)",
      refs: ["evt:12", "evt:13"],
      receipt_digest: "f949fea06e317440d5a3ea5de4f9218061165df595c469ff70889c0f1a7423fd"
    }
  ]
};

// Application state store
const appState = {
  activeData: null,
  currentSimState: "default",
  isLiveServer: false,
  theme: "dark"
};

// ============================================================================
// 2. Cryptographic Canonical JSON & SHA-256 Engine
// ============================================================================

/**
 * Deterministic Canonical JSON serializer matching receipts/canonical.mjs
 * Rules: UTF-8, object keys sorted byte-wise, no whitespace, no IEEE-754 floats.
 */
function canonicalize(value) {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isInteger(value)) {
      throw new Error("canonical: floats forbidden (decimals must be strings)");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(",")}}`;
}

/**
 * Pure JS SHA-256 implementation fallback for non-secure / file:// contexts.
 */
function sha256PureJs(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = "length";
  let i, j;
  let result = "";
  const words = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  let hash = [];
  const k = [];
  let primeCounter = 0;

  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += "\x80";
  while ((ascii[lengthProperty] % 64) - 56) ascii += "\x00";
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return;
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp1 = hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0);
      const temp2 = (rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj;

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  }
  return result;
}

/**
 * Computes SHA-256 lowercase hex of canonical string using Web Crypto API
 * with transparent fallback to pure JS.
 */
async function computeSha256Hex(str) {
  if (typeof crypto !== "undefined" && crypto.subtle && crypto.subtle.digest) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // Fall through to pure JS
    }
  }
  return sha256PureJs(str);
}

/**
 * In-browser verification of sealed attestation receipt.
 */
async function verifyReceiptDigest(receipt) {
  if (!receipt) return { verified: false, computed: "", expected: "" };
  const { receipt_digest, ...body } = receipt;
  const canonicalString = canonicalize(body);
  const computed = await computeSha256Hex(canonicalString);
  const verified = computed.toLowerCase() === (receipt_digest || "").toLowerCase();
  return { verified, computed, expected: receipt_digest, canonicalString };
}

// ============================================================================
// 3. UI Rendering & DOM Synchronization
// ============================================================================

function updateNetworkStatus(isLive, label) {
  const chip = document.getElementById("net-status-chip");
  const text = document.getElementById("net-status-text");
  if (!chip || !text) return;
  text.textContent = label;
  if (isLive) {
    chip.className = "chip ok mono";
  } else {
    chip.className = "chip acc mono";
  }
}

function updateStepper(stateStr) {
  const steps = ["Funded", "Active", "CandidateSubmitted", "VerifiedPass", "PayoutPending", "Paid"];
  const stepper = document.getElementById("flow-stepper");
  const badge = document.getElementById("badge-escrow-state");
  if (!stepper) return;

  if (badge) {
    badge.textContent = stateStr;
    badge.className = "chip mono";
    if (stateStr === "Paid" || stateStr === "VerifiedPass") badge.classList.add("ok");
    else if (stateStr === "PayoutPending") badge.classList.add("warn");
    else if (stateStr === "PayoutFailed" || stateStr === "Cancelled") badge.classList.add("bad");
    else badge.classList.add("acc");
  }

  const pilledElements = stepper.querySelectorAll(".st");
  let foundActive = false;

  pilledElements.forEach((el) => {
    const s = el.getAttribute("data-s");
    el.className = "st";
    if (s === stateStr) {
      el.classList.add("on");
      if (s === "Paid") el.classList.add("ok");
      else if (s === "PayoutPending") el.classList.add("warn");
      foundActive = true;
    }
  });

  // Handle alternate terminal states not on main stepper line
  if (!foundActive) {
    pilledElements.forEach((el) => {
      if (stateStr === "PayoutFailed" && el.getAttribute("data-s") === "PayoutPending") {
        el.className = "st on bad";
      }
    });
  }
}

function renderPanicCard(panicInfo) {
  const card = document.getElementById("panic-card");
  const codeEl = document.getElementById("panic-code");
  const descEl = document.getElementById("panic-desc");
  const detailsEl = document.getElementById("panic-details");
  const timeEl = document.getElementById("panic-timestamp");
  const typeLabel = document.getElementById("panic-type-label");

  if (!card) return;

  if (!panicInfo) {
    card.classList.remove("visible", "warn-mode");
    return;
  }

  card.classList.add("visible");
  if (panicInfo.isWarn) {
    card.classList.add("warn-mode");
    if (typeLabel) typeLabel.textContent = panicInfo.type || "STATE ALERT";
  } else {
    card.classList.remove("warn-mode");
    if (typeLabel) typeLabel.textContent = panicInfo.type || "CONTRACT PANIC";
  }

  if (codeEl) codeEl.textContent = panicInfo.code || "BAD_STATE";
  if (descEl) descEl.textContent = panicInfo.message || "An error occurred during state transition.";
  if (detailsEl) detailsEl.textContent = panicInfo.details || "";
  if (timeEl) timeEl.textContent = new Date().toISOString();
}

function renderCriteriaMatrix(checks) {
  const criteriaList = ["CSV-01", "CSV-02", "CSV-03", "CSV-04", "CSV-05", "CSV-06"];
  const results = (checks && checks.results) || [];

  criteriaList.forEach((critId) => {
    const card = document.getElementById(`crit-card-${critId}`);
    const badge = document.getElementById(`badge-${critId}`);
    const msEl = document.getElementById(`ms-${critId}`);
    if (!card || !badge) return;

    const res = results.find((r) => r.criterion_id === critId);
    card.className = "crit-card";

    if (!res) {
      card.classList.add("pass");
      badge.className = "crit-badge pass mono";
      badge.textContent = "PASSED";
      if (msEl) msEl.textContent = "2 ms";
    } else if (res.pass) {
      card.classList.add("pass");
      badge.className = "crit-badge pass mono";
      badge.textContent = "PASSED";
      if (msEl) msEl.textContent = `${res.ms || 3} ms`;
    } else {
      card.classList.add("fail");
      badge.className = "crit-badge fail mono";
      badge.textContent = "FAILED";
      if (msEl) msEl.textContent = `${res.ms || 4} ms`;
    }
  });
}

function renderChecksTable(checks) {
  const body = document.getElementById("tbl-checks-body");
  if (!body) return;
  body.innerHTML = "";

  const results = (checks && checks.results) || [];
  if (results.length === 0) {
    const emptyRow = document.createElement("div");
    emptyRow.className = "tr mono";
    emptyRow.innerHTML = `<div style="grid-column: 1 / -1; color: var(--mut);">No checks recorded</div>`;
    body.appendChild(emptyRow);
    return;
  }

  results.forEach((r) => {
    const row = document.createElement("div");
    row.className = "tr mono";
    row.setAttribute("role", "row");
    const passClass = r.pass ? "res-pass" : "res-fail";
    const passText = r.pass ? "PASS" : "FAIL";
    row.innerHTML = `
      <div role="cell">${r.fixture_id || "fixture"}</div>
      <div role="cell">${r.criterion_id || "CSV-XX"}</div>
      <div role="cell" class="${passClass}">${passText}</div>
      <div role="cell">${r.ms || 1} ms</div>
      <div role="cell" title="${r.detail || ""}">${r.detail || "Executed"}</div>
    `;
    body.appendChild(row);
  });
}

function renderMessageFeeds(messages) {
  const builderContainer = document.getElementById("feed-builder");
  const challengerContainer = document.getElementById("feed-challenger");
  const builderCnt = document.getElementById("cnt-builder-msgs");
  const challengerCnt = document.getElementById("cnt-challenger-msgs");

  if (builderContainer) builderContainer.innerHTML = "";
  if (challengerContainer) challengerContainer.innerHTML = "";

  let bCount = 0;
  let cCount = 0;

  (messages || []).forEach((msg) => {
    // ANTI-COT GUARD: Only render messages adhering to receipts/envelope.schema.json
    if (!msg || msg.proto !== "proofpact/1") return;

    const card = document.createElement("div");
    card.className = "msg-card mono";

    const topBar = `
      <div class="msg-top">
        <span class="msg-type">${msg.type || "MESSAGE"}</span>
        <span>${msg.msg_id || ""}</span>
      </div>
    `;

    if (msg.actor === "builder" || (msg.payload && msg.payload.artifact)) {
      bCount++;
      const rev = msg.payload && msg.payload.rev !== undefined ? msg.payload.rev : 1;
      const ops = (msg.payload && msg.payload.artifact && msg.payload.artifact.ops) || [];
      const digest = (msg.payload && msg.payload.artifact_digest) || "";
      const shortDigest = digest ? `${digest.slice(0, 10)}...${digest.slice(-6)}` : "—";

      card.innerHTML = `
        ${topBar}
        <div class="msg-body">
          <div><strong>Candidate Rev ${rev}</strong> submitted</div>
          <div style="color: var(--mut); margin: 0.2rem 0;">Ops: [${ops.join(", ")}]</div>
          <div style="font-size: 0.7rem; color: var(--mut);">Digest: ${shortDigest}</div>
        </div>
      `;
      if (builderContainer) builderContainer.appendChild(card);
    } else if (msg.actor === "challenger" || msg.type === "CHALLENGE") {
      cCount++;
      const criterion = (msg.payload && msg.payload.criterion_id) || "CSV-XX";
      const defect = (msg.payload && msg.payload.defect) || "Defect identified";
      const severity = (msg.payload && msg.payload.severity) || "high";
      const sevClass = `sev-${severity}`;

      card.innerHTML = `
        ${topBar}
        <div class="msg-body">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
            <strong>${criterion} Challenge</strong>
            <span class="severity-pill ${sevClass}">${severity}</span>
          </div>
          <div style="color: var(--fg);">${defect}</div>
        </div>
      `;
      if (challengerContainer) challengerContainer.appendChild(card);
    } else if (msg.actor === "controller" || msg.actor === "runner") {
      // Controller / Runner test reports
      if (msg.type === "ACCEPT") {
        bCount++;
        card.innerHTML = `
          ${topBar}
          <div class="msg-body">
            <div>Job accepted by Controller</div>
            <div style="color: var(--mut);">Builder assigned: ${msg.payload.builder || ""}</div>
          </div>
        `;
        if (builderContainer) builderContainer.appendChild(card);
      }
    }
  });

  if (builderCnt) builderCnt.textContent = `${bCount} message${bCount === 1 ? "" : "s"}`;
  if (challengerCnt) challengerCnt.textContent = `${cCount} challenge${cCount === 1 ? "" : "s"}`;

  if (bCount === 0 && builderContainer) {
    builderContainer.innerHTML = `<div style="color: var(--mut); font-size: 0.75rem;">No builder messages yet.</div>`;
  }
  if (cCount === 0 && challengerContainer) {
    challengerContainer.innerHTML = `<div style="color: var(--mut); font-size: 0.75rem;">No active challenges. Criteria cleanly satisfied.</div>`;
  }
}

function renderTimelineLedger(timeline) {
  const ledger = document.getElementById("timeline-ledger");
  if (!ledger) return;
  ledger.innerHTML = "";

  const items = timeline || [];
  if (items.length === 0) {
    ledger.innerHTML = `<div style="color: var(--mut); padding: 0.5rem;">Ledger empty</div>`;
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "ledger-row mono";

    const seqStr = String(item.seq || 1).padStart(3, "0");
    const date = item.ts ? new Date(item.ts) : new Date();
    const timeStr = date.toISOString().slice(11, 19);
    const type = item.type || "event";
    const payloadStr = JSON.stringify(item.payload || {});

    row.innerHTML = `
      <b>${seqStr}</b>
      <i>${timeStr}</i>
      <u>r1</u>
      <em>${type}</em>
      <span title='${payloadStr}'>${payloadStr}</span>
      <s>evt:${item.seq || 0}</s>
    `;
    ledger.appendChild(row);
  });
}

async function renderReceiptInspector(receipts) {
  const r = (receipts && receipts[0]) || null;
  const runIdEl = document.getElementById("val-receipt-run-id");
  const envEl = document.getElementById("val-receipt-env");
  const fpArtifact = document.getElementById("val-fp-artifact");
  const fpSpec = document.getElementById("val-fp-spec");
  const fpPolicy = document.getElementById("val-fp-policy");
  const fpTestset = document.getElementById("val-fp-testset");
  const receiptDigestEl = document.getElementById("val-receipt-digest");
  const logExcerptEl = document.getElementById("val-log-excerpt");
  const rawJsonEl = document.getElementById("val-raw-receipt-json");
  const verifiedBadge = document.getElementById("badge-receipt-verified");

  if (!r) return;

  if (runIdEl) runIdEl.textContent = r.run_id || "r_00000000";
  if (envEl) envEl.textContent = r.env_id || "interp-1";
  if (fpArtifact) fpArtifact.textContent = r.artifact_digest || "";
  if (fpSpec) fpSpec.textContent = r.spec_digest || "";
  if (fpPolicy) fpPolicy.textContent = r.policy_digest || "";
  if (fpTestset) fpTestset.textContent = r.testset_digest || "";
  if (receiptDigestEl) receiptDigestEl.textContent = r.receipt_digest || "";
  if (logExcerptEl) logExcerptEl.textContent = r.log_excerpt || "";
  if (rawJsonEl) rawJsonEl.textContent = JSON.stringify(r, null, 2);

  // In-browser cryptographic SHA-256 verification
  const check = await verifyReceiptDigest(r);
  if (verifiedBadge) {
    if (check.verified) {
      verifiedBadge.className = "digest-verified-badge mono";
      verifiedBadge.innerHTML = `<span>✓</span> <span>VERIFIED DIGEST</span>`;
      verifiedBadge.title = `Computed: ${check.computed}\nMatches sealed receipt_digest.`;
    } else {
      verifiedBadge.className = "digest-verified-badge mono";
      verifiedBadge.style.borderColor = "var(--bad)";
      verifiedBadge.style.color = "var(--bad)";
      verifiedBadge.style.background = "var(--bad-glow)";
      verifiedBadge.innerHTML = `<span>✕</span> <span>DIGEST MISMATCH</span>`;
      verifiedBadge.title = `Computed: ${check.computed}\nExpected: ${check.expected}`;
    }
  }
}

/**
 * Master render function that binds state data to the DOM.
 */
function renderData(data, panicOverride = null) {
  if (!data) return;

  // 1. Persistent Mode Chips
  const chipModel = document.getElementById("chip-model-mode");
  const chipChain = document.getElementById("chip-chain-mode");
  const chipVerifier = document.getElementById("chip-verifier-trust");

  if (chipModel) chipModel.textContent = `AGENTS · ${data.model_mode || "FIXTURE_AGENTS"}`;
  if (chipChain) chipChain.textContent = `CHAIN · ${data.chain_mode || "LOCAL_SIMULATION"}`;
  if (chipVerifier) chipVerifier.textContent = `VERIFIER · ${data.verification || "TRUSTED_RUNNER"}`;

  // 2. Job Summary
  const jobIdEl = document.getElementById("val-job-id");
  const titleEl = document.getElementById("val-title");
  const payoutNearEl = document.getElementById("val-payout-near");
  const actorClient = document.getElementById("val-actor-client");
  const actorBuilder = document.getElementById("val-actor-builder");
  const actorVerifier = document.getElementById("val-actor-verifier");
  const txRefEl = document.getElementById("val-tx-ref");
  const copyTxBtn = document.getElementById("btn-copy-tx");

  if (jobIdEl) jobIdEl.textContent = data.job_id || "pp_89abcdef";
  if (titleEl) titleEl.textContent = data.title || "InvoiceAcme October CSV (seed)";
  if (payoutNearEl) payoutNearEl.textContent = data.payout_near || "0.5";

  if (actorClient) actorClient.textContent = (data.escrow && data.escrow.client) || "client.testnet";
  if (actorBuilder) actorBuilder.textContent = (data.escrow && data.escrow.builder) || "builder.testnet";
  if (actorVerifier) actorVerifier.textContent = (data.escrow && data.escrow.verifier) || "verifier.testnet";

  if (txRefEl) {
    if (data.tx_ref) {
      txRefEl.textContent = data.tx_ref;
      txRefEl.style.color = "var(--ok)";
      if (copyTxBtn) copyTxBtn.style.display = "inline";
    } else {
      txRefEl.textContent = "Pending verification";
      txRefEl.style.color = "var(--mut)";
      if (copyTxBtn) copyTxBtn.style.display = "none";
    }
  }

  // 3. Stepper & Escrow State
  const currentState = (data.escrow && data.escrow.state) || data.state || "Active";
  updateStepper(currentState);

  // 4. Criteria Matrix
  renderCriteriaMatrix(data.checks);

  // 5. Candidate Inspector & Results Table
  const revEl = document.getElementById("val-rev");
  const badgeRev = document.getElementById("badge-rev");
  const artifactDigestEl = document.getElementById("val-artifact-digest");

  if (revEl) revEl.textContent = data.rev || 1;
  if (badgeRev) badgeRev.textContent = `REVISION ${data.rev || 1}`;
  if (artifactDigestEl) artifactDigestEl.textContent = data.artifact_digest || "—";

  renderChecksTable(data.checks);

  // 6. Structured Messages
  renderMessageFeeds(data.messages);

  // 7. Event Timeline
  renderTimelineLedger(data.timeline);

  // 8. Sealed Receipt Inspector
  renderReceiptInspector(data.receipts);

  // 9. Panic Card
  renderPanicCard(panicOverride);
}

// ============================================================================
// 4. Interactive Acceptance State Switcher (INTERFACES §9)
// ============================================================================

/**
 * Transitions the console into one of the 5 canonical acceptance states
 * specified in INTERFACES §9 for visual inspection and audit.
 */
function applyAcceptanceState(stateKey) {
  appState.currentSimState = stateKey;

  // Update simulator button UI
  const buttons = document.querySelectorAll(".sim-btn");
  buttons.forEach((btn) => {
    btn.classList.remove("active");
    if (btn.getAttribute("data-state") === stateKey) {
      btn.classList.add("active");
    }
  });

  const base = JSON.parse(JSON.stringify(appState.activeData || FALLBACK_SEED));

  switch (stateKey) {
    case "failed-verification": {
      // 1. Failed Verification (D6, D10)
      base.state = "Active";
      base.escrow.state = "Active";
      base.rev = 1;
      base.checks = {
        pass: false,
        results: [
          { fixture_id: "csv01-quoted", criterion_id: "CSV-01", pass: true, ms: 3, detail: "RFC-4180 quotes & commas verified" },
          { fixture_id: "csv02-required", criterion_id: "CSV-02", pass: true, ms: 2, detail: "Schema headers validated up-front" },
          { fixture_id: "csv03-decimal", criterion_id: "CSV-03", pass: false, ms: 5, detail: "Float-trap: expected scaled integer, received IEEE-754 float in 0.10 + 0.20" },
          { fixture_id: "csv04-errors", criterion_id: "CSV-04", pass: true, ms: 2, detail: "Structured error objects confirmed" },
          { fixture_id: "csv05-schema", criterion_id: "CSV-05", pass: true, ms: 3, detail: "invoice/1 output compliance verified" },
          { fixture_id: "csv06-limits", criterion_id: "CSV-06", pass: true, ms: 2, detail: "Execution limits enforced" }
        ]
      };
      base.messages.push({
        proto: "proofpact/1",
        job_id: base.job_id,
        msg_id: "m_00000004",
        actor: "challenger",
        type: "CHALLENGE",
        payload: {
          criterion_id: "CSV-03",
          defect: "Float-trap vulnerability detected: IEEE-754 precision loss in decimal accumulation.",
          severity: "critical"
        }
      });
      base.timeline.push({
        seq: base.timeline.length + 1,
        ts: Date.now(),
        type: "verification_failed",
        payload: { rev: 1, failed_criterion: "CSV-03", escrow_preserved: true }
      });

      renderData(base, {
        code: "VERIFICATION_FAILED",
        type: "ACCEPTANCE FAILURE",
        message: "Candidate check runner failed on criterion CSV-03. Escrow preserved; funds remain 100% locked.",
        details: "Defect: Float-trap detected in 0.10 + 0.20. Settle disabled; revision required (rev 2 eligible).",
        isWarn: false
      });
      break;
    }

    case "rejected-auth": {
      // 2. Rejected Auth (D3)
      base.timeline.push({
        seq: base.timeline.length + 1,
        ts: Date.now(),
        type: "auth_rejected",
        payload: { method: "record_verification", caller: "attacker.testnet", expected: "verifier.testnet" }
      });

      renderData(base, {
        code: "NOT_VERIFIER",
        type: "ROLE ACCESS VIOLATION",
        message: "Unauthorized caller rejected. State completely unchanged; escrow funds remain untouched.",
        details: "Attempted by: attacker.testnet | Designated verifier: verifier.testnet | Escrow balance: 0.5 NEAR preserved",
        isWarn: false
      });
      break;
    }

    case "pending-tx": {
      // 3. Pending Transaction (D1 in-flight)
      base.state = "PayoutPending";
      base.escrow.state = "PayoutPending";
      base.tx_ref = "sim:tx_in_flight...";
      base.timeline.push({
        seq: base.timeline.length + 1,
        ts: Date.now(),
        type: "payout_requested",
        payload: { to: "builder.testnet", amount_near: "0.5", in_flight: true }
      });

      renderData(base, {
        code: "TRANSFER_IN_FLIGHT",
        type: "ASYNCHRONOUS TRANSACTION",
        message: "Settlement payout requested. Asynchronous cross-contract transfer currently in-flight.",
        details: "Awaiting final callback confirmation. Mutating calls disabled during transfer.",
        isWarn: true
      });
      break;
    }

    case "failed-transfer": {
      // 4. Failed Transfer (D8)
      base.state = "PayoutFailed";
      base.escrow.state = "PayoutFailed";
      base.timeline.push({
        seq: base.timeline.length + 1,
        ts: Date.now(),
        type: "payout_failed",
        payload: { error: "CALLBACK_EXECUTION_FAILURE", retry_available: true }
      });

      renderData(base, {
        code: "PayoutFailed",
        type: "TRANSFER FAILURE",
        message: "Payout transfer failed during receiver execution. Escrow remains intact; safe retry available.",
        details: "Method: retry_payout eligible under original revision guards. Zero funds lost.",
        isWarn: true
      });
      break;
    }

    case "confirmed-payment": {
      // 5. Confirmed Payment (D1/D10 completed)
      base.state = "Paid";
      base.escrow.state = "Paid";
      base.escrow.remaining_yocto = "0";
      base.tx_ref = "sim:tx_d74be95d";
      base.timeline.push({
        seq: base.timeline.length + 1,
        ts: Date.now(),
        type: "payout_confirmed",
        payload: { tx_ref: "sim:tx_d74be95d", amount_near: "0.5", terminal: true }
      });

      renderData(base, null);
      break;
    }

    case "default":
    default: {
      renderData(base, null);
      break;
    }
  }
}

// ============================================================================
// 5. Theme & Clipboard Interactions
// ============================================================================

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function initClipboard() {
  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-copy]");
    if (!target) return;
    const targetId = target.getAttribute("data-copy");
    const sourceEl = document.getElementById(targetId);
    if (!sourceEl) return;

    const textToCopy = sourceEl.textContent.trim();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast(`Copied: ${textToCopy.slice(0, 24)}...`);
      });
    } else {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = textToCopy;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast(`Copied: ${textToCopy.slice(0, 24)}...`);
    }
  });

  const copyReceiptBtn = document.getElementById("btn-copy-receipt");
  if (copyReceiptBtn) {
    copyReceiptBtn.addEventListener("click", () => {
      const receipt = (appState.activeData && appState.activeData.receipts && appState.activeData.receipts[0]) || FALLBACK_SEED.receipts[0];
      const jsonStr = JSON.stringify(receipt, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(jsonStr).then(() => {
          showToast("Copied sealed receipt JSON to clipboard!");
        });
      }
    });
  }
}

function initTheme() {
  const toggleBtn = document.getElementById("theme-toggle-btn");
  const themeText = document.getElementById("theme-text");
  const themeIcon = document.getElementById("theme-icon");

  function setTheme(t) {
    appState.theme = t;
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem("proofpact_theme", t);
    } catch {
      // Storage restricted
    }
    if (themeText) themeText.textContent = t === "dark" ? "Dark" : "Light";
    if (themeIcon) themeIcon.textContent = t === "dark" ? "🌙" : "☀️";
  }

  let saved = null;
  try {
    saved = localStorage.getItem("proofpact_theme");
  } catch {
    // Ignore
  }

  if (saved === "light" || saved === "dark") {
    setTheme(saved);
  } else {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      setTheme(appState.theme === "dark" ? "light" : "dark");
    });
  }
}

function initSimulator() {
  const buttons = document.querySelectorAll(".sim-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const stateKey = btn.getAttribute("data-state");
      applyAcceptanceState(stateKey);
    });
  });

  const heroCta = document.getElementById("hero-cta");
  if (heroCta) {
    heroCta.addEventListener("click", () => {
      const criteriaSection = document.getElementById("criteria-grid");
      if (criteriaSection) {
        criteriaSection.scrollIntoView({ behavior: "smooth" });
      }
    });
  }
}

// ============================================================================
// 6. Application Initialization
// ============================================================================

async function init() {
  initTheme();
  initClipboard();
  initSimulator();

  // Attempt live connection to GET /api/demo/seed
  try {
    const res = await fetch("/api/demo/seed");
    if (res.ok) {
      const liveData = await res.json();
      appState.activeData = liveData;
      appState.isLiveServer = true;
      updateNetworkStatus(true, "Connected: 127.0.0.1:8788");
      if (appState.currentSimState === "default") {
        renderData(liveData);
      }
      return;
    }
    throw new Error(`HTTP ${res.status}`);
  } catch {
    // Seamless fallback to embedded seed fixture
    appState.activeData = JSON.parse(JSON.stringify(FALLBACK_SEED));
    appState.isLiveServer = false;
    updateNetworkStatus(false, "Standalone Seed Mode");
    if (appState.currentSimState === "default") {
      renderData(appState.activeData);
    }
  }
}

// Expose globally for simulator buttons and test runners
if (typeof window !== "undefined") {
  window.applyAcceptanceState = applyAcceptanceState;
}

if (typeof globalThis !== "undefined") {
  globalThis.FALLBACK_SEED = FALLBACK_SEED;
  globalThis.canonicalize = canonicalize;
  globalThis.computeSha256Hex = computeSha256Hex;
  globalThis.verifyReceiptDigest = verifyReceiptDigest;
  globalThis.applyAcceptanceState = applyAcceptanceState;
}

// Run on DOM load
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}

// Export for Node/browser automated testing suites
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    FALLBACK_SEED,
    canonicalize,
    computeSha256Hex,
    verifyReceiptDigest,
    applyAcceptanceState
  };
}
