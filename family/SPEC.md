# `csv-xform/1` specification — validator + `interp-1` interpreter

Owner: family stream (S3). The envelope, op allowlist, limits, criterion
IDs, and CLI shape are frozen by INTERFACES §3/§4; this file owns the exact
semantics. CSV bytes are governed by [DIALECT.md](DIALECT.md).

## 0. Envelope and static validation

An artifact is JSON with exactly two keys: `{format: "csv-xform/1",
ops: [...]}` (extra top-level keys → `INVALID_ARTIFACT`).

Static validation (runs before any fixture executes; any violation is
`INVALID_ARTIFACT` and aborts the whole run — CLI exit 2):

- `format` MUST be exactly `csv-xform/1`.
- `ops` MUST be an array of 1..32 entries.
- Every entry MUST be an object with `op` naming one of the 6 frozen ops.
  Unknown op → `INVALID_ARTIFACT` ("unknown op"). Unknown per-op params →
  `INVALID_ARTIFACT` (strict keys catch builder typos like `column`).
- Column lists (`require_columns.columns`, `select_columns.columns`,
  `parse_decimal.columns`): arrays of 1..50 non-empty strings.
- `select_columns.columns` MUST NOT contain duplicates.
- `parse_decimal.scale`: integer 0..6, default 6.
- `reject_rows`: exactly one of `equals` (string) / `matches` (string).
  `matches` MUST compile with `new RegExp(src)` and be ≤ 200 chars.
- `rename_columns.mapping`: object with 1..50 entries, all keys/values
  non-empty strings.
- `emit_invoice`: `id_column`, `customer_column`, `item_column`,
  `qty_column`, `unit_price_column` non-empty strings; `currency` (default
  `"USD"`) MUST match `/^[A-Z]{3}$/`.
- The artifact travels inside §2 messages, so the 64 KB message cap applies
  to it in transit (the interpreter itself imposes no artifact byte cap).

## 1. Execution model

`interpret(artifact, csvText)`:

1. Parse `csvText` per DIALECT.md into a header + data table (all cells are
   strings). Parse-stage failures raise `op: "parse"` errors (§3).
2. Apply `ops` in order. Each op reads and replaces the working table.
3. The last op SHOULD be `emit_invoice`; whatever the last op returns is
   the result. A pipeline not ending in `emit_invoice` returns the working
   table as `{columns, rows}` — valid, but no fixture expects it (every
   reference fixture ends in an invoice).

Determinism: same artifact + same bytes → same result, except `ms`
timings. No clocks, no randomness, no floats anywhere (all decimal math is
`BigInt` scaled integers; see §4).

Row numbers in errors: header is row 0, data records 1..N (§4 DIALECT.md).

## 2. Op semantics

### `require_columns {columns}`

Raises `MISSING_COLUMN` listing EVERY missing name (in the order given in
`columns`) if any is absent from the working table. Otherwise a no-op.
This is the CSV-02 mechanism: declare the contract up front so a missing
field fails here with the full list, not later one op at a time.

### `parse_decimal {columns, scale=6}`

For each listed column (missing → `MISSING_COLUMN`), for each data row in
order (first bad cell wins): trim ASCII spaces/tabs, then require
`/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/` with at most `scale` fraction digits.
Violation → `BAD_DECIMAL {row, column, value}` (`value` = the raw cell).
Empty-after-trim, `+`, hex, exponents, and `NaN`/`Infinity` are all
`BAD_DECIMAL` — the ONLY accepted shape is an optional `-` with digits.

On success the cell is REPLACED by its normalized form (§4), so downstream
ops (`reject_rows`, `emit_invoice`) see normalized text.

### `reject_rows {column, equals|matches}`

Drops every data row whose cell in `column` satisfies the predicate.
Missing column → `MISSING_COLUMN`.

- `equals`: exact string equality against the CURRENT cell text
  (post-`parse_decimal` normalization if that op already ran — so after
  parsing, `equals: "0"` drops `0`, `0.0`, and `-0` alike).
- `matches`: `new RegExp(pattern).test(cell)`, unanchored substring match,
  no flags. To anchor, the artifact writes `^...$`.

### `select_columns {columns}`

Replaces the working table with exactly the listed columns, in the listed
order. Missing → `MISSING_COLUMN` (all missing, listed in order).

### `rename_columns {mapping}`

Renames each key of `mapping` to its value (identity `a→a` is a no-op).
Missing source → `MISSING_COLUMN`. A target colliding with a surviving
column or another target → `COLUMN_COLLISION {column}`.

### `emit_invoice {id_column, customer_column, item_column, qty_column, unit_price_column, currency="USD"}`

Missing columns → `MISSING_COLUMN` (checked in the parameter order above).

- All rows MUST share one `id_column` value, else `MIXED_INVOICE_ID
  {row, expected, found}` (`row` = first row differing from row 1).
  `customer` is first-row-wins (not enforced equal).
