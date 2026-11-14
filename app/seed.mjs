// ProofPact app/seed.mjs — canned job for GET /api/demo/seed (INTERFACES §7).
// Lets the UI build with zero backend. Shapes match §2/§5/§7 exactly; the
// embedded receipt is the REAL sealed golden vector from receipts/.
export const seed = {
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
    { proto: "proofpact/1", job_id: "pp_89abcdef", msg_id: "m_00000001", actor: "controller", type: "ACCEPT", payload: { job_id: "pp_89abcdef", builder: "builder.testnet" } },
    { proto: "proofpact/1", job_id: "pp_89abcdef", msg_id: "m_00000002", actor: "builder", corr: "m_00000001", type: "ARTIFACT_SUBMITTED", payload: { rev: 1, artifact: { format: "csv-xform/1", ops: [] }, artifact_digest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } },
    { proto: "proofpact/1", job_id: "pp_89abcdef", msg_id: "m_00000003", actor: "runner", corr: "m_00000002", type: "TEST_RESULT", payload: { rev: 1, pass: true, results: [{ fixture_id: "csv01-quoted", criterion_id: "CSV-01", pass: true, ms: 3, detail: "seed" }] } },
  ],
  checks: { pass: true, results: [{ fixture_id: "csv01-quoted", criterion_id: "CSV-01", pass: true, ms: 3, detail: "seed" }] },
  escrow: { state: "Active", funded_yocto: "500000000000000000000000", remaining_yocto: "500000000000000000000000", verifier: "verifier.testnet", builder: "builder.testnet" },
  timeline: [
    { seq: 1, ts: 1792214400000, type: "job_funded", payload: {} },
    { seq: 2, ts: 1792214400100, type: "job_activated", payload: {} },
    { seq: 3, ts: 1792214400123, type: "checks_passed", payload: { rev: 1 } },
  ],
  receipts: [
    {
      run_id: "r_01234567", job_id: "pp_89abcdef", rev: 2,
      artifact_digest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      spec_digest: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      policy_digest: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      testset_digest: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      env_id: "interp-1", op: "runChecks",
      started_at: 1792214400000, ended_at: 1792214400123, exit: "pass",
      log_excerpt: "20 fixtures, 20 pass, 0 fail (golden vector, deterministic)",
      refs: ["evt:12", "evt:13"],
      receipt_digest: "f949fea06e317440d5a3ea5de4f9218061165df595c469ff70889c0f1a7423fd",
    },
  ],
};
