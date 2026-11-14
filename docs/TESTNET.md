# ProofPact testnet evidence (Phase 3)

Network: NEAR testnet. No mainnet funds moved.
Runbook: `scripts/testnet-runbook.md`. Each step ran only after human approval in chat.

## Step 0 — accounts (approved: "Create testnet account addychief.testnet with the faucet")

- `addychief.testnet` — faucet-funded, 10 NEAR at creation.
  - Key: `ed25519:CnwtFtkoseQVnfrRq7g7xp4haQ8ekwq7h6anC74pkWts`
  - Creds: `~/.near-credentials/testnet/addychief.testnet.json` (mode 600)
- `proofpact.addychief.testnet` — subaccount, funded 5 NEAR by `addychief.testnet`.
  - Creation tx: `Ex9fjr45nryQ1T4w2oLLD8thzsKnyeRpaLCmZ3aFLQoi`
  - Explorer: https://testnet.nearblocks.io/txns/Ex9fjr45nryQ1T4w2oLLD8thzsKnyeRpaLCmZ3aFLQoi
  - Creds: `~/.near-credentials/testnet/proofpact.addychief.testnet.json` (mode 600)

Verify: `near state addychief.testnet --networkId testnet`

## Step 1 — deploy (approved: "deploy to proofpact.addychief.testnet")

- Wasm: `contract/target/wasm32-unknown-unknown/release/proofpact.wasm`
  - Size: 166104 bytes; sha256 `e15a2a1620580c36ce0f35724fe781dd04aa4d8f7dd62d9baaae21ad122f0d36`
  - `npm run build:contract` reproduced the identical bytes (rebuild was a no-op, hash matched).
- Deploy tx: `4EmrDinmzKHM6R6sSgAZLT17uagbV87jTX2JARiBEXkq`
  - Explorer: https://testnet.nearblocks.io/txns/4EmrDinmzKHM6R6sSgAZLT17uagbV87jTX2JARiBEXkq
  - Init: `new` with `{}` — exit 0, "Done deploying and initializing proofpact.addychief.testnet".
- On-chain verification (`near state proofpact.addychief.testnet`):
  - `code_hash`: `GAgUV2bLioP1qK5g7CRi7PuzAcmcP4MXS7x4WspXdfm7` (was `1111…` before deploy)
  - `storage_usage`: 166336; balance ≈ 4.9986 NEAR.

Note: `near deploy` on CLI 4.0.13 requires the wasm path BOTH as positional
`<wasm-file>` and as `--wasmFile`; the runbook snippet shows only the flag form.
Exact command used:

```bash
cd /Users/ciscomacbook/Projects/proofpact-lead
near deploy proofpact.addychief.testnet \
  contract/target/wasm32-unknown-unknown/release/proofpact.wasm \
  --wasmFile contract/target/wasm32-unknown-unknown/release/proofpact.wasm \
  --initFunction new --initArgs '{}' --networkId testnet
```

## Step 2 — fund one job (approved: "go steps 2+3")

Job `pp_demo0001`, "Testnet demo invoice run". Single actor `addychief.testnet`
as client/verifier/builder (role separation already proven on sandbox D3).
Payout 1 NEAR (`1000000000000000000000000` yocto), deposit 1.01 NEAR.
Real digests: spec = sha256(wasm) `e15a2a16…`, policy = sha256(INTERFACES.md)
`8976d1a6…`, submit_by 1794599680758, verify_by 1794603280758.

- Fund tx: `3zgY5PxuVb9V19QsjQQMMg5EweeLtMU5U9yZcCjG8Lze` → state `Funded`, `job_funded` event.
  - Explorer: https://testnet.nearblocks.io/txns/3zgY5PxuVb9V19QsjQQMMg5EweeLtMU5U9yZcCjG8Lze

## Step 3 — lifecycle + payout (approved: "go steps 2+3")

