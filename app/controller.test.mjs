// ProofPact app/controller.test.mjs — S2 suite (node:test, zero deps).
// Covers the app-level analogues of acceptance demos D1/D2/D4/D5/D9/D10:
// happy path, premature settlement, verified-lock, double settle, challenge
// gating, revision loop, budgets, malformed input, digest mismatch, deadline.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { digestOf } from "../receipts/canonical.mjs";
import * as C from "./controller.mjs";

const T0 = 1792214400000;
const ART = { format: "csv-xform/1", ops: ["select_columns"] };
const CH = (severity = "high") => ({
  criterion_id: "CSV-03", defect: "uses float money", severity,
  fixture: { id: "f1", rows: [["1.10"]] }, expected: "decimal strings",
});

const mkstore = () => ({ seq: 0, jobs: {}, receipts: {} });
const mkjob = (store, over = {}) => C.createJob(store,
  { title: "t", payout_near: "0.5", deadline_ms: T0 + 60000, ...over }, T0);

function throwsCode(fn, code) {
  try {
    fn();
  } catch (e) {
    assert.equal(e.code, code, `expected ${code}, got ${e.code}: ${e.message}`);
    return;
  }
  assert.fail(`expected throw ${code}, nothing thrown`);
}

describe("controller happy path (D1)", () => {
  it("create -> artifact -> verify pass -> settle Paid, exactly once", () => {
    const s = mkstore();
    const job = mkjob(s);
    assert.equal(job.state, "Active");
    const a = C.submitArtifact(s, job.job_id, { artifact: ART }, T0);
    assert.equal(a.rev, 1);
    assert.match(a.artifact_digest, /^[0-9a-f]{64}$/);
    const v = C.verifyJob(s, job.job_id, T0);
    assert.equal(v.pass, true);
    const st = C.settleJob(s, job.job_id, T0);
    assert.equal(st.state, "Paid");
    assert.match(st.tx_ref, /^sim:tx_[0-9a-f]{8}$/);
    const view = C.jobView(s, job.job_id);
    assert.equal(view.state, "Paid");
    assert.equal(view.settlement.amount_near, "0.5");
  });

  it("stores a sealed receipt whose digest recomputes", () => {
    const s = mkstore();
    const job = mkjob(s);
    C.submitArtifact(s, job.job_id, { artifact: ART }, T0);
    const v = C.verifyJob(s, job.job_id, T0);
    const r = s.receipts[v.receipt_ref];
    assert.ok(r);
    const { receipt_digest, ...body } = r;
    assert.equal(digestOf(body), receipt_digest);
    assert.equal(r.op, "local-verify");
    assert.equal(r.env_id, "local-sim-1");
  });
});

describe("premature settlement (D2)", () => {
  it("rejects settle before artifact and before verification", () => {
    const s = mkstore();
    const job = mkjob(s);
    throwsCode(() => C.settleJob(s, job.job_id, T0), "BAD_STATE");
    C.submitArtifact(s, job.job_id, { artifact: ART }, T0);
    throwsCode(() => C.settleJob(s, job.job_id, T0), "BAD_STATE");
    assert.equal(s.jobs[job.job_id].state, "CandidateSubmitted");
    assert.equal(s.jobs[job.job_id].settlement, null);
  });
});

describe("double settle (D5)", () => {
  it("second settle is rejected, first stands", () => {
    const s = mkstore();
    const job = mkjob(s);
    C.submitArtifact(s, job.job_id, { artifact: ART }, T0);
    C.verifyJob(s, job.job_id, T0);
    const first = C.settleJob(s, job.job_id, T0);
    throwsCode(() => C.settleJob(s, job.job_id, T0 + 1), "DOUBLE_SETTLE");
    assert.equal(s.jobs[job.job_id].settlement.tx_ref, first.tx_ref);
  });
});

describe("challenge gating + revision loop (D10)", () => {
  it("high challenge fails rev1, rev2 passes and pays", () => {
    const s = mkstore();
    const job = mkjob(s);
    C.submitArtifact(s, job.job_id, { artifact: ART }, T0);
    const ch = C.submitChallenge(s, job.job_id, CH("high"), T0);
    assert.equal(ch.accepted, true);
    const v1 = C.verifyJob(s, job.job_id, T0);
    assert.equal(v1.pass, false);
    assert.equal(s.jobs[job.job_id].state, "Active");
    const a2 = C.submitArtifact(s, job.job_id, { artifact: ART }, T0);
    assert.equal(a2.rev, 2);
    const v2 = C.verifyJob(s, job.job_id, T0);
    assert.equal(v2.pass, true); // old-rev challenge does not gate the new rev
    const st = C.settleJob(s, job.job_id, T0);
    assert.equal(st.state, "Paid");
  });

  it("low/medium challenges are recorded but non-blocking", () => {
    const s = mkstore();
    const job = mkjob(s);
    C.submitArtifact(s, job.job_id, { artifact: ART }, T0);
    C.submitChallenge(s, job.job_id, CH("low"), T0);
    C.submitChallenge(s, job.job_id, CH("medium"), T0);
    assert.equal(C.verifyJob(s, job.job_id, T0).pass, true);
  });
});

