# Video script (draft, not recorded)

Target length 60–120 seconds. The timed cut below adds to 90 seconds (8+20+20+14+20+8). No video file exists. Durations are a shooting plan, not a measured recording.

On-screen mode labels must stay visible: model mode `FIXTURE_AGENTS`, chain mode `LOCAL_SIMULATION` or `SANDBOX` for the beat that is actually running. Do not show a `NEAR_TESTNET` or `LIVE_MODELS` label. `app/seed.mjs` sets the seed job to `FIXTURE_AGENTS` and `LOCAL_SIMULATION`.

Do not say the job was paid on NEAR. `scripts/demo-e2e.mjs` settles through the controller, which mints a `sim:` transaction ref.

## Timed cut

### 0:00–0:08 — Title

Say: "ProofPact. A bounded CSV-to-invoice job. The escrow pays a revision only after a recorded check of that revision."

Show: the first paragraph of `README.md`. No test output.

### 0:08–0:28 — D9 malformed output

Say: "Fixture agents. Bad model output is blocked. It is not scored as a pass."

Run, from a checkout of `main`:

```bash
node agents/fixture.mjs --malformed
```

The source prints one `MALFORMED` line per case and then `MALFORMED pass cases=13 blocked=13 fake_pass=0` when every case blocked. Lead merge `84b0196` recorded that outcome, and `agents/fixture.mjs` has no commits after that merge through `d34f6d5`.

TODO: film this command on the publish commit and keep the frame that shows `fake_pass=0`. If the line differs, change the narration to the line on screen.

### 0:28–0:48 — D10 counterexample, then the reference

Say: "A broken artifact fails one criterion fixture. The reference artifact passes that same fixture."

Run:

```bash
node family/verify-arcs.mjs
```

The script prints `ARC-OK` or `ARC-FAIL` per check (`family/verify-arcs.mjs`). Commit `ebf262a` records six arcs and a 27-fixture reference pass. The output is not stored in the tree.

TODO: film a real `ARC-OK` pair for one criterion (broken fails, reference passes). Narrate only the criterion id visible on screen. Do not say "27 of 27" unless that count is in the captured frame.

`npm run demo:challenge` is not a script in `package.json`. Do not run it on camera.

### 0:48–1:02 — D2 premature settlement

Say: "Settle before verification is rejected. The escrow record stays put."

`npm run demo:premature` is not in `package.json`. Run the test that exists:

```bash
node --test --test-name-pattern=premature app/controller.test.mjs
```

TODO: film the pass line from that process. The source description is "premature settlement (D2)" in `app/controller.test.mjs`. If the filter matches nothing, stop and do not invent a pass.

### 1:02–1:22 — D1 and D5, local simulation

Say: "One local simulated payment. The second settle is rejected. The reference on screen starts with sim. This is not a NEAR transfer."

Run (needs loopback):

```bash
npm run demo:e2e
```

On success, `scripts/demo-e2e.mjs` prints `E2E OK:` with `PAID exactly once` and a `sim:` ref, then notes the second settle was rejected.

TODO: film that line. Read the ref aloud only if it is the `sim:` ref in the capture. Do not open a block explorer.

### 1:22–1:30 — Close

Say: "The checker in this demo is the operator's runner. A digest binds bytes. It does not by itself prove who ran the check. No testnet transaction is in this video."

Show: the words `TRUSTED_RUNNER` and `LOCAL_SIMULATION`. Stop. Planned total about 90 seconds.

## §9 rows outside the timed cut

Film these only if the cut is still under 120 seconds after a timed rehearsal. Each one is TODO until its command is captured. Do not add them by voice-over alone.

- D3 unauthorized verifier. Command that exists: `npm test -- verify-auth`. Source expects the panic string `NOT_VERIFIER` (`contract/tests/verify-auth.test.cjs`, `contract/ERRORS.md`). Merge `86fd6e1` records the sandbox suites as verified green. The log is not in the tree. TODO: capture this jest run.
- D4 stale verification. Command: `npm test -- stale-rev`. Source rejects a stale `record_verification` with `REV_MISMATCH` and clears verification on rev 2 (`contract/tests/stale-rev.test.cjs`). TODO: capture this jest run.
- D6 failed check. `npm run demo:failed-checks` is not a script. The assertions on `main` are inside `contract/tests/stale-rev.test.cjs`: state returns to `Active`, and `request_payout` throws `BAD_STATE`. They do not assert `Refunded`. TODO: capture `npm test -- stale-rev` and say only those two outcomes. Do not say "full refund" for this beat.
- D7 deadline refund. Command: `npm test -- deadline`. Source expects `DEADLINE_NOT_PASSED` before expiry, `DEADLINE_PASSED` on a late payout, then `Refunded`, then `DOUBLE_SETTLE` (`contract/tests/deadline.test.cjs`). TODO: capture this jest run before saying those words on camera.
- D8 payout retry. Command: `npm test -- payout-retry`. TODO: capture the run. Say "paid once" only if the capture shows a single successful retry. Sandbox, not testnet.
- D9 controller suite, separate from the fixture agents. Command: `node --test --test-name-pattern=hostile app/controller.test.mjs`. TODO: capture it. The fixture-agent beat above is the one merge `84b0196` recorded.
- D10 controller revision loop, separate from the family arcs. Command: `node --test --test-name-pattern="revision loop" app/controller.test.mjs`. TODO: capture it. A later rev in that suite is not the family interpreter.

## Before publishing

- TODO: rehearse with a timer. Keep the published cut inside 60–120 seconds. If a beat is cut, delete the matching sentence from `docs/X_POSTS.md`.
- TODO: the human re-reads the current event video rules. This draft does not cite a portal URL.
- No chain calls while filming. The contract beats use the local sandbox via jest, not testnet.

## Framing ideas (not yet in the timed cut)

Candidate narration lines. None are filmed; do not say them on camera until a matching beat exists in the cut.

- Simple version: "It's not about the cost of the AI. It's not about a normal product return. It's: prove you actually did the work you were hired to do before you get paid. That's the gap almost every agent payment system still has."
- Subscription vs escrow: "Most people pay AI agents the subscription way: pay upfront, the agent does work (or doesn't), you hope it was good. The money already left. ProofPact is the other model: post a job, money goes into escrow, the agent works and claims done, and only if proof is accepted does the escrow release the money. If proof fails, the money returns to you. Closer to hiring a freelancer with milestone payments than buying a ChatGPT subscription."
- Tight opener: "AI agents can request payment for a job. Almost none of them can prove the work was actually completed before the escrow releases the money."
