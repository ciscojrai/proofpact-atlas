# ProofPact — Stream briefs (build these in parallel)

Each stream works ONLY on its branch (`stream/<name>`) and merges to `main`
through the lead after its done-when commands pass. Read `INTERFACES.md`
first — it is frozen. Never print secrets, never commit `.env`, never invent
endpoints, methods, or model names. Verify against official docs.

## S1 contract — DeepSeek harness — branch `stream/contract`

Goal: Rust escrow implementing INTERFACES §1 exactly.
Reads: INTERFACES §0/§1/§8/§9; baseline
`/Users/ciscomacbook/Projects/private-code-review/mission/contracts/src/lib.rs`
(425 lines: missions, allowlist, caps, replay lock, NEP-297 events — extend,
don't rewrite); test pattern in `mission/tests/mission.test.cjs`.
Writes: `contract/src/lib.rs`, `contract/Cargo.toml` (near-sdk 5.7 legacy),
`contract/ERRORS.md` (every panic string verbatim — UI depends on it),
`contract/tests/*.test.cjs` (D3/D4/D5/D7/D8 at minimum),
`contract/scripts/setup-sandbox.sh` (adapt from the baseline; the 2.14
tarball is already at `~/.near/sandbox/near-sandbox-2.14.tar.gz`).
Task zero: install the `wasm32-unknown-unknown` target (this machine's
Homebrew Rust lacks it; use rustup) and prove
`RUSTFLAGS="--cfg near" cargo build --release --target wasm32-unknown-unknown`
emits the wasm. Without `--cfg near`, panic strings collapse — the build
script must pin the flag.
Done-when: wasm builds; contract tests pass on sandbox 2.14; every §1 method
and event exists with frozen names; ERRORS.md complete.
Out of scope: UI, agents, fixtures beyond 3 smoke CSVs.

## S2 controller — this session — branch `stream/controller`

Goal: deterministic orchestration + HTTP API per INTERFACES §2/§7.
Reads: INTERFACES §0/§2/§7/§9; baseline server pattern in
`private-code-review/server.mjs` (node:http, no framework).
Writes: `app/server.mjs`, `app/controller.mjs` (transitions, budgets, blocked
states), `app/store.mjs` (JSON-file event log, server-assigned seq),
`GET /api/demo/seed` fixture endpoint (UI's offline backend — ship first).
Done-when: all §7 routes respond; budgets enforced (2 revs, 40 reqs, 15 min);
malformed model JSON yields blocked states (feeds D9).
Out of scope: real chain calls (LOCAL_SIMULATION + SANDBOX adapters only;
testnet wiring lands at integration).

## S3 family — Muse spawn — branch `stream/family`

Goal: the CSV→invoice task family per INTERFACES §3/§4.
Reads: INTERFACES §0/§3/§4; replay pattern in
`/Users/ciscomacbook/Downloads/proofgate/adapters/replay.mjs` (fixtures in,
traces out — 7 lines, mirror the shape, not the domain).
Writes: `family/DIALECT.md` (quoted commas, embedded newlines, `""` escapes,
limits), `family/SPEC.md` (the 6 frozen ops, exact semantics),
`family/xform.mjs` (validator + `interp-1` interpreter),
`family/run.mjs` CLI (frozen exit codes 0/1/2), `family/fixtures/` (>=20:
happy paths + one per criterion + adversarial: float-money trap, lookalike
columns, BOM/whitespace, 5001-row over-limit).
Done-when: CLI passes its own fixtures; every CSV-01..06 has a failing
fixture that a fixed artifact turns green (feeds D10).
Out of scope: generated-code execution (interpreter only, per freeze).

## S4 agents — SuperGrok — branch `stream/agents`

Goal: Builder + Challenger sessions per INTERFACES §2, live and fixture.
Reads: INTERFACES §0/§2/§3 (criterion IDs, budgets, envelope); baseline TEE
worker in `private-code-review/mission/server/near-inference.mjs` (pattern
for real model calls; fixture mode must need zero credentials).
Writes: `agents/builder.prompt.md`, `agents/challenger.prompt.md` (frozen
roles: builder minimizes to the contract, challenger outputs criterion_id +
defect + bounded fixture + expected + severity — never commands or rule
edits), `agents/fixture.mjs` (scripted builder/challenger producing valid
envelopes, including one MALFORMED mode for D9), `agents/budgets.json`
(frozen numbers from §2).
Done-when: fixture agents run a full OFFER→REVIEW_COMPLETE loop against S2's
schemas with zero network; malformed mode yields blocked states, never a
fake pass.
Out of scope: model choice beyond NEAR AI Cloud compat; any chain calls.

## S5 ui — Google Antigravity 2.0 + /teamwork — branch `stream/ui`

Goal: financial console per INTERFACES §7 + prompt §10, static only.
Reads: INTERFACES §6/§7 (routes, mode labels, trust vocabulary);
`contract/ERRORS.md` once S1 lands (panic strings render verbatim on fail
cards); `GET /api/demo/seed` as your backend until integration.
Writes: `ui/index.html`, `ui/app.js`, `ui/styles.css`. Panels: objective +
criteria + payout + deadline; Builder/Challenger message feeds (structured
summaries, never hidden chain-of-thought); candidate rev + check results;
escrow state + actors; event timeline + receipt inspector; tx links;
persistent mode/trust labels. Distinct visuals for failed verification,
rejected auth, pending tx, failed transfer, confirmed payment. Keyboard
access, contrast, reduced-motion, responsive.
Done-when: renders fully against the seed endpoint with zero backend; every
state in §9's matrix has a distinct screen.
Out of scope: any build step, any secret in browser, any chain library.

## S6 receipts — this session — branch `stream/receipts`

Goal: shared crypto/evidence plumbing per INTERFACES §0/§5.
Reads: INTERFACES §0/§5; baseline receipt builder in
`private-code-review/mission/server/attestation.mjs` (adapt shapes, keep the
honest trust wording: digests bind bytes, prove nothing alone).
Writes: `receipts/canonical.mjs` (THE canonicalizer — all streams import),
`receipts/receipt.mjs` (build/verify), `receipts/envelope.schema.json`,
`receipts/receipt.schema.json`, `receipts/fixture-run.json` (golden vector).
Done-when: golden vector verifies byte-identically on re-run; malformed
inputs rejected with named errors.
Out of scope: chain anchoring (a Phase-3 option, not MVP).

## Merge protocol (all streams)

`main` stays green: fixture E2E (`LOCAL_SIMULATION` + `FIXTURE_AGENTS`) must
pass after every merge. Merge only through the lead with: files changed,
checks executed + exact output, and remaining risks. Report in the prompt's
§15 format. Interface change? File `#interface-change` — never freelance it.
Testnet deployment needs explicit human approval with exact parameters.
