# ProofPact — Frozen Interfaces v1.0

All harnesses build against this file. It is frozen: no stream changes an
interface unilaterally. Propose changes to the lead (this session) as
`#interface-change`; a bump to v1.1+ re-freezes. UI never blocks: every
interface ships with a fixture path.

Product in one line: a client funds a bounded CSV task; a Builder produces an
artifact; a Challenger proposes runnable counterexamples; a contract pays only
on verified acceptance. Tracks: security primary, agents secondary.

## 0. Layout (monorepo, npm workspaces NOT used — one root package.json)

- `contract/` Rust escrow (near-sdk). Build output: `contract/target/.../proofpact.wasm`.
- `app/` Node server + deterministic controller + runner dispatch. No framework.
- `family/` CSV task family: dialect doc, fixtures, declarative xform + interpreter.
- `agents/` Builder/Challenger system prompts, fixture agents, budget config.
- `ui/` Static console (HTML/CSS/JS, no build step, no keys in browser).
- `receipts/` Shared JSON Schemas + canonical-JSON + digest helpers (Node).
- `docs/` This file, `STREAMS.md`, threat model, decisions.
- `scripts/` Demo/testnet helpers.

IDs: `job_id` = `pp_` + 8 lowercase hex. `msg_id`/`run_id` = `m_`/`r_` + 8 hex.
Candidate revisions are integers starting at 1. All hashes are sha256, 64
lowercase hex. All money is integer yoctoNEAR, serialized as decimal strings
(`U128` style). All timestamps are integer milliseconds.

Canonical JSON (for every digest): UTF-8, object keys sorted byte-wise,
no whitespace, no floats (decimals are strings). `receipts/canonical.mjs`
is the single implementation; every stream imports it, nobody reimplements it.

## 1. Contract (Rust) — extends the proven escrow pattern

Keep the existing escrow's conventions: `LookupMap` storage, NEP-297 events,
buyer/verifier/builder role separation, UPPER_SNAKE panic strings that the UI
shows verbatim, `--cfg near` build so panic strings survive.

States (frozen): `Funded -> Active -> CandidateSubmitted -> VerifiedPass ->
PayoutPending -> Paid`, plus `Active` (after failed verification, rev+1
required), `PayoutFailed` (retryable), `RefundPending -> Refunded`, `Cancelled`.

Methods (frozen signatures; JSON args, yocto strings):
- `new()` init.
- `fund_job(job_id, title, spec_digest, policy_digest, verifier: AccountId, builder: AccountId, payout: U128, submit_by_ms: u64, verify_by_ms: u64)` #[payable] -> JobView. Deposit must cover payout + reserve. Creates `Funded`.
- `activate(job_id)` client only. `Funded -> Active`.
- `submit_candidate(job_id, rev: u32, artifact_digest: String)` builder only. Requires `Active`, `rev == last_rev + 1`. Invalidates any prior verification. -> `CandidateSubmitted`.
- `record_verification(job_id, rev, pass: bool, run_id: String, result_digest: String)` verifier only. Requires `CandidateSubmitted` and `rev == current`. pass -> `VerifiedPass`; fail -> `Active`.
- `request_payout(job_id)` client or builder. Requires `VerifiedPass`, rev match, `now < verify_by_ms`. -> `PayoutPending`, schedules async transfer + private callback.
- `on_payout_complete(job_id)` #[private] callback. Success -> `Paid`; failure -> `PayoutFailed` (safe `retry_payout`, same guards).
- `claim_refund(job_id)` client only. Requires `now >= verify_by_ms` and not `Paid`. -> `RefundPending` -> callback -> `Refunded`. Never both Paid and Refunded.
- `cancel_job(job_id)` client only, before `Paid`. Refunds remainder, closes job.
- `job_state(job_id)` view -> full JobView (job, rev, digests, deadlines, state, verification record or null).

Time rule (frozen, global): an action guarded by deadline D is valid iff
`now_ms < D`, using `env::block_timestamp_ms()`. No `<=` anywhere.

