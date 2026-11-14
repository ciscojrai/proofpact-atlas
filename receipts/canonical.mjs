// ProofPact receipts/canonical.mjs — THE canonicalizer (INTERFACES §0/§5).
// Canonical JSON: UTF-8, object keys sorted byte-wise, no whitespace, no floats.
// Every stream imports this. Nobody reimplements it.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function canonicalize(value) {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isInteger(value)) {
      throw new Error("canonical: floats forbidden (decimals must be strings)");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(",")}}`;
}

export function sha256hex(canonical) {
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function digestOf(value) {
  return sha256hex(canonicalize(value));
}

// --selftest: recompute the golden vector's digest byte-identically.
if (process.argv[2] === "--selftest") {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const golden = JSON.parse(fs.readFileSync(path.join(dir, "fixture-run.json"), "utf8"));
  const { receipt_digest, ...body } = golden;
  const recomputed = digestOf(body);
  if (recomputed !== receipt_digest) {
    console.error(`SELFTEST FAIL: ${recomputed} != ${receipt_digest}`);
    process.exit(1);
  }
  console.log(`SELFTEST OK: golden receipt digest ${recomputed}`);
}
