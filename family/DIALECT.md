# ProofPact CSV dialect — `csv-xform/1` input format

This file is owned by the family stream (S3). It defines the exact bytes the
`interp-1` interpreter accepts. Anything not described here is rejected.

## 1. Encoding and framing

- UTF-8. A leading UTF-8 BOM (`EF BB BF`) is stripped when present.
- Record separators: LF (`\n`) or CRLF (`\r\n`). A lone CR inside an unquoted
  field is data, not a separator.
- NUL bytes (`00`) are rejected with `CSV_PARSE_ERROR`.
- No comment lines. No continuation lines.

## 2. Records and fields

- The first record is the **header**: it names every column.
- Every data record MUST have exactly as many fields as the header, else
  `RAGGED_ROW` naming the record number and both widths.
- Header names are matched **exactly** (case- and space-sensitive):
  `Unit_Price`, `unitprice`, and `unit_price ` (trailing space) are three
  different names, none of which equals `unit_price`.
- Duplicate header names are rejected with `DUPLICATE_COLUMN`.
- Fields are NOT trimmed: ` Acme ` stays ` Acme `. (Only `parse_decimal`
  trims ASCII spaces/tabs around the digits it validates — see `SPEC.md`.)
- A physical line that is completely empty (zero characters) between records
  is skipped and consumes no record number. A line containing spaces is data.
- A missing trailing newline is fine. Zero bytes (or only a BOM) is
  `EMPTY_INPUT`. A header record with zero data records is valid and
  yields an empty invoice (`lines: []`, `total: "0"`). Note a
  whitespace-only input is a header-only input (one spaces field), so it
  parses and then fails at `require_columns` if anything is required.

## 3. Quoting (the CSV-01 rules)

- A field starting with `"` is quoted: it ends at the next `"` that is not
  part of a `""` pair.
- **Quoted commas**: `,"Widget, Large",` is ONE field (`Widget, Large`).
- **Newlines in quotes: yes.** A quoted field may span physical lines; the
  embedded line break is part of the value, normalized to a single LF
  (`\n`): a CRLF inside a quoted field becomes `\n` in the value, so no
  parsed value ever contains `\r`.
- **Escaped quotes: `""`.** Inside a quoted field, `""` is one literal `"`.
- A `"` anywhere except as the first character of a field is
  `CSV_PARSE_ERROR` (e.g. `ab"cd`). After a quoted field closes, only a
  comma or a record separator may follow on that field.
- EOF inside a quoted field is `CSV_PARSE_ERROR` (unterminated quote).

## 4. Record numbering (used by every structured error)

- The header record is row `0`. Data records are rows `1..N` in file order.
- Skipped empty lines consume no numbers. A record spanning several physical
  lines (quoted newline) still counts as ONE row.

## 5. Limits (frozen by INTERFACES §3; check order is part of the contract)

| Limit | Value | Error |
|---|---|---|
| input bytes (UTF-8, BOM included) | ≤ 524288 (512 KiB) | `INPUT_TOO_LARGE` |
| columns (header width) | ≤ 50 | `COL_LIMIT` |
| data rows (records, excl. header) | ≤ 5000 | `ROW_LIMIT` |
| decimal scale (fraction digits) | ≤ 6 | `BAD_DECIMAL` |

Check order: bytes → structure (`CSV_PARSE_ERROR`, `EMPTY_INPUT`) →
`COL_LIMIT` (header width) → `DUPLICATE_COLUMN` → `ROW_LIMIT` (record
count) → `RAGGED_ROW` (first offending record wins). So a 5001-row ragged
input reports `ROW_LIMIT`, and a 51-column header with ragged rows reports
`COL_LIMIT`.

## 6. Worked example

Input bytes (␊ = LF):

```text
invoice_id,customer_name,item,qty,unit_price␊
INV-1,Acme,"Widget, Large",2,19.99␊
INV-1,Acme,"Say ""hi""",1,0.10␊
```

parses to header `[invoice_id customer_name item qty unit_price]` and rows
`1..2`, where row 1 item is `Widget, Large` and row 2 item is `Say "hi"`.