Events (NEP-297, `standard: "proofpact"`, `version: "1.0.0"`, always with
`job_id`): `job_funded`, `job_activated`, `candidate_submitted` (+rev, digest),
`verification_recorded` (+rev, pass, run_id), `payout_requested`,
`payout_confirmed`, `payout_failed`, `refund_claimed`, `refund_confirmed`,
`job_cancelled`.

Errors: UPPER_SNAKE, e.g. `JOB_NOT_FOUND`, `NOT_CLIENT`, `NOT_VERIFIER`,
`NOT_BUILDER`, `BAD_STATE`, `REV_MISMATCH`, `DEADLINE_PASSED`,
`DEPOSIT_TOO_SMALL`, `DOUBLE_SETTLE`. The contract stream MUST write
`contract/ERRORS.md` listing every panic string verbatim — the UI renders them.

## 2. Message protocol (app/) — 9 types, 1 envelope

Envelope (frozen, JSON Schema in `receipts/envelope.schema.json`):
`{proto:"proofpact/1", job_id, msg_id, actor, corr?, type, payload}`.
Actors: `client | builder | challenger | controller | runner | verifier`.
`corr` carries the `msg_id` being answered. Max 64KB per message; oversize is
rejected, never truncated. All model output is untrusted input: schema, size,
and semantic validation before any state change.

Types and required payload fields (frozen):
- `OFFER {title, criteria:[CSV-01..CSV-06], payout_near, deadline_ms}` (client)
- `ACCEPT {job_id, builder}` (controller assigns job_id)
- `ARTIFACT_SUBMITTED {rev, artifact, artifact_digest}` (builder)
- `CHALLENGE {criterion_id, defect, fixture, expected, severity}` (challenger;
  fixture becomes a regression test on confirmation)
- `TEST_REQUEST {rev, fixture_ids[]}` / `TEST_RESULT {rev, pass, results[]}`
  (controller/runner; results mirror §4 runner output)
- `REVISION {rev, artifact, artifact_digest, fixes_challenge}` (builder)
- `DECISION_REQUIRED {reason, options[]}` (controller -> human/UI)
- `REVIEW_COMPLETE {rev, verdict, receipt_ref}` (controller)

Budgets (frozen): max 2 revision rounds, max 40 model requests per job,
15-minute wall clock per job, max 2 concurrent runs. Exhaustion yields
explicit `blocked` states, never fabricated success.

## 3. Artifact: csv-xform/1 (family/)

Envelope (frozen): `{format:"csv-xform/1", ops:[...]}`. Op allowlist (frozen,
semantics owned by family stream in `family/SPEC.md`): `select_columns`,
`rename_columns`, `require_columns`, `parse_decimal`, `reject_rows`,
`emit_invoice`. Unknown op = invalid artifact, rejected before execution.

Limits (frozen): max 5000 rows, 50 cols, 512KB input; decimals as strings,
scale <= 6; UTF-8 CSV per `family/DIALECT.md` (family stream writes it; must
document quoted commas, newlines-in-quotes: yes, escaped quotes: `""`).
`artifact_digest` = sha256 of canonical JSON (§0).

Criterion IDs (frozen, shared by challenger, runner, UI):
CSV-01 quoted commas · CSV-02 required fields · CSV-03 decimal-no-float ·
CSV-04 structured errors · CSV-05 schema-valid output · CSV-06 exec limits.

## 4. Check runner API (family/ + app/)

`runChecks({artifact, fixtures}) -> {pass, results, env_id}` where each result
is `{fixture_id, criterion_id, pass, ms, detail}`. Fixture schema:
`{id, criterion_id, input, expected, severity}`. Same function serves the
controller, the CLI, and regression replay (Proofgate replay pattern: fixtures
in, traces out, compare later).

CLI (frozen): `node family/run.mjs <artifact.json> <fixtures-dir> --out
<results.json>`; exit 0 = pass, 1 = fail, 2 = invalid input. `env_id` values:
`interp-1` (declarative interpreter, the MVP). Additive v1.0 clarification
(lead-signed, non-breaking, no harness action): the controller's
LOCAL_SIMULATION verification records op `local-verify` with env_id
`local-sim-1`; family `interp-1` semantics are unchanged and it plugs in as
the check backend at integration without route changes. If generated
code is ever executed instead of interpreted, the prompt's full OS/container
isolation list applies — out of scope for the MVP; never silently downgrade.

