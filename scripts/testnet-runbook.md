# ProofPact testnet runbook (Phase 3 — DRAFT, needs human approval per step)

Target: NEAR testnet only. No mainnet funds move until the submission's
payout address is registered — and that address is supplied by the human at
submit time, never created here.

## Gate 0 — prerequisites (all must be true)

- [ ] `main` green: `npm run matrix` shows D3/D7/D8 PASS (contract merged)
- [ ] `near` CLI installed and `~/.near-credentials/testnet/<you>.testnet` exists
- [ ] Testnet account funded (faucet or transfer — a few NEAR is plenty)
- [ ] Human approves each numbered step with exact parameters in chat first

## Step 1 — deploy (human approves account ID + init args)

```bash
cd /Users/ciscomacbook/Projects/proofpact-lead
npm run build:contract   # must print the same wasm already tested on sandbox
near deploy <contract.testnet> \
  --wasmFile contract/target/wasm32-unknown-unknown/release/proofpact.wasm \
  --initFunction new --initArgs '{}' --networkId testnet
```

Record: contract account, deploy tx hash, explorer link.

## Step 2 — fund one job (human approves amount)

```bash
near call <contract.testnet> fund_job '{
  "job_id": "pp_demo0001", "title": "Testnet demo invoice run",
  "spec_digest": "<64hex>", "policy_digest": "<64hex>",
  "verifier": "<you>.testnet", "builder": "<agent>.testnet",
  "payout": "<yocto>", "submit_by_ms": <ms>, "verify_by_ms": <ms>
}' --accountId <you>.testnet --amount <payout+0.01> --networkId testnet
```

## Step 3 — run the lifecycle off-chain, settle on-chain

Drive the funded job through the app (artifact → challenge → verify), then
`submit_candidate`, `record_verification`, and `request_payout` as the
authorized actors. Expect exactly one `payout_confirmed` event and exactly
one transfer. Capture every tx hash + explorer link into `docs/TESTNET.md`.

## Step 4 — refund drill (separate job, past deadline)

Fund a second job with a short `verify_by_ms`, let it expire, `claim_refund`,
verify full remainder returns and no payout path stays open.

## Abort / rollback

- Any unexpected `BAD_STATE`, double-settle, or short refund: STOP, paste the
  tx hash + receipt chain in chat, do not retry blindly.
- Testnet state is disposable: redeploy with a new job_id series and rerun.
- Never reuse testnet keys, accounts, or job IDs on mainnet.
