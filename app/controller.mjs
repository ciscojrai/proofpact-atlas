// ProofPact app/controller.mjs — deterministic orchestration (S2, INTERFACES §2).
// All decisions take `now` (ms) explicitly: same inputs + same now = same outputs.
// Mutates the passed store object only; the caller persists. No network, no chain.
// LOCAL_SIMULATION: settlement is simulated (tx_ref `sim:...`); the SANDBOX /
// TESTNET adapters will replace the transfer step in Phase 3, never the guards.
import { randomBytes } from "node:crypto";
import { digestOf } from "../receipts/canonical.mjs";
import { logEvent } from "./store.mjs";

export const FROZEN_OPS = ["select_columns", "rename_columns", "require_columns", "parse_decimal", "reject_rows", "emit_invoice"];
export const CRITERIA = ["CSV-01", "CSV-02", "CSV-03", "CSV-04", "CSV-05", "CSV-06"];
export const SEVERITIES = ["low", "medium", "high", "critical"];
const BLOCKING = new Set(["high", "critical"]);
export const MAX_REV = 3; // initial submit + 2 revision rounds
export const MAX_REQUESTS = 40;
export const WALL_MS = 15 * 60 * 1000;
export const MAX_MSG_BYTES = 64 * 1024;
export const MAX_FIXTURE_BYTES = 16 * 1024;

export function fail(code, detail) {
  const e = new Error(detail || code);
  e.code = code;
  throw e;
}

const rid = (p) => p + randomBytes(4).toString("hex");

export function requireJob(store, job_id) {
  const job = store.jobs[job_id];
  if (!job) fail("JOB_NOT_FOUND", `no such job: ${job_id}`);
  return job;
}

function checkWall(job, now) {
  if (now - job.created_at > WALL_MS) fail("BUDGET_WALLCLOCK", "15-minute job budget exhausted");
}

function checkRequests(job, n = 1) {
  if (job.requests + n > MAX_REQUESTS) fail("BUDGET_REQUESTS", "40-request job budget exhausted");
}

function envelope(job_id, actor, type, payload, corr) {
  const msg = { proto: "proofpact/1", job_id, msg_id: rid("m_"), actor, type, payload };
  if (corr) msg.corr = corr;
  if (Buffer.byteLength(JSON.stringify(msg), "utf8") > MAX_MSG_BYTES) fail("MESSAGE_TOO_LARGE", ">64KB");
  return msg;
}

export function validateEnvelope(msg) {
  if (!msg || msg.proto !== "proofpact/1") fail("INVALID_ENVELOPE", "proto must be proofpact/1");
  if (!/^pp_[0-9a-f]{8}$/.test(msg.job_id || "")) fail("INVALID_ENVELOPE", "bad job_id");
  if (typeof msg.actor !== "string" || !msg.actor) fail("INVALID_ENVELOPE", "bad actor");
  if (typeof msg.payload !== "object" || !msg.payload) fail("INVALID_ENVELOPE", "payload must be an object");
  if (Buffer.byteLength(JSON.stringify(msg), "utf8") > MAX_MSG_BYTES) fail("MESSAGE_TOO_LARGE", ">64KB");
  return true;
}

function checkArtifact(artifact) {
  if (!artifact || typeof artifact !== "object" || artifact.format !== "csv-xform/1") {
    fail("INVALID_ARTIFACT", "artifact must be {format:'csv-xform/1', ops:[...]}");
  }
  const keys = Object.keys(artifact);
  if (keys.length !== 2 || !keys.includes("format") || !keys.includes("ops")) {
    fail("INVALID_ARTIFACT", "artifact must have exactly {format, ops} (family SPEC §0)");
  }
  if (!Array.isArray(artifact.ops)) fail("INVALID_ARTIFACT", "ops must be an array");
  for (const op of artifact.ops) {
    const name = typeof op === "string" ? op : op?.op;
    if (!FROZEN_OPS.includes(name)) fail("UNKNOWN_OP", `op not allowlisted: ${String(name).slice(0, 64)}`);
  }
}

export function createJob(store, input, now = Date.now()) {
  const { title, payout_near, deadline_ms } = input || {};
  if (!title || typeof title !== "string" || !title.trim()) fail("BAD_TITLE", "title required");
  if (!/^\d+(\.\d+)?$/.test(String(payout_near ?? "")) || Number(payout_near) <= 0) {
    fail("BAD_PAYOUT", "payout_near must be a positive decimal string");
  }
  if (!Number.isInteger(deadline_ms) || deadline_ms <= now) {
    fail("BAD_DEADLINE", "deadline_ms must be a future integer ms");
  }
  const job = {
    job_id: rid("pp_"), title: title.trim(), payout_near: String(payout_near), deadline_ms,
    criteria: [...CRITERIA], state: "Active", rev: 0,
    artifact: null, artifact_digest: null, challenges: [],
    requests: 0, created_at: now, attempts: [],
    verification: null, settlement: null, timeline: [], messages: [],
  };
  store.jobs[job.job_id] = job;
  job.messages.push(envelope(job.job_id, "controller", "ACCEPT", { job_id: job.job_id, builder: "builder:pending" }));
  logEvent(store, job, "job_created", { title: job.title });
  return job;
}

