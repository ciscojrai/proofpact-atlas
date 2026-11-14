/**
 * Shared sandbox helpers for ProofPact S1 contract tests (near-workspaces v5, sandbox 2.14).
 */
const { Worker } = require("near-workspaces");
const path = require("path");

const WASM = path.join(
  __dirname,
  "..",
  "target",
  "wasm32-unknown-unknown",
  "release",
  "proofpact.wasm"
);

const ONE_NEAR = 10n ** 24n;
const RESERVE_YOCTO = 10n ** 22n; // 0.01 NEAR
const MIN_DEPOSIT = ONE_NEAR + RESERVE_YOCTO;

const SPEC_DIGEST = "a".repeat(64);
const POLICY_DIGEST = "b".repeat(64);
const ARTIFACT_DIGEST_1 = "c".repeat(64);
const ARTIFACT_DIGEST_2 = "d".repeat(64);
const RESULT_DIGEST_1 = "e".repeat(64);
const RESULT_DIGEST_2 = "f".repeat(64);

async function initSandbox() {
  const worker = await Worker.init();
  const root = worker.rootAccount;
  const contract = await root.devDeploy(WASM, { method: "new", args: {} });
  const client = await root.devCreateAccount();
  const verifier = await root.devCreateAccount();
  const builder = await root.devCreateAccount();
  const outsider = await root.devCreateAccount();
  return { worker, root, contract, client, verifier, builder, outsider };
}

function parseEvents(txResult) {
  return (txResult.logs || [])
    .filter((line) => line.startsWith("EVENT_JSON:"))
    .map((line) => JSON.parse(line.slice("EVENT_JSON:".length)));
}

function defaultJobArgs(overrides = {}) {
  const now = Date.now();
  return {
    job_id: "pp_00000001",
    title: "CSV invoice normalization",
    spec_digest: SPEC_DIGEST,
    policy_digest: POLICY_DIGEST,
     payout: ONE_NEAR.toString(),
    submit_by_ms: now + 600_000,
    verify_by_ms: now + 1_200_000,
    ...overrides,
  };
}

module.exports = {
  WASM,
  ONE_NEAR,
  RESERVE_YOCTO,
  MIN_DEPOSIT,
  SPEC_DIGEST,
  POLICY_DIGEST,
  ARTIFACT_DIGEST_1,
  ARTIFACT_DIGEST_2,
  RESULT_DIGEST_1,
  RESULT_DIGEST_2,
  initSandbox,
  parseEvents,
  defaultJobArgs,
};

