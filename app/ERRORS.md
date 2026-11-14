# ProofPact app error catalog (S2 — mirrors contract/ERRORS.md convention)

Every code below is stable: the UI renders these verbatim on fail cards.
HTTP mapping: 400 validation, 404 missing, 409 state/budget conflicts.

| Code | Meaning | HTTP |
|---|---|---|
| JOB_NOT_FOUND | unknown job_id | 404 |
| RECEIPT_NOT_FOUND | unknown run_id | 404 |
| BAD_TITLE | title missing/empty | 400 |
| BAD_PAYOUT | payout_near not a positive decimal string | 400 |
| BAD_DEADLINE | deadline_ms not a future integer ms | 400 |
| INVALID_ARTIFACT | artifact not `{format:'csv-xform/1', ops:[...]}` | 400 |
| UNKNOWN_OP | op outside the frozen allowlist | 400 |
| DIGEST_MISMATCH | stored artifact digest does not recompute | 400 |
| BAD_CRITERION | criterion_id outside CSV-01..CSV-06 | 400 |
| BAD_SEVERITY | severity outside low/medium/high/critical | 400 |
| BAD_CHALLENGE | defect/fixture missing or malformed | 400 |
| FIXTURE_TOO_LARGE | fixture JSON over 16KB | 400 |
| INVALID_ENVELOPE | envelope fails proto/shape checks | 400 |
| MESSAGE_TOO_LARGE | message JSON over 64KB | 400 |
| BODY_TOO_LARGE | HTTP body over 128KB | 413 |
| BAD_STATE | transition not allowed from current state | 409 |
| STALE_VERIFICATION | verification does not bind current rev | 409 |
| DOUBLE_SETTLE | settle called on an already-settled job | 409 |
| DEADLINE_PASSED | settle after deadline (refund path instead) | 409 |
| BUDGET_REVISIONS | rev would exceed initial + 2 revisions | 409 |
| BUDGET_REQUESTS | job would exceed 40 model requests | 409 |
| BUDGET_WALLCLOCK | job older than 15 minutes | 409 |
