# ProofPact app/ (S2 controller + server)

Deterministic orchestration, JSON-file store, HTTP API. No framework, no
network calls, no chain calls — LOCAL_SIMULATION. Budgets and guards here are
necessary but not sufficient: the contract enforces money on-chain in Phase 3.

Run: `npm test` (controller suite + receipt selftest), `npm run smoke`
(seed endpoint, needs loopback), `npm run demo:e2e` (full D1 lifecycle over
HTTP, needs loopback). Server state lives in `$DATA_PATH` or
`data/proofpact.json` (gitignored). Tests use a temp dir.

Design notes: controller functions take `now` explicitly (same inputs + same
now = same outputs); the server persists the store before responding success;
all model input is validated as untrusted; local verify emits op
`local-verify` / env `local-sim-1` receipts (INTERFACES §4 clarification) —
the family `interp-1` runner plugs in at integration without route changes.
