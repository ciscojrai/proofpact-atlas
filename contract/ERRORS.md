# ProofPact — Contract Panic Strings (verbatim)

The UI renders these strings verbatim on failure cards. This file is the
single source of truth the UI stream reads. Every `require!` / `panic_str`
in `contract/src/lib.rs` is listed below, byte-for-byte.

| Panic string | Meaning | Raised by |
|---|---|---|
| `JOB_NOT_FOUND` | `job_id` does not exist in storage | `get_job` (every method) |
| `JOB_ID_TAKEN` | duplicate `job_id` on `fund_job` | `fund_job` |
| `DIGEST_MUST_BE_SHA256_HEX` | a digest arg is not 64 lowercase hex | `fund_job`, `submit_candidate`, `record_verification` |
| `PAYOUT_MUST_BE_POSITIVE` | `payout` is zero | `fund_job` |
| `DEPOSIT_TOO_SMALL` | deposit < payout + reserve | `fund_job` |
| `NOT_CLIENT` | caller is not the client | `activate`, `claim_refund`, `cancel_job` |
| `NOT_VERIFIER` | caller is not the verifier | `record_verification` |
| `NOT_BUILDER` | caller is not the builder | `submit_candidate` |
| `NOT_AUTHORIZED` | caller is neither client nor builder | `request_payout`, `retry_payout` |
| `BAD_STATE` | state does not allow this transition | every mutating method |
| `REV_MISMATCH` | `rev` is not the expected revision | `submit_candidate`, `record_verification`, `request_payout`, `retry_payout` |
| `NO_VERIFICATION` | expected verification record is missing | `request_payout`, `retry_payout` (defensive) |
| `DEADLINE_PASSED` | `now >= deadline` for an action valid only before it | `submit_candidate`, `request_payout`, `retry_payout` |
| `DEADLINE_NOT_PASSED` | `now < verify_by_ms` when a refund requires the deadline to have passed | `claim_refund` |
| `DOUBLE_SETTLE` | attempting to pay/refund/cancel an already `Paid` or `Refunded` job | `request_payout`, `retry_payout`, `claim_refund`, `cancel_job` |

## Time rule

Every deadline guard uses `env::block_timestamp_ms()`:
- valid-before (`submit_candidate`, `request_payout`, `retry_payout`): `now < deadline_ms` (strict, no `<=`).
- valid-after (`claim_refund`): `now >= verify_by_ms`.

## Reserve

`RESERVE_YOCTO = 10_000_000_000_000_000_000_000` (0.01 NEAR). `fund_job`
requires `deposit >= payout + RESERVE_YOCTO`; the reserve stays in the
contract to cover transfer gas, and is returned to the client on refund/cancel.
