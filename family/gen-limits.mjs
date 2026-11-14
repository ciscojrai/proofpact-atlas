// family/gen-limits.mjs — deterministically (re)builds the four large CSV-06
// fixtures. No randomness: fixed row templates, fixed counts. Prints the
// human-checkable derivation for csv06-at-limit's output_digest.
// usage: node family/gen-limits.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { interpret, XformError } from "./xform.mjs";
import { loadDigest } from "./digest.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(dir, "fixtures");
const reference = JSON.parse(fs.readFileSync(path.join(dir, "artifacts", "reference.json"), "utf8"));

const HEADER = "invoice_id,customer_name,item,qty,unit_price\n";

function bulkRow(inv, k) {
  return `${inv},Acme Corp,Bulk Item ${k},1,0.01\n`;
}

function writeFixture(name, obj) {
  fs.writeFileSync(path.join(fixturesDir, name), JSON.stringify(obj));
  console.log(`wrote ${name} (${fs.statSync(path.join(fixturesDir, name)).size} bytes)`);
}

function expectThrow(input, code, extra) {
  try {
    interpret(reference, input);
  } catch (e) {
    if (e instanceof XformError && e.code === code &&
        Object.entries(extra).every(([k, v]) => JSON.stringify(e.toObject()[k]) === JSON.stringify(v))) {
      return e.toObject();
    }
    throw new Error(`gen: expected ${code} ${JSON.stringify(extra)}, got ${e instanceof XformError ? JSON.stringify(e.toObject()) : e}`);
  }
  throw new Error(`gen: expected throw ${code}, got success`);
}

async function main() {
  const hooks = await loadDigest();

  // 1. csv06-over-rows: 5001 valid rows -> ROW_LIMIT (bytes stay < 512 KiB).
  let overRows = HEADER;
  for (let k = 1; k <= 5001; k += 1) overRows += bulkRow("INV-610", k);
  if (Buffer.byteLength(overRows, "utf8") >= 524288) throw new Error("gen: over-rows too big");
  expectThrow(overRows, "ROW_LIMIT", { rows: 5001, max_rows: 5000 });
  writeFixture("csv06-over-rows.json", {
    id: "csv06-over-rows",
    criterion_id: "CSV-06",
    input: overRows,
    expected: { error: { code: "ROW_LIMIT", op: "parse", rows: 5001, max_rows: 5000 } },
    severity: "critical",
  });

  // 2. csv06-at-limit: exactly 5000 rows -> success; expected via digest.
  // Derivation: 5000 lines x (qty 1 x unit_price 0.01) = 5000 x "0.01",
  // total "50", line_count 5000. Off-by-one guard: 5000 OK, 5001 fails.
  let atLimit = HEADER;
  for (let k = 1; k <= 5000; k += 1) atLimit += bulkRow("INV-611", k);
  if (Buffer.byteLength(atLimit, "utf8") >= 524288) throw new Error("gen: at-limit too big");
  const actual = interpret(reference, atLimit);
  if (actual.line_count !== 5000 || actual.total !== "50" || actual.lines.length !== 5000) {
    throw new Error(`gen: at-limit derivation broke: count=${actual.line_count} total=${actual.total}`);
  }
  if (actual.lines[0].item !== "Bulk Item 1" || actual.lines[4999].item !== "Bulk Item 5000") {
    throw new Error("gen: at-limit line content broke");
  }
  const digest = hooks.sha256hex(hooks.canonicalize(actual));
  console.log(`at-limit derivation: 5000 x (1 x 0.01) -> total "50", digest ${digest} (via ${hooks.src})`);
  writeFixture("csv06-at-limit.json", {
    id: "csv06-at-limit",
    criterion_id: "CSV-06",
    input: atLimit,
    expected: { output_digest: digest },
    severity: "high",
  });

  // 3. csv06-over-cols: 51-column header -> COL_LIMIT.
  const cols = [];
  for (let k = 1; k <= 51; k += 1) cols.push(`c${String(k).padStart(2, "0")}`);
  const overCols = `${cols.join(",")}\n${cols.map(() => "x").join(",")}\n`;
  expectThrow(overCols, "COL_LIMIT", { cols: 51, max_cols: 50 });
  writeFixture("csv06-over-cols.json", {
    id: "csv06-over-cols",
    criterion_id: "CSV-06",
    input: overCols,
    expected: { error: { code: "COL_LIMIT", op: "parse", cols: 51, max_cols: 50 } },
    severity: "high",
  });

  // 4. csv06-over-bytes: input just over 512 KiB -> INPUT_TOO_LARGE.
  const padRow = `INV-613,Acme Corp,${"X".repeat(200)},1,1.00\n`;
  let big = HEADER;
  while (Buffer.byteLength(big, "utf8") <= 524288) big += padRow;
  const bigBytes = Buffer.byteLength(big, "utf8");
  console.log(`over-bytes input: ${bigBytes} bytes (limit 524288)`);
  expectThrow(big, "INPUT_TOO_LARGE", { max_bytes: 524288 });
  writeFixture("csv06-over-bytes.json", {
    id: "csv06-over-bytes",
    criterion_id: "CSV-06",
    input: big,
    expected: { error: { code: "INPUT_TOO_LARGE", op: "parse", max_bytes: 524288 } },
    severity: "critical",
  });

  console.log("gen-limits: all 4 fixtures self-checked against reference.json");
}

await main();