- `qty`/`unit_price` cells are re-validated as decimals (scale ≤ 6, same
  grammar as §`parse_decimal`): violation → `NUMERIC_ERROR {row, column,
  value}`. This exists so a pipeline that SKIPPED `parse_decimal` still
  fails structurally — but with a different code+op, which is exactly what
  the CSV-04 arc fixture pins (early precise error vs late vague one).
- `line_total = round_half_up(qty × unit_price, 6)` on the EXACT product,
  then normalized. `total` = exact sum of the ROUNDED line totals,
  normalized. Half-up = half away from zero (§4).
- Output (format `invoice/1`, the CSV-05 contract):

```json
{
  "format": "invoice/1",
  "invoice_id": "<non-empty string>",
  "customer": "<string>",
  "currency": "USD",
  "lines": [{"item": "<string>", "qty": "<decimal>", "unit_price": "<decimal>", "line_total": "<decimal>"}],
  "line_count": 2,
  "total": "<decimal>"
}
```

- Zero data rows → valid empty invoice (`lines: []`, `line_count: 0`,
  `total: "0"`). `invoice_id`/`customer` then come from... there is no
  first row: they are `""`. (Empty invoices carry no identity; the runner
  still checks the shape.)
- The emitted object is re-validated against the shape above
  (`line_count === lines.length`, every money field a normalized decimal
  string); violation → `SCHEMA_INVALID`. Unreachable through these ops
  today — it guards future op additions, not current ones.

## 3. Structured error catalog (the CSV-04 contract)

Every runtime failure is an object (never a bare string, never a stack):

`{code, op, message, ...fields}` — `op` is the raising op's name, or
`"parse"` for the CSV stage. `message` is deterministic English (no paths,
no timestamps). Extra keys per code:

| code | op | extra fields |
|---|---|---|
| `INPUT_TOO_LARGE` | parse | `bytes`, `max_bytes` (524288) |
| `ROW_LIMIT` | parse | `rows`, `max_rows` (5000) |
| `COL_LIMIT` | parse | `cols`, `max_cols` (50) |
| `CSV_PARSE_ERROR` | parse | `row` |
| `RAGGED_ROW` | parse | `row`, `expected`, `actual` |
| `DUPLICATE_COLUMN` | parse | `column` |
| `EMPTY_INPUT` | parse | — |
| `MISSING_COLUMN` | raising op | `missing` (array, op-param order) |
| `BAD_DECIMAL` | parse_decimal | `row`, `column`, `value` (raw cell) |
| `NUMERIC_ERROR` | emit_invoice | `row`, `column`, `value` |
| `MIXED_INVOICE_ID` | emit_invoice | `row`, `expected`, `found` |
| `COLUMN_COLLISION` | rename_columns | `column` |
| `SCHEMA_INVALID` | emit_invoice | `detail` |
| `INVALID_ARTIFACT` | artifact | `reason` (static; aborts run, CLI exit 2) |

## 4. Decimal model (the CSV-03 contract — no floats)

- Decimals are STRINGS from CSV cell to invoice field. The interpreter
  never calls `Number()`, `parseFloat`, or float arithmetic at all:
  `grep -nE "Number\(|parseFloat" family/xform.mjs` MUST print nothing
  (`ms` timings come from `Date.now()` subtraction, which needs no cast).
- Internal form: `{neg: bool, mag: BigInt}` + scale. Products are exact.
  `round_half_up` to 6dp: let `v = abs(product)` at scale `s`; if
  `s ≤ 6`, exact; else `q = floor(v / 10^(s-6))`, `r = v mod 10^(s-6)`,
  round up iff `2r ≥ 10^(s-6)`, sign reapplied (half away from zero).
- Normalization: strip trailing fraction zeros; drop a now-empty fraction
  (`"2.0"`→`"2"`); `"-0"`→`"0"`; zero with any scale → `"0"`. Inputs
  already forbid leading zeros (`007` is `BAD_DECIMAL`) and `+`.
- Check order inside `emit_invoice` is row-major: row 1 qty, row 1 price,
  row 2 qty... first bad cell wins.

## 5. Fixtures

One JSON file per fixture in `family/fixtures/<id>.json`. Schema:

```json
{"id": "<[A-Za-z0-9_-]{1,64}>", "criterion_id": "CSV-01..CSV-06",
 "input": "<CSV text>", "expected": {...}, "severity": "low|medium|high|critical"}
```

Exactly these 5 keys (unknown keys → invalid fixture). `id` MUST equal the
filename stem and be unique in a run. `input` is the literal CSV text
(`\n` inside JSON strings). Severity is informational (challenger
triage); it never changes pass/fail.

`expected` is exactly one of:

- `{"output": <invoice/1 object>}` — run MUST succeed and the result MUST
  be deep-equal (compared via canonical JSON, so key order is free).
- `{"output_digest": "<64 hex>"}` — run MUST succeed and
  `sha256(canonical(result))` MUST equal it. For the 5000-row at-limit
  fixture, whose full output would bloat the repo; the generator
  (`family/gen-limits.mjs`) derives it deterministically AND prints the
  human-checkable derivation (`5000 × (1 × 0.01) → total "50"`).
