<p align="center"><img width="480" alt="ProofPact logo" src="public/logo.png" /></p>

# ProofPact Atlas — Agent Work, Executable Acceptance & NEAR Testnet Settlement

A client funds a bounded task in NEAR escrow (`proofpact.addychief.testnet`). A Builder agent proposes a declarative `csv-xform/1` artifact (`interp-1`, pure `BigInt` decimal arithmetic). A Challenger agent proposes bounded counterexample fixtures. The NEAR contract releases payout **only after recorded verification of the exact active revision** — and rejects premature settlement, stale revisions, and double-settlement (`DOUBLE_SETTLE`).

**ProofPact Atlas** (live at **https://proofpact-atlas.netlify.app**) is the 3D enterprise evidence and settlement console paired with the protocol engine, task-family verifier, fixture-agent harness, and deployed NEAR Testnet escrow contract in this repository.

Tracks: `agents` (Agent Economy), `business` (Autonomous Business), `security` (AI Security & Defense) — NEAR HACKATHON (Nov 1–14, 2026).

---

## Do X, See Y (Zero API Keys Required)

| # | Do | See |
|---|---|---|
| 1 | `npm install && npm run lint && npm run build` | TypeScript check (`tsc --noEmit`) exits `0`; Vite builds the 3D Atlas console into `dist/` |
| 2 | `npm run matrix` | Full acceptance matrix: `D1 PASS`, `D2/D4/D5/D9/D10-app PASS (14/14)`, `R1 PASS`, `S1 PASS`, `D10Checks PASS (27/27)`, `AgentsLoop PASS`, `UISeed PASS (6/6)` |
| 3 | `npm run test:unit` | `14/14` controller lifecycle & guard tests pass + canonical SHA-256 receipt selftest (`f949fea06e317440...`) |
| 4 | `npm run demo:e2e` | Spawns local HTTP server, runs `fund -> artifact -> verify -> settle`, prints `E2E OK: ... PAID exactly once; double-settle rejected (DOUBLE_SETTLE)` |
| 5 | `npm run verify:arcs` | Reference artifact passes all `27/27` CSV fixtures; all 6 seeded defect counterexample arcs (`CSV-01..CSV-06`) print `ARC-OK` |
| 6 | `npm run verify:agents` | Deterministic 10-message `OFFER -> REVIEW_COMPLETE` loop passes; `13/13` malformed/hostile agent outputs end `blocked` with `fake_pass=0` |
| 7 | `npm run dev` (or open https://proofpact-atlas.netlify.app) | 3D Globe console: **Chicago (`pp_demo0001`)** draws a green paid arc (1 NEAR payout `Fk9oqzim...`), **London (`pp_demo0002`)** rises an amber refund beacon (`GDUqKdK1...`), **Singapore (`fixture-sim`)** draws dashed gray (local runner 27/27, no chain settlement) |
| 8 | `near view proofpact.addychief.testnet job_state '{"job_id":"pp_demo0001"}' --networkId testnet` | Returns on-chain state `Paid` (`settled_Out: "1000000000000000000000000"`, `active_rev: 1`) from NEAR Testnet |

---

## Repository Structure

- `src/`, `public/`, `index.html`: **ProofPact Atlas** 3D React + Three.js evidence and settlement viewer ([src/data/operationsData.ts](src/data/operationsData.ts)).
- `contract/`: **NEAR smart contract** (`near-sdk` Rust) implementing `create_job`, `fund_job`, `activate_job`, `submit_artifact`, `record_verification`, `request_payout`, `finalize_payout`, `cancel_job`, `claim_timeout_refund`, and NEP-297 `EVENT_JSON` logs ([contract/src/lib.rs](contract/src/lib.rs), [contract/ERRORS.md](contract/ERRORS.md)).
- `docs/TESTNET.md`: **9 real NEAR Testnet transactions** on `proofpact.addychief.testnet` with NearBlocks explorer links and CLI verification commands ([docs/TESTNET.md](docs/TESTNET.md)).
- `family/`: **Task Family (`csv-xform/1`)** deterministic `interp-1` interpreter (`BigInt` decimal math, 6 allowlisted ops), 27 fixtures, and 6 D10 counterexample arcs ([family/xform.mjs](family/xform.mjs), [family/verify-arcs.mjs](family/verify-arcs.mjs)).
- `agents/`: **Builder / Challenger / Verifier harness** with budget caps and 13 malformed/hostile output blocks ([agents/fixture.mjs](agents/fixture.mjs)).
- `app/` & `receipts/`: **HTTP controller, canonical SHA-256 receipts, and static console** ([app/controller.mjs](app/controller.mjs), [receipts/canonical.mjs](receipts/canonical.mjs), [ui/index.html](ui/index.html)).
- `INTERFACES.md`: Frozen v1.0 protocol specification ([INTERFACES.md](INTERFACES.md)).

---

## What Is Real vs. Simulated (Epistemic Boundaries)

- **Real on NEAR Testnet (`proofpact.addychief.testnet`):** Contract deployment (`4EmrDinm...`), Chicago `pp_demo0001` 6-tx lifecycle ending in a 1 NEAR payout (`Fk9oqzimH1kCd3vZqM4EhS8fkyKz5vDNscCmfdMcy12i`) plus on-chain rejection of a second settlement attempt (`55ADqtRg...`, `DOUBLE_SETTLE`), and London `pp_demo0002` 3-tx lifecycle ending in a 0.11 NEAR refund (`GDUqKdK1J4sBaQDKxgyNiqeBNrHG8ZfY4knC1sSEkmo2`). Full details in [docs/TESTNET.md](docs/TESTNET.md).
- **Real Local Execution:** The `interp-1` CSV task family (`27/27` fixtures, 6 counterexample arcs), the 14 controller lifecycle tests, the 13 hostile-agent blocks, and canonical SHA-256 receipt digests run locally and deterministically with zero network calls.
- **Separated Evidence Layers:** As shown in the Atlas UI (`Separated Evidence Layers`), a SHA-256 digest binds the bytes that were hashed (`TRUSTED_RUNNER` in MVP); on-chain verification records (`pp_demo0001`) and local runner executions (`fixture-sim`) are displayed in distinct layers and never conflated. `scripts/demo-e2e.mjs` uses local HTTP simulation (`sim:` tx prefix) so offline screening needs no keys.

---

## Hackathon Disclosures (Q-005 & Q-015)

- **Two-submission disclosure (Q-015):** The submitter's other independent NEAR Hackathon submission is **Proofgate / Tycoon Ready** (`https://github.com/ciscojrai/tycoon-ready`), an offline conformance and mutation-testing oracle for AI-agent spending policies (`security`, `privacy` tracks).
- **Baseline & AI disclosure (Q-005):** Built during the hackathon window (Nov 2026) with AI coding assistance. Escrow lifecycle design adapted from the team's mission contract prototype; check-runner pattern adapted from the team's Proofgate oracle. No private keys or API keys are committed.
- **License:** MIT ([LICENSE](LICENSE)).
