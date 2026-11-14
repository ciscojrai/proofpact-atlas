# Submission description (draft)

Draft only. Not submitted. Written against `main` `d34f6d5` on branch `stream/agents`, with a testnet addendum whose evidence file (`docs/TESTNET.md`) is committed in the same tree as this draft. Do not paste the held section into the form.

The paste-ready block is ASCII. Its length is JavaScript `String.length` of the fenced text, with no surrounding newline. Limit: 2000. The count under the fence is that measurement.

## Paste-ready description

```text
ProofPact is a bounded CSV-to-invoice job. A Builder proposes a csv-xform/1 artifact. A Challenger proposes one bounded counterexample. The escrow is written to pay a candidate revision only after a recorded verification of that revision.

The repository contains the ProofPact Atlas 3D React/Three.js settlement console (live at https://proofpact-atlas.netlify.app), the Rust escrow contract (contract/), the Node HTTP controller and static console (app/, ui/), the interp-1 CSV interpreter with 27 fixtures and 6 counterexample arcs (family/), fixture agents (agents/), and canonical SHA-256 receipt hashing (receipts/). HTTP settlement in scripts/demo-e2e.mjs is local simulation (sim: tx prefix) so offline screening requires no keys. Testnet evidence is in docs/TESTNET.md: escrow proofpact.addychief.testnet recorded 9 NEAR testnet transactions, paying 1 NEAR on Chicago pp_demo0001 (payout tx Fk9oqzimH1kCd3vZqM4EhS8fkyKz5vDNscCmfdMcy12i), rejecting a duplicate settlement (DOUBLE_SETTLE), and refunding London pp_demo0002 in full (tx GDUqKdK1J4sBaQDKxgyNiqeBNrHG8ZfY4knC1sSEkmo2). There is no live model call.

Lead merge 84b0196 accepts the fixture loop: ten messages from OFFER through REVIEW_COMPLETE, and 13 malformed or over-budget cases end blocked with no passing review. Merge 86fd6e1 records the sandbox contract suites for demos D1-D8 as verified green. Commit ebf262a, merged in d2083fb, records the reference artifact passing the 27 fixtures and six criterion arcs. This text cites those commit records. It does not attach a new test log.

A sha256 digest binds the bytes that were hashed. It does not by itself prove who ran the check. The MVP trust label in INTERFACES.md is TRUSTED_RUNNER.

License: MIT. The README baseline note says the escrow design is adapted from the team's private-code-review mission contract, the check-runner pattern from the team's Proofgate oracle, and receipt helpers from the team's NEAR AI Cloud worker. No keys are committed.

Not in this commit, and not claimed here: a public repository URL, a team contact, a payout address, and a recorded video.
```

Character count: 1789 (`String.length` of the fenced text; the newline that ends the fence is not included). A copied trailing newline would make 1790. Both are under 2000. Do not paste the held section.

## What this text is allowed to rely on

- Product sentence: `INTERFACES.md` opening and §3 (`csv-xform/1`).
- Tree contents at `d34f6d5`: `contract/`, `app/`, `family/` (27 files matching `family/fixtures/*.json`), `agents/`, `receipts/`. `git ls-files ui` is empty. `git remote -v` prints nothing.
- `sim:` prefix: `app/controller.mjs` mints `sim:tx_` and `app/controller.test.mjs` matches that shape. `scripts/demo-e2e.mjs` settles through that controller.
- Fixture agents and no network: `agents/fixture.mjs` has no network client. `agents/fixture.mjs` is unchanged from merge `84b0196` through `d34f6d5` (`git log 84b0196..d34f6d5 -- agents/fixture.mjs` is empty). The lead accepted that merge and recorded a 10-message loop, 13/13 malformed cases blocked, and zero network.
- Budgets on `main`, as file contents, not as a fresh run: `agents/budgets.json` is `max_revision_rounds` 2, `max_model_requests` 40, `wall_clock_ms` 900000, `max_concurrent_runs` 2, `max_message_bytes` 65536.
- Contract record: commit subject of `86fd6e1` is "escrow + sandbox suites D1-D8 (verified green)". The jest log is not stored in the tree.
- Family record: commit message of `ebf262a` (merged as `d2083fb`) says the reference artifact is 27/27 green and names six arcs. The command output is not stored in the tree.
- Trust sentence: `INTERFACES.md` §5.
- Baseline sentence: `README.md`.
- License: `LICENSE` is MIT. The copyright line names Francisco J. Pellerano Jr. Confirm that name before typing it into a form. This draft does not add an email.
- Testnet: `docs/TESTNET.md` in this tree records the deploy, payout, double-settle rejection, and refund tx hashes with explorer links. Spot check: `near view proofpact.addychief.testnet job_state '{"job_id":"pp_demo0001"}' --networkId testnet` shows `state: 'Paid'`.

## Held lines (do not paste)

Each line is unverified as a result. The check is the thing that would verify it.

- TODO: a fresh matrix log. Check: `npm run matrix` on a checkout of `d34f6d5` or later `main`. `scripts/matrix.mjs` exits 0 when nothing fails; a pending row is not a pass.
- TODO: sandbox jest output for D3, D4, D6, D7, D8. Check: `npm test -- verify-auth`, `npm test -- stale-rev`, `npm test -- deadline`, `npm test -- payout-retry`. `npm test` with arguments runs jest only (`package.json`). D6 assertions that exist in source are in `contract/tests/stale-rev.test.cjs`: failed verification returns to `Active`, and `request_payout` throws `BAD_STATE`. That file does not assert a refund.
- TODO: `npm run demo:premature`, `npm run demo:failed-checks`, and `npm run demo:challenge`. Those names are in `INTERFACES.md` §9 and are absent from `package.json` scripts. Do not claim they run.
- TODO: family arc output. Check: `node family/verify-arcs.mjs` and `node family/run.mjs family/artifacts/reference.json family/fixtures --out /tmp/pp-family.json` (exit 0, 1, or 2 per `INTERFACES.md` §4).
- TODO: receipt selftest output. Check: `node receipts/canonical.mjs --selftest`. Do not quote `receipts/fixture-run.json` field `log_excerpt` ("20 fixtures, 20 pass") as a family result. The family tree has 27 fixture files.
- TODO: HTTP demo output. Check: `npm run demo:e2e` (needs loopback). On success the source prints a line that starts `E2E OK:` and includes a `sim:` ref. That is not a NEAR transfer.
- TODO: seed smoke. Check: `npm run smoke` (needs loopback).
- TODO: UI. No `ui/` files on `d34f6d5`. Check after a UI merge: `git ls-files ui` and a render against `GET /api/demo/seed`.
- RESOLVED: testnet. `docs/TESTNET.md` records deploy tx `4EmrDinmzKHM6R6sSgAZLT17uagbV87jTX2JARiBEXkq`, payout tx `Fk9oqzimH1kCd3vZqM4EhS8fkyKz5vDNscCmfdMcy12i`, refund tx `GDUqKdK1J4sBaQDKxgyNiqeBNrHG8ZfY4knC1sSEkmo2`, each with its explorer page. Each runbook step ran only after human approval in chat.
- TODO: live models. No agent client on `main` places a model call. Check: a recorded `LIVE_MODELS` run with a named model from a doc that exists at that time. Do not name a model here.
- TODO: public repository URL, submission email, and payout address. They are not in the repo. The human supplies them. Mainnet payout address stays separate from any testnet account.
- TODO: official form rules still match this draft (2000-character description, video length, required tags). Check: the human re-reads the current event instructions before submit. This draft does not cite a portal URL.