describe("budgets", () => {
  it("rev4 exceeds initial + 2 revisions", () => {
    const s = mkstore();
    const job = mkjob(s);
    for (let rev = 1; rev <= 3; rev++) {
      C.submitArtifact(s, job.job_id, { artifact: ART }, T0);
      C.submitChallenge(s, job.job_id, CH("critical"), T0);
      assert.equal(C.verifyJob(s, job.job_id, T0).pass, false);
    }
    throwsCode(() => C.submitArtifact(s, job.job_id, { artifact: ART }, T0), "BUDGET_REVISIONS");
  });

  it("41st model request is rejected", () => {
    const s = mkstore();
    const job = mkjob(s);
    C.recordModelRequest(s, job.job_id, 40);
    throwsCode(() => C.recordModelRequest(s, job.job_id, 1), "BUDGET_REQUESTS");
  });

  it("expired jobs cannot verify", () => {
    const s = mkstore();
    const job = mkjob(s);
    C.submitArtifact(s, job.job_id, { artifact: ART }, T0);
    throwsCode(() => C.verifyJob(s, job.job_id, T0 + 16 * 60 * 1000), "BUDGET_WALLCLOCK");
  });
});

describe("hostile input (D9)", () => {
  it("rejects malformed artifacts, challenges, and job fields", () => {
    const s = mkstore();
    throwsCode(() => mkjob(s, { payout_near: "abc" }), "BAD_PAYOUT");
    throwsCode(() => mkjob(s, { payout_near: "0" }), "BAD_PAYOUT");
    throwsCode(() => C.createJob(s, { title: "t", payout_near: "1", deadline_ms: T0 - 1 }, T0), "BAD_DEADLINE");
    const job = mkjob(s);
    throwsCode(() => C.submitArtifact(s, job.job_id, { artifact: { format: "evil", ops: [] } }, T0), "INVALID_ARTIFACT");
    throwsCode(() => C.submitArtifact(s, job.job_id, { artifact: { format: "csv-xform/1", ops: ["rm_rf"] } }, T0), "UNKNOWN_OP");
    throwsCode(() => C.submitChallenge(s, job.job_id, { ...CH(), criterion_id: "CSV-99" }, T0), "BAD_CRITERION");
    throwsCode(() => C.submitChallenge(s, job.job_id, { ...CH(), severity: "extreme" }, T0), "BAD_SEVERITY");
    throwsCode(() => C.submitChallenge(s, job.job_id, { ...CH(), fixture: null }, T0), "BAD_CHALLENGE");
    assert.equal(s.jobs[job.job_id].rev, 0); // failures mutate nothing
    assert.equal(s.jobs[job.job_id].requests, 0);
  });

  it("detects artifact tampering via digest recompute", () => {
    const s = mkstore();
    const job = mkjob(s);
    C.submitArtifact(s, job.job_id, { artifact: ART }, T0);
    s.jobs[job.job_id].artifact.ops.push("emit_invoice");
    throwsCode(() => C.verifyJob(s, job.job_id, T0), "DIGEST_MISMATCH");
  });
});

describe("locks and deadlines", () => {
  it("verified jobs reject new artifacts (D4 analogue)", () => {
    const s = mkstore();
    const job = mkjob(s);
    C.submitArtifact(s, job.job_id, { artifact: ART }, T0);
    C.verifyJob(s, job.job_id, T0);
    throwsCode(() => C.submitArtifact(s, job.job_id, { artifact: ART }, T0), "BAD_STATE");
  });

  it("settle after deadline is rejected", () => {
    const s = mkstore();
    const job = mkjob(s, { deadline_ms: T0 + 1000 });
    C.submitArtifact(s, job.job_id, { artifact: ART }, T0);
    C.verifyJob(s, job.job_id, T0 + 500);
    throwsCode(() => C.settleJob(s, job.job_id, T0 + 1500), "DEADLINE_PASSED");
  });

  it("unknown ids 404 cleanly", () => {
    const s = mkstore();
    throwsCode(() => C.jobView(s, "pp_deadbeef"), "JOB_NOT_FOUND");
    throwsCode(() => C.verifyJob(s, "pp_deadbeef", T0), "JOB_NOT_FOUND");
  });
});