export function submitArtifact(store, job_id, payload, now = Date.now()) {
  const job = requireJob(store, job_id);
  checkWall(job, now);
  if (job.state !== "Active") fail("BAD_STATE", `submit needs Active, job is ${job.state}`);
  checkArtifact(payload?.artifact);
  const rev = job.rev + 1;
  if (rev > MAX_REV) fail("BUDGET_REVISIONS", `rev ${rev} exceeds initial + 2 revisions`);
  checkRequests(job, 1);
  job.requests += 1;
  job.rev = rev;
  job.artifact = payload.artifact;
  job.artifact_digest = digestOf(payload.artifact);
  job.state = "CandidateSubmitted";
  const msg = envelope(job_id, "builder", "ARTIFACT_SUBMITTED",
    { rev, artifact: job.artifact, artifact_digest: job.artifact_digest });
  job.messages.push(msg);
  logEvent(store, job, "artifact_submitted", { rev, digest: job.artifact_digest });
  return { rev, artifact_digest: job.artifact_digest };
}

export function submitChallenge(store, job_id, payload, now = Date.now()) {
  const job = requireJob(store, job_id);
  checkWall(job, now);
  if (["Paid", "Refunded", "Cancelled"].includes(job.state)) fail("BAD_STATE", `job is ${job.state}`);
  const { criterion_id, defect, fixture, expected, severity } = payload || {};
  if (!CRITERIA.includes(criterion_id)) fail("BAD_CRITERION", `want one of ${CRITERIA.join(",")}`);
  if (!defect || typeof defect !== "string") fail("BAD_CHALLENGE", "defect required");
  if (!fixture || typeof fixture !== "object") fail("BAD_CHALLENGE", "bounded fixture required");
  if (Buffer.byteLength(JSON.stringify(fixture), "utf8") > MAX_FIXTURE_BYTES) fail("FIXTURE_TOO_LARGE", ">16KB");
  if (!SEVERITIES.includes(severity)) fail("BAD_SEVERITY", `want one of ${SEVERITIES.join(",")}`);
  checkRequests(job, 1);
  job.requests += 1;
  const fixture_id = `fx_${job.rev}_${job.challenges.length + 1}`;
  const challenge = { fixture_id, rev: job.rev, criterion_id, defect, fixture, expected: expected ?? null, severity, status: "open" };
  job.challenges.push(challenge);
  job.messages.push(envelope(job_id, "challenger", "CHALLENGE", challenge));
  logEvent(store, job, "challenge_recorded", { fixture_id, criterion_id, severity });
  return { accepted: true, fixture_id };
}

function sealReceipt(body) {
  return { ...body, receipt_digest: digestOf(body) };
}

export function verifyJob(store, job_id, now = Date.now()) {
  const job = requireJob(store, job_id);
  checkWall(job, now);
  if (job.state !== "CandidateSubmitted") fail("BAD_STATE", `verify needs CandidateSubmitted, job is ${job.state}`);
  if (digestOf(job.artifact) !== job.artifact_digest) fail("DIGEST_MISMATCH", "stored artifact digest does not recompute");
  const blocking = job.challenges.filter(
    (c) => c.rev === job.rev && c.status === "open" && BLOCKING.has(c.severity));
  const pass = blocking.length === 0;
  const run_id = rid("r_");
  const receipt = sealReceipt({
    run_id, job_id, rev: job.rev,
    artifact_digest: job.artifact_digest,
    spec_digest: digestOf({ title: job.title, criteria: job.criteria, payout_near: job.payout_near }),
    policy_digest: digestOf({ max_rev: MAX_REV, max_requests: MAX_REQUESTS, wall_ms: WALL_MS }),
    testset_digest: digestOf({ structural: true, challenges: blocking.map((c) => c.fixture_id).sort() }),
    env_id: "local-sim-1", op: "local-verify",
    started_at: now, ended_at: now, exit: pass ? "pass" : "fail",
    log_excerpt: (pass
      ? `rev ${job.rev}: structural ok, no blocking challenges`
      : `rev ${job.rev}: blocked by ${blocking.map((c) => c.fixture_id).join(",")}`).slice(0, 2048),
    refs: [`job:${job_id}`, `rev:${job.rev}`],
  });
  store.receipts[run_id] = receipt;
  job.attempts.push({ rev: job.rev, run_id, pass });
  job.messages.push(envelope(job_id, "runner", "TEST_RESULT", { rev: job.rev, pass, run_id }));
  logEvent(store, job, "verification_recorded", { rev: job.rev, pass, run_id });
  if (pass) {
    job.state = "Verified";
    job.verification = { rev: job.rev, run_id, receipt_digest: receipt.receipt_digest, at: now };
  } else {
    job.state = "Active"; // eligible revision state; next submit must be rev+1
  }
  return { rev: job.rev, pass, receipt_ref: run_id };
}

export function settleJob(store, job_id, now = Date.now()) {
  const job = requireJob(store, job_id);
  if (job.settlement) fail("DOUBLE_SETTLE", "job already settled");
  if (job.state !== "Verified") fail("BAD_STATE", `settle needs Verified, job is ${job.state} (premature settlement rejected)`);
  if (!job.verification || job.verification.rev !== job.rev) fail("STALE_VERIFICATION", "verification does not bind current rev");
  if (now >= job.deadline_ms) fail("DEADLINE_PASSED", "deadline passed; refund path instead of payout");
  const tx_ref = `sim:tx_${randomBytes(4).toString("hex")}`;
  job.settlement = { tx_ref, at: now, amount_near: job.payout_near };
  job.state = "Paid";
  logEvent(store, job, "payout_confirmed", { tx_ref });
  return { state: "Paid", tx_ref };
}

export function recordModelRequest(store, job_id, n = 1) {
  const job = requireJob(store, job_id);
  checkRequests(job, n);
  job.requests += n;
  return { requests: job.requests };
}

export function jobView(store, job_id) {
  return structuredClone(requireJob(store, job_id));
}
