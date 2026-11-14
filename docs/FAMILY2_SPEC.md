# Family #2 DRAFT — `return-guard/1`: deterministic return/refund policy checks

Status: DRAFT for human review. Not frozen, not interfaced, not built.
On approval it becomes INTERFACES §10 + `family2/` mirroring `family/`.

## Why: the refund side nobody builds

Every hackathon vault answers "who may spend." Nobody answers "who may
return, for how much, and how often before it is abuse." Refunds are where
real escrow money leaks: sunk freight refunded by mistake, grace periods
gamed as free volatility options, return-cycling to dodge audits.
Family #2 is the CAPTCHA for returns — "are you a legitimate return?" —
with three deterministic answers: AUTO (pass), STEP-UP (prove it), DENY.

## 0. Honest boundary (read first)

Pattern detection needs signals (IPs, addresses, bank matches) that a
deterministic checker cannot fetch. So family #2 splits the job:

- ATTESTORS (carrier, bank, platform) sign evidence: counters and salted
  hashes, never raw PII. The checker sees
  `distinct_ship_addresses_90d: 4`, not four addresses.
- THE CHECKER (`interp-2`) evaluates deterministic predicates over that
  evidence plus the business's committed SOP. Same bytes → same tier,
  no network, no floats, no ML.

Trust label: inputs are oracle-attested, evaluation is deterministic.
The receipt says which attestor signed what; it never claims the
checker verified the real world. This is TRUSTED_RUNNER, extended.

## 1. Inputs

A run takes three JSON documents:

1. `request` — the return: order id, item amounts (decimal STRINGS, same
   no-float grammar as csv-xform/1 §4), currency `/^[A-Z]{3}$/`,
   pay asset + amount (crypto refunds), reason code, ship/bill postal
   hashes (salted, attestor-signed).
2. `history` — attested counters for the account: orders_90d,
   returns_90d, return_rate_bp (basis points, integer), distinct ships,
   distinct billers, dispute_count, first_seen_days_ago. Bounded: the
   attestor sends COUNTERS (≤ 64 keys), never order lists.
3. `policy` — the business's SOP compiled to `sop/1`: fee table
   (outbound freight, return freight, restocking_bps), tier thresholds,
   denomination rule, grace_days. Bound by `policy_digest` at fund time.

SOP portability: the business writes its operating procedure in the
fixed `sop/1` dialect (fee tables + threshold tiers + reason codes).
The policy file IS the integration artifact — same runner, new policy,
zero code. SOPs carry over by copy.

## 2. Evaluation: fees first, then tiers

Step A — fee math (exact, BigInt scaled integers, reuse §4 decimal model):

- `refund = items_total − outbound_freight − return_freight − restock(items_total)`
- `restock = round_half_up(items_total × restocking_bps / 10000, 6)`
- Outbound freight is NON-REFUNDABLE by construction (mobilization:
  once shipped it is sunk). The formula has no term that returns it.
- RG-03 denomination lock: crypto refunds pay the SAME asset and the
  SAME amount received (no dollar-floor, no asset switch). The grace
  period stops being a volatility option: there is no denomination
  to arbitrage, and fees exceed the option value.

Step B — tier assignment (deterministic predicate ladder over counters):

- DENY if: return_rate_bp ≥ sop.deny_rate_bp, or dispute_count ≥
  sop.deny_disputes, or request outside grace_days.
- STEP-UP if: return_rate_bp ≥ sop.review_rate_bp, or distinct_ships
  ≥ sop.review_ships, or amount ≥ sop.review_amount, or first_seen
  < sop.min_account_age_days (prequalification: new accounts start
  small, like new subs start small).
- Else AUTO.

Step-up means: refund settles only after a recorded verifier
attestation (the existing `record_verification` path). The CAPTCHA is
not a picture grid — it is a human/oracle check wired into escrow.

## 3. Decisions are structured (the RG-05 contract)

Every decision is an object, never a bare allow/deny:

```json
{"tier": "auto|step_up|deny", "refund": "<decimal>", "asset": "USD",
 "fees": {"outbound_freight": "<decimal>", "return_freight": "<decimal>",
 "restocking": "<decimal>"}, "reasons": ["RETURN_RATE_4200BP_GT_3000", "..."]}
```

Reason codes are UPPER_SNAKE from a frozen catalog (mirroring
contract/ERRORS.md). A denied builder sees WHICH rule fired.

## 4. Criteria (mirror CSV-01..06)

| ID | Rule | Characteristic break |
|---|---|---|
| RG-01 | Fee-schedule integrity: table valid, currency ISO-4217, bps 0..10000 | negative restocking, `usd` lowercase |
| RG-02 | Outbound freight never refunded; formula exact to the cent | schedule that "refunds freight on late delivery" |
| RG-03 | Denomination lock: same asset+amount, no floor, no switch | dollar-floor refund on a BTC purchase |
| RG-04 | Tier ladder deterministic over counters; thresholds from SOP only | hardcoded threshold ignoring the SOP file |
| RG-05 | Structured decisions: every output has tier+refund+fees+reasons | bare `{"allow": true}` |
| RG-06 | Bounded history: ≤64 counter keys, 90d window; oversize → structured limit error, never silent truncation | 10k-order history dump |

## 5. Fixtures and arcs (mirror §8)

- `family2/fixtures/*.json`: `{id, criterion_id: RG-01..06,
  request, history, policy, expected, severity}` — the $5,000-computer
  gamer is fixture `rg03-crypto-floor-gamer` (expects DENY of the
  floor + STEP-UP on velocity).
- `family2/policies/reference-sop.json` passes all fixtures; each
  `broken-<rg>.json` embodies the criterion's characteristic mistake;
  `verify-arcs.mjs` replays all six arcs (broken fails, reference greens).
- CLI mirrors §4: `node family2/run.mjs <policy.json> <fixtures-dir>
  --out <results.json>`, exits 0/1/2 with the same meanings.
- Interpreter guarantees mirror §7: no eval/network/fs in the check
  core; grep-proof.

## 6. What changes elsewhere (small, frozen-surface-safe)

- INTERFACES §10 (new, additive): `return-guard/1` envelope + RG IDs.
  No change to §1..§9.
- Contract: none. `claim_refund` already refunds `deposited`; the v2
  story is that the CLIENT's refundable amount is computed by family #2
  first and the difference stays as earned fees — enforced by the next
  contract rev, not this spec.
- Verifier prompts gain the step-up attestation shape (S4 follow-up).

## 7. Build plan (on your approval, swarm protocol)

Stream `stream/family2` in a new worktree `proofpact-family2`, same §15
proof bar: reference+broken policies, ≥24 fixtures, arcs green,
receipt selftest, no-float grep. Estimate: one focused agent session —
the runner is a port of the `xform.mjs` shape (validate → interpret → compare), not a new invention.