- `{"error": {<subset>}}` — run MUST fail and EVERY key in the subset MUST
  deep-equal the actual error's same key (`code` is always pinned;
  `op`/`row`/`column`/`missing` pin the rest; `message` is never pinned).

Invalid fixture (bad shape, unknown criterion, bad `expected`, duplicate
id) aborts the run — CLI exit 2, never a silent skip.

## 6. `runChecks` and the CLI (INTERFACES §4)

`runChecks({artifact, fixtures, hooks?}) → {pass, results, env_id}` —
`family/xform.mjs` exports it plus `validateArtifact`, `interpret`,
`ENV_ID ("interp-1")`, `LIMITS`. `hooks = {canonicalize, sha256hex}` is
required only when a fixture uses `output_digest` (the CLI always
supplies it; `xform.mjs` itself never reimplements canonical JSON). Each result:
`{fixture_id, criterion_id, pass, ms, detail}`. `detail` is `"ok"` on
pass, else `expected … / got …` (≤ 500 chars, deterministic — no timings
inside). Static artifact/fixture invalidity THROWS (`INVALID_ARTIFACT` /
`INVALID_FIXTURE`); per-fixture runtime errors are compared, never thrown.

CLI (frozen): `node family/run.mjs <artifact.json> <fixtures-dir> --out
<results.json>` — fixtures = sorted `*.json` in the dir (non-recursive);
`--out` optional (default: stdout). `results.json`:
`{artifact_digest, digest_src, env_id, pass, counts:{total,pass,fail},
results:[...]}`. Exit 0 = all pass, 1 = ≥1 fixture failed, 2 = invalid
input (bad args, unreadable file, JSON syntax, invalid artifact/fixture,
zero fixtures found).

`artifact_digest` = sha256 of canonical JSON (INTERFACES §0), computed
with `receipts/canonical.mjs` (the S6 implementation). The pre-integration
vendored fallback was deleted at S3 merge; `digest_src` is always
`"receipts"`.

## 7. Interpreter-only guarantee (no generated-code execution)

`family/xform.mjs` contains no `eval`, `new Function`, `vm`, `child_process`,
`fs`, or network. The only dynamic construct is `new RegExp(pattern)` on
artifact-supplied `matches` patterns (bounded to 200 chars at validation;
input cells are bounded by the 512 KiB input cap). Verify with:

```sh
grep -nE "eval|Function\(|require\(|child_process|/fs\"|from .fs.|net\.|fetch\(" family/xform.mjs
```

which MUST print nothing (the CLI `run.mjs` alone does `fs`).

## 8. D10 arcs — every criterion fails, then a fix turns it green

`family/artifacts/reference.json` passes ALL fixtures. Each
`family/artifacts/broken-<csv>.json` embodies that criterion's
characteristic builder mistake; `node family/verify-arcs.mjs` replays all
six arcs (broken fails the arc fixture, reference passes it):

| criterion | broken artifact's mistake | arc fixture (fails→green) |
|---|---|---|
| CSV-01 | `reject_rows {matches: ","}` — treats commas as suspicious, drops the legit `"Widget, Large"` line | `csv01-quoted-commas` |
| CSV-02 | drops `require_columns` — the missing field surfaces late at `parse_decimal`, wrong `op` | `csv02-missing-column` |
| CSV-03 | `parse_decimal scale: 2` — truncates legal 6dp money to `BAD_DECIMAL` | `csv03-six-dp-exact` |
| CSV-04 | validates only `qty` — bad `unit_price` surfaces late as `NUMERIC_ERROR@emit_invoice`, wrong code+op | `csv04-late-numeric` |
| CSV-05 | renames `customer_name→client` — `select_columns` then fails `MISSING_COLUMN` on every success fixture | `happy-basic` |
| CSV-06 | `select_columns` with 51 entries — artifact exceeds the 50-column cap, rejected static (`INVALID_ARTIFACT`, CLI exit 2); the 5001-row / 51-col / oversize INPUT fixtures pass on reference by producing the expected structured limit errors | `csv06-over-rows` (ROW_LIMIT as designed) |

CSV-01's parse half and CSV-06's input limits are interpreter-enforced
(no artifact variation changes them), so their arcs are shaped
accordingly: CSV-01's broken artifact mishandles already-correctly-parsed
content, and CSV-06's broken artifact violates the artifact-side column
cap while reference proves the input limits fire as structured errors.

## 9. Adversarial fixtures shipped

`csv03-float-trap` (0.10+0.20 MUST be `"0.3"`, never `0.30000000000000004`),
`csv02-lookalikes` (`Unit_Price`/`unitprice`/`unit_price␣` all MISS),
`csv06-over-rows` (5001), `csv06-over-cols` (51), `csv06-over-bytes`
(>512 KiB), `csv01-bom-and-spaces` (BOM stripped, inner spaces kept,
`qty` trimmed only for validation), `csv04-quote-midfield`,
`csv04-unterminated-quote`.