| Call | Tx | Explorer | Result |
|---|---|---|---|
| `activate` | `2GKwuoS3JxU1ctbeJKkbFoLpPmerSz8bxoscfuHsCnQq` | [link](https://testnet.nearblocks.io/txns/2GKwuoS3JxU1ctbeJKkbFoLpPmerSz8bxoscfuHsCnQq) | `Active`, `job_activated` (hash backfilled via Nearblocks API, confirmed by tx-status) |
| `submit_candidate` rev 1 (`c5fbb23b…` = sha256 of `receipts/fixture-run.json`) | `3JPARgMoinPfwgEa53esmqznvgMzwy9ZVJekDYySbhKZ` | [link](https://testnet.nearblocks.io/txns/3JPARgMoinPfwgEa53esmqznvgMzwy9ZVJekDYySbhKZ) | `CandidateSubmitted`, `candidate_submitted` |
| `record_verification` pass=true, run `testnet-run-1`, result `f949fea0…` (golden receipt) | `XwsXKNqpSQApZqHhihrWotzETvEbm1uQEjx3k2gfYqc` | [link](https://testnet.nearblocks.io/txns/XwsXKNqpSQApZqHhihrWotzETvEbm1uQEjx3k2gfYqc) | `VerifiedPass`, `verification_recorded` |
| `request_payout` | `Fk9oqzimH1kCd3vZqM4EhS8fkyKz5vDNscCmfdMcy12i` | [link](https://testnet.nearblocks.io/txns/Fk9oqzimH1kCd3vZqM4EhS8fkyKz5vDNscCmfdMcy12i) | `payout_requested` → `payout_confirmed` |

Verifications (all green):
1. `near view … job_state` → `state: 'Paid'`, rev 1, verification pass=true.
2. Exactly one 1-NEAR transfer: contract balance `4.998623169268336` → `5.008623169268336`
   (delta exactly +0.01 = +1.01 deposit − 1.0 payout; contract pays no gas).
3. Double-settle rejected on-chain: second `request_payout` →
   `Smart contract panicked: DOUBLE_SETTLE` (tx `55ADqtRgSLpmjnD5k7E6dFX64wDZLSAybbJ14JmUbMZA`).

## Step 4 — refund drill (approved: "go step 4")

Separate job `pp_demo0002`, "Testnet refund drill". Payout 0.1 NEAR, deposit 0.11.
submit_by = fund+60s, verify_by = fund+120s (1794596564452). No candidate submitted.

| Call | Tx | Explorer | Result |
|---|---|---|---|
| `fund_job` | `BqJ7M135JMc6thoo65p35jCPTSovLnoMQdoohA8FMwtc` | [link](https://testnet.nearblocks.io/txns/BqJ7M135JMc6thoo65p35jCPTSovLnoMQdoohA8FMwtc) | `Funded`, `job_funded` |
| `activate` | `6k1U5Ex7qPgkzr9bfZSpTMqZtQf4sS9tgQXYbf1SyLkz` | [link](https://testnet.nearblocks.io/txns/6k1U5Ex7qPgkzr9bfZSpTMqZtQf4sS9tgQXYbf1SyLkz) | `Active`, `job_activated` |
| `claim_refund` (30s past expiry) | `GDUqKdK1J4sBaQDKxgyNiqeBNrHG8ZfY4knC1sSEkmo2` | [link](https://testnet.nearblocks.io/txns/GDUqKdK1J4sBaQDKxgyNiqeBNrHG8ZfY4knC1sSEkmo2) | `refund_claimed` → `refund_confirmed` |

Verifications (all green):
1. `near view … job_state` → `state: 'Refunded'`.
2. Full remainder returned: contract balance `5.008623169268336` before the drill
   and exactly `5.008623169268336` after (+0.11 deposit − 0.11 refund; code refunds
   full `deposited`, lib.rs:372).
3. Payout path dead: `request_payout` on the refunded job →
   `Smart contract panicked: DOUBLE_SETTLE` (the Refunded-state guard fires before
   the deadline check — stronger property than the predicted DEADLINE_PASSED).