## 5. Receipts (receipts/)

Receipt (frozen): `{run_id, job_id, rev, artifact_digest, spec_digest,
policy_digest, testset_digest, env_id, op, started_at, ended_at, exit,
log_excerpt (<=2KB), refs[]}` + canonical JSON + sha256 `receipt_digest`.
Local event log entries: `{seq, ts, type, payload}` with server-assigned seq.
Trust vocabulary: `TRUSTED_RUNNER` (the only MVP value — the operator runs the
runner; say so in the UI). A digest binds bytes; it never claims execution,
correctness, or confidentiality by itself.

## 6. Modes (frozen labels, recorded on every event)

`model_mode`: `LIVE_MODELS` | `FIXTURE_AGENTS`. `chain_mode`:
`LOCAL_SIMULATION` | `SANDBOX` | `NEAR_TESTNET`. Verification: `TRUSTED_RUNNER`.
Never label an experience LIVE unless every component is live. Fixture mode
works with zero credentials. Live mode makes real model calls. UI renders mode
labels persistently; reload recovers job state from the server, never from
browser-only flags.

## 7. HTTP API (app/) — the UI builds against this + fixtures

JSON, `node:http`, no framework. Frozen routes:
- `POST /api/jobs` {title, payout_near, deadline_ms} -> {job_id, state}
- `GET /api/jobs/:id` -> full state: mode labels, messages, candidate rev,
  check results, escrow state, timeline, receipts
- `POST /api/jobs/:id/artifact` {artifact} -> {rev, artifact_digest}
- `POST /api/jobs/:id/challenge` {challenge} -> {accepted, fixture_id}
- `POST /api/jobs/:id/verify` -> {rev, pass, receipt_ref}
- `POST /api/jobs/:id/settle` -> {state, tx_ref?}
- `GET /api/receipts/:run_id` -> receipt
- `GET /api/demo/seed` -> canned job for offline UI development (UI stream
  never blocks on the backend; integration swaps seed for live)

## 8. Toolchain pins (frozen)

Node >= 24.22.1, npm + lockfile. Rust stable + `wasm32-unknown-unknown`
target + `RUSTFLAGS="--cfg near"` (panic strings must survive; without the
flag every error collapses to `unreachable`). near-sdk 5.7 `legacy`,
near-workspaces ^5, jest ^30 (`testMatch: **/tests/**/*.test.cjs`,
300s timeout). Sandbox binary: already on disk at
`~/.near/sandbox/near-sandbox-2.14.tar.gz` — unpack/swap script lives at
`contract/scripts/setup-sandbox.sh` (adapt, don't invent). UI: static files,
no build step, no secrets in browser.

## 9. Acceptance matrix (the integration gate — nothing merges to main red)

| # | Demo | Command | Must see |
|---|---|---|---|
| D1 | Funded lifecycle pays once | `npm run demo:e2e` | `PAID exactly once`, one payout tx |
| D2 | Premature settlement rejected | `npm run demo:premature` | settle-before-verify rejected, escrow intact |
| D3 | Unauthorized verifier rejected | `npm test -- verify-auth` | `NOT_VERIFIER`, state unchanged |
| D4 | Stale verification dies on new rev | `npm test -- stale-rev` | old verification invalid after rev+1 |
| D5 | No double pay/refund | `npm test -- double-settle` | second settle rejected, balances exact |
| D6 | Failed checks preserve escrow | `npm run demo:failed-checks` | full refund path available, zero paid |
| D7 | Deadline refund, no race | `npm test -- deadline` | refund after expiry; pay+refund impossible |
| D8 | Failed payout retries safely | `npm test -- payout-retry` | failed transfer -> retry -> paid once |
| D9 | Malformed models, budgets | `npm test -- hostile-models` | garbage in -> blocked states, no fake pass |
| D10 | Counterexample -> revision -> pass | `npm run demo:challenge` | defect found, fixed, rerun green |

`npm test` runs every suite; README documents each command with do-X/see-Y.
Never claim a check passed unless executed; report env + exact output.
