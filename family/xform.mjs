// family/xform.mjs — csv-xform/1 validator + interp-1 interpreter (S3 family).
// Pure module: no file IO, no dynamic code, no subprocess, no network, no floats.
// Semantics: family/SPEC.md. CSV bytes: family/DIALECT.md.
export const ENV_ID = "interp-1";
export const LIMITS = Object.freeze({
  maxBytes: 524288, // 512 KiB input
  maxRows: 5000,
  maxCols: 50,
  maxScale: 6,
  maxOps: 32,
  maxRegex: 200,
});

export class XformError extends Error {
  constructor(code, op, message, fields) {
    super(message);
    this.name = "XformError";
    this.code = code;
    this.op = op;
    this.fields = fields || {};
  }
  toObject() {
    return { code: this.code, op: this.op, message: this.message, ...this.fields };
  }
}

function fail(code, op, message, fields) {
  throw new XformError(code, op, message, fields || {});
}

// ---------- decimals: strings in, strings out, BigInt inside ----------

const DEC_RE = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/;

function trimSpaces(s) {
  return s.replace(/^[ \t]+|[ \t]+$/g, "");
}

// Strict decimal per SPEC §4. Returns {neg, mag: BigInt, scale} or null.
function parseDecimalStrict(raw, maxScale) {
  if (typeof raw !== "string") return null;
  const t = trimSpaces(raw);
  if (!DEC_RE.test(t)) return null;
  const neg = t.charCodeAt(0) === 45; // "-"
  const digits = neg ? t.slice(1) : t;
  const dot = digits.indexOf(".");
  const scale = dot === -1 ? 0 : digits.length - dot - 1;
  if (scale > maxScale) return null;
  const nodot = dot === -1 ? digits : digits.slice(0, dot) + digits.slice(dot + 1);
  const mag = BigInt(nodot);
  return { neg: neg && mag !== 0n, mag, scale };
}

function formatDecimal(d) {
  let { neg, mag, scale } = d;
  if (mag === 0n) return "0";
  while (scale > 0 && mag % 10n === 0n) {
    mag /= 10n;
    scale -= 1;
  }
  let digits = mag.toString();
  const sign = neg ? "-" : "";
  if (scale === 0) return sign + digits;
  while (digits.length <= scale) digits = "0" + digits;
  const cut = digits.length - scale;
  return sign + digits.slice(0, cut) + "." + digits.slice(cut);
}

// Exact product of two decimals, rounded half-up (away from zero) to 6dp.
function mulRound6(a, b) {
  const s = a.scale + b.scale;
  const v = a.mag * b.mag;
  const neg = a.neg !== b.neg;
  if (v === 0n) return "0";
  if (s <= 6) return formatDecimal({ neg, mag: v, scale: s });
  const div = 10n ** BigInt(s - 6);
  let q = v / div;
  const r = v % div;
  if (r * 2n >= div) q += 1n;
  return formatDecimal({ neg, mag: q, scale: 6 });
}

// Exact sum of normalized decimal strings (all scales <= 6).
function sumDecimals(strs) {
  let maxScale = 0;
  const parts = strs.map((s) => {
    const p = parseDecimalStrict(s, LIMITS.maxScale);
    if (!p) throw new Error("sumDecimals: non-decimal input");
    if (p.scale > maxScale) maxScale = p.scale;
    return p;
  });
  let acc = 0n;
  for (const p of parts) {
    const signed = p.neg ? -p.mag : p.mag;
    acc += signed * 10n ** BigInt(maxScale - p.scale);
  }
  return formatDecimal({ neg: acc < 0n, mag: acc < 0n ? -acc : acc, scale: maxScale });
}

// ---------- CSV parser (DIALECT.md) ----------

export function parseCSV(text) {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > LIMITS.maxBytes) {
    fail("INPUT_TOO_LARGE", "parse",
      `input is ${bytes} bytes, limit is ${LIMITS.maxBytes}`,
      { bytes, max_bytes: LIMITS.maxBytes });
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const n = text.length;
  const records = [];
  let rec = [];
  let field = "";
  let inQuotes = false;
  let atFieldStart = true;
  let afterQuote = false;
  const atRecordStart = () => rec.length === 0 && field === "" && atFieldStart;
  const pushField = () => { rec.push(field); field = ""; atFieldStart = true; afterQuote = false; };
  const pushRecord = () => { records.push(rec); rec = []; };
  const parseErr = (why) => fail("CSV_PARSE_ERROR", "parse",
    `malformed CSV at row ${records.length}: ${why}`, { row: records.length });

  let i = 0;
  while (i < n) {
    const c = text[i];
    if (c === "\0") parseErr("NUL byte");
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; }
        else { inQuotes = false; atFieldStart = false; afterQuote = true; i += 1; }
      } else if (c === "\r" && text[i + 1] === "\n") {
        field += "\n"; i += 2; // embedded CRLF normalizes to LF
      } else {
        field += c; i += 1;
      }
      continue;
    }
    if (atFieldStart && c === '"') {
      inQuotes = true; atFieldStart = false; i += 1; continue;
    }
    if (c === ",") { pushField(); i += 1; continue; }
    if (c === '"') parseErr('stray quote (only "" inside a quoted field)');
    if (afterQuote) parseErr("text after closing quote (only , or newline may follow)");
    if (c === "\n" || (c === "\r" && text[i + 1] === "\n")) {
      i += c === "\r" ? 2 : 1;
      if (atRecordStart()) continue; // skip wholly empty physical lines
      pushField(); pushRecord(); continue;
    }
    field += c; atFieldStart = false; i += 1; // lone CR is data
  }
  if (inQuotes) parseErr("unterminated quoted field");
  if (!atRecordStart()) { pushField(); pushRecord(); }

  if (records.length === 0) {
    fail("EMPTY_INPUT", "parse", "empty input: no header record", {});
  }
  const header = records[0];
  if (header.length > LIMITS.maxCols) {
    fail("COL_LIMIT", "parse",
      `header has ${header.length} columns, limit is ${LIMITS.maxCols}`,
      { cols: header.length, max_cols: LIMITS.maxCols });
  }
  const seen = new Set();
  for (const h of header) {
    if (seen.has(h)) {
      fail("DUPLICATE_COLUMN", "parse", `duplicate column: ${h}`, { column: h });
    }
    seen.add(h);
  }
  const data = records.slice(1);
  if (data.length > LIMITS.maxRows) {
    fail("ROW_LIMIT", "parse",
      `input has ${data.length} data rows, limit is ${LIMITS.maxRows}`,
      { rows: data.length, max_rows: LIMITS.maxRows });
  }
  for (let k = 0; k < data.length; k += 1) {
    if (data[k].length !== header.length) {
      fail("RAGGED_ROW", "parse",
        `row ${k + 1} has ${data[k].length} fields, header has ${header.length}`,
        { row: k + 1, expected: header.length, actual: data[k].length });
    }
  }
  return { columns: header.slice(), rows: data.map((r) => r.slice()) };
}

// ---------- artifact validation (static; SPEC §0) ----------

const OP_NAMES = ["select_columns", "rename_columns", "require_columns",
  "parse_decimal", "reject_rows", "emit_invoice"];
const OP_PARAMS = {
  select_columns: ["columns"],
  rename_columns: ["mapping"],
  require_columns: ["columns"],
  parse_decimal: ["columns", "scale"],
  reject_rows: ["column", "equals", "matches"],
  emit_invoice: ["id_column", "customer_column", "item_column", "qty_column",
    "unit_price_column", "currency"],
};
const CURRENCY_RE = /^[A-Z]{3}$/;

function isNonEmptyString(v) {
  return typeof v === "string" && v.length > 0;
}

function checkColumnsList(v, where) {
  if (!Array.isArray(v) || v.length < 1 || v.length > LIMITS.maxCols ||
      !v.every(isNonEmptyString)) {
    fail("INVALID_ARTIFACT", "artifact",
      `${where}: need an array of 1..${LIMITS.maxCols} non-empty strings`, {});
  }
}

function validateOp(o, idx) {
  const where = `ops[${idx}]`;
  if (o === null || typeof o !== "object" || Array.isArray(o)) {
    fail("INVALID_ARTIFACT", "artifact", `${where}: op must be an object`, {});
  }
  if (!OP_NAMES.includes(o.op)) {
    fail("INVALID_ARTIFACT", "artifact",
      `${where}: unknown op ${JSON.stringify(o.op) ?? "null"}`, {});
  }
  for (const k of Object.keys(o)) {
    if (k !== "op" && !OP_PARAMS[o.op].includes(k)) {
      fail("INVALID_ARTIFACT", "artifact", `${where}: unknown param ${k}`, {});
    }
  }
  switch (o.op) {
    case "require_columns":
    case "select_columns": {
      checkColumnsList(o.columns, `${where}.columns`);
      if (o.op === "select_columns" && new Set(o.columns).size !== o.columns.length) {
        fail("INVALID_ARTIFACT", "artifact", `${where}: duplicate column`, {});
      }
      break;
    }
    case "parse_decimal": {
      checkColumnsList(o.columns, `${where}.columns`);
      const scale = o.scale === undefined ? 6 : o.scale;
      if (!Number.isInteger(scale) || scale < 0 || scale > LIMITS.maxScale) {
        fail("INVALID_ARTIFACT", "artifact",
          `${where}.scale: need an integer 0..${LIMITS.maxScale}`, {});
      }
      break;
    }
    case "reject_rows": {
      if (!isNonEmptyString(o.column)) {
        fail("INVALID_ARTIFACT", "artifact", `${where}.column: need a non-empty string`, {});
      }
      const hasEq = Object.hasOwn(o, "equals");
      const hasMatch = Object.hasOwn(o, "matches");
      if ((hasEq ? 1 : 0) + (hasMatch ? 1 : 0) !== 1) {
        fail("INVALID_ARTIFACT", "artifact",
          `${where}: need exactly one of equals|matches`, {});
      }
      if (hasEq && typeof o.equals !== "string") {
        fail("INVALID_ARTIFACT", "artifact", `${where}.equals: need a string`, {});
      }
      if (hasMatch) {
        if (typeof o.matches !== "string" || o.matches.length < 1 ||
            o.matches.length > LIMITS.maxRegex) {
          fail("INVALID_ARTIFACT", "artifact",
            `${where}.matches: need a 1..${LIMITS.maxRegex} char string`, {});
        }
        try {
          RegExp(o.matches);
        } catch {
          fail("INVALID_ARTIFACT", "artifact", `${where}.matches: bad regex`, {});
        }
      }
      break;
    }
    case "rename_columns": {
      const m = o.mapping;
      if (m === null || typeof m !== "object" || Array.isArray(m) ||
          Object.keys(m).length < 1 || Object.keys(m).length > LIMITS.maxCols ||
          !Object.keys(m).every(isNonEmptyString) ||
          !Object.values(m).every(isNonEmptyString)) {
        fail("INVALID_ARTIFACT", "artifact",
          `${where}.mapping: need 1..${LIMITS.maxCols} non-empty string pairs`, {});
      }
      break;
    }
    case "emit_invoice": {
      for (const p of OP_PARAMS.emit_invoice) {
        if (p === "currency") continue;
        if (!isNonEmptyString(o[p])) {
          fail("INVALID_ARTIFACT", "artifact", `${where}.${p}: need a non-empty string`, {});
        }
      }
      if (o.currency !== undefined &&
          (typeof o.currency !== "string" || !CURRENCY_RE.test(o.currency))) {
        fail("INVALID_ARTIFACT", "artifact",
          `${where}.currency: need 3 uppercase letters (e.g. USD)`, {});
      }
      break;
    }
    default:
      fail("INVALID_ARTIFACT", "artifact", `${where}: unreachable`, {});
  }
}

export function validateArtifact(a) {
  if (a === null || typeof a !== "object" || Array.isArray(a)) {
    fail("INVALID_ARTIFACT", "artifact", "artifact must be an object", {});
  }
  const keys = Object.keys(a).sort();
  if (keys.length !== 2 || keys[0] !== "format" || keys[1] !== "ops") {
    fail("INVALID_ARTIFACT", "artifact",
      "artifact must be exactly {format, ops}", {});
  }
  if (a.format !== "csv-xform/1") {
    fail("INVALID_ARTIFACT", "artifact",
      `format must be csv-xform/1, got ${JSON.stringify(a.format)}`, {});
  }
  if (!Array.isArray(a.ops) || a.ops.length < 1 || a.ops.length > LIMITS.maxOps) {
    fail("INVALID_ARTIFACT", "artifact",
      `ops: need an array of 1..${LIMITS.maxOps} ops`, {});
  }
  for (let idx = 0; idx < a.ops.length; idx += 1) validateOp(a.ops[idx], idx);
}

// ---------- op execution ----------

function needColumns(table, names, op) {
  const missing = names.filter((nm) => !table.columns.includes(nm));
  if (missing.length > 0) {
    fail("MISSING_COLUMN", op,
      `${op}: missing column(s): ${missing.join(", ")}`, { missing });
  }
}

function applyRequire(table, o) {
  needColumns(table, o.columns, "require_columns");
}

function applyParse(table, o) {
  needColumns(table, o.columns, "parse_decimal");
  const scale = o.scale === undefined ? 6 : o.scale;
  const idxs = o.columns.map((c) => table.columns.indexOf(c));
  for (let k = 0; k < table.rows.length; k += 1) {
    for (let j = 0; j < idxs.length; j += 1) {
      const raw = table.rows[k][idxs[j]];
      const d = parseDecimalStrict(raw, scale);
      if (!d) {
        fail("BAD_DECIMAL", "parse_decimal",
          `row ${k + 1} column ${o.columns[j]} is not a decimal (scale ${scale}): ${raw}`,
          { row: k + 1, column: o.columns[j], value: raw });
      }
      table.rows[k][idxs[j]] = formatDecimal(d);
    }
  }
}

function applyReject(table, o) {
  needColumns(table, [o.column], "reject_rows");
  const idx = table.columns.indexOf(o.column);
  if (Object.hasOwn(o, "equals")) {
    table.rows = table.rows.filter((r) => r[idx] !== o.equals);
  } else {
    const re = RegExp(o.matches); // validated compilable; fresh instance per run
    table.rows = table.rows.filter((r) => !re.test(r[idx]));
  }
}

function applySelect(table, o) {
  needColumns(table, o.columns, "select_columns");
  const idxs = o.columns.map((c) => table.columns.indexOf(c));
  table.columns = o.columns.slice();
  table.rows = table.rows.map((r) => idxs.map((ix) => r[ix]));
}

function applyRename(table, o) {
  needColumns(table, Object.keys(o.mapping), "rename_columns");
  const next = table.columns.map((c) => (Object.hasOwn(o.mapping, c) ? o.mapping[c] : c));
  const seen = new Set();
  for (const c of next) {
    if (seen.has(c)) {
      fail("COLUMN_COLLISION", "rename_columns",
        `rename target collides: ${c}`, { column: c });
    }
    seen.add(c);
  }
  table.columns = next;
}

const NORMALIZED_RE = /^-?(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$/;

function applyEmit(table, o) {
  const order = ["id_column", "customer_column", "item_column", "qty_column", "unit_price_column"];
  needColumns(table, order.map((p) => o[p]), "emit_invoice");
  const ix = {};
  for (const p of order) ix[p] = table.columns.indexOf(o[p]);
  const rows = table.rows;
  if (rows.length > 0) {
    const first = rows[0][ix.id_column];
    for (let k = 1; k < rows.length; k += 1) {
      if (rows[k][ix.id_column] !== first) {
        fail("MIXED_INVOICE_ID", "emit_invoice",
          `row ${k + 1} invoice ${rows[k][ix.id_column]} differs from row 1 (${first})`,
          { row: k + 1, expected: first, found: rows[k][ix.id_column] });
      }
    }
  }
  const lines = [];
  for (let k = 0; k < rows.length; k += 1) {
    for (const [param, col] of [["qty_column", o.qty_column], ["unit_price_column", o.unit_price_column]]) {
      const raw = rows[k][ix[param]];
      const d = parseDecimalStrict(raw, LIMITS.maxScale);
      if (!d) {
        fail("NUMERIC_ERROR", "emit_invoice",
          `row ${k + 1} column ${col} is not a decimal: ${raw}`,
          { row: k + 1, column: col, value: raw });
      }
      rows[k][ix[param]] = formatDecimal(d);
    }
    const q = parseDecimalStrict(rows[k][ix.qty_column], LIMITS.maxScale);
    const p = parseDecimalStrict(rows[k][ix.unit_price_column], LIMITS.maxScale);
    lines.push({
      item: rows[k][ix.item_column],
      qty: formatDecimal(q),
      unit_price: formatDecimal(p),
      line_total: mulRound6(q, p),
    });
  }
  const out = {
    format: "invoice/1",
    invoice_id: rows.length > 0 ? rows[0][ix.id_column] : "",
    customer: rows.length > 0 ? rows[0][ix.customer_column] : "",
    currency: o.currency === undefined ? "USD" : o.currency,
    lines,
    line_count: lines.length,
    total: sumDecimals(lines.map((l) => l.line_total)),
  };
  const moneyOk = (s) => typeof s === "string" && NORMALIZED_RE.test(s);
  const shapeOk = out.line_count === out.lines.length &&
    typeof out.invoice_id === "string" && typeof out.customer === "string" &&
    moneyOk(out.total) && out.lines.every((l) =>
      typeof l.item === "string" && moneyOk(l.qty) &&
      moneyOk(l.unit_price) && moneyOk(l.line_total));
  if (!shapeOk) {
    fail("SCHEMA_INVALID", "emit_invoice", "emitted invoice failed shape check",
      { detail: "unreachable via current ops" });
  }
  return out;
}

export function interpret(artifact, csvText) {
  validateArtifact(artifact);
  if (typeof csvText !== "string") {
    throw new TypeError("interpret: csvText must be a string");
  }
  const table = parseCSV(csvText);
  let last = { columns: table.columns.slice(), rows: table.rows.map((r) => r.slice()) };
  for (const o of artifact.ops) {
    switch (o.op) {
      case "require_columns": applyRequire(table, o); break;
      case "parse_decimal": applyParse(table, o); break;
      case "reject_rows": applyReject(table, o); break;
      case "select_columns": applySelect(table, o); break;
      case "rename_columns": applyRename(table, o); break;
      case "emit_invoice": last = applyEmit(table, o); break;
      default: break; // validated above; unreachable
    }
    if (o.op !== "emit_invoice") {
      last = { columns: table.columns.slice(), rows: table.rows.map((r) => r.slice()) };
    }
  }
  return last;
}

// ---------- fixtures + runChecks (INTERFACES §4) ----------

const CRITERIA = ["CSV-01", "CSV-02", "CSV-03", "CSV-04", "CSV-05", "CSV-06"];
const SEVERITIES = ["low", "medium", "high", "critical"];
const FIXTURE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DIGEST_RE = /^[0-9a-fA-F]{64}$/;

function failFixture(why) {
  fail("INVALID_FIXTURE", "fixture", why, {});
}

function validateFixture(f, idx) {
  const where = `fixtures[${idx}]`;
  if (f === null || typeof f !== "object" || Array.isArray(f)) {
    failFixture(`${where}: fixture must be an object`);
  }
  const keys = Object.keys(f).sort();
  const want = ["criterion_id", "expected", "id", "input", "severity"];
  if (keys.length !== want.length || !keys.every((k, i) => k === want[i])) {
    failFixture(`${where}: fixture must be exactly {id, criterion_id, input, expected, severity}`);
  }
  if (typeof f.id !== "string" || !FIXTURE_ID_RE.test(f.id)) {
    failFixture(`${where}: bad id (1..64 of A-Za-z0-9_-)`);
  }
  if (!CRITERIA.includes(f.criterion_id)) {
    failFixture(`${where}: bad criterion_id (want CSV-01..CSV-06)`);
  }
  if (typeof f.input !== "string") failFixture(`${where}: input must be a string`);
  if (!SEVERITIES.includes(f.severity)) {
    failFixture(`${where}: bad severity (want low|medium|high|critical)`);
  }
  const e = f.expected;
  if (e === null || typeof e !== "object" || Array.isArray(e)) {
    failFixture(`${where}: expected must be an object`);
  }
  const kinds = ["output", "output_digest", "error"].filter((k) => Object.hasOwn(e, k));
  if (kinds.length !== 1) {
    failFixture(`${where}: expected needs exactly one of output|output_digest|error`);
  }
  if (Object.hasOwn(e, "output_digest") &&
      (typeof e.output_digest !== "string" || !DIGEST_RE.test(e.output_digest))) {
    failFixture(`${where}: output_digest must be 64 hex chars`);
  }
  if (Object.hasOwn(e, "error") &&
      (e.error === null || typeof e.error !== "object" || Array.isArray(e.error) ||
       !isNonEmptyString(e.error.code))) {
    failFixture(`${where}: expected.error must be an object pinning code`);
  }
}

// Exact deep-equal; object key order is free, array order is not.
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
}

function short(s) {
  const t = typeof s === "string" ? s : JSON.stringify(s);
  return t.length > 160 ? `${t.slice(0, 160)}...` : t;
}

function capDetail(s) {
  return s.length > 500 ? `${s.slice(0, 500)}...` : s;
}

function compareExpected(expected, actual, failed, hooks) {
  if (Object.hasOwn(expected, "output")) {
    if (failed) {
      return { pass: false, detail: capDetail(`expected output / got error ${actual.code}: ${short(actual.message)}`) };
    }
    if (deepEqual(actual, expected.output)) return { pass: true, detail: "ok" };
    return {
      pass: false,
      detail: capDetail(`expected ${short(expected.output)} / got ${short(actual)}`),
    };
  }
  if (Object.hasOwn(expected, "output_digest")) {
    if (failed) {
      return { pass: false, detail: capDetail(`expected output digest / got error ${actual.code}: ${short(actual.message)}`) };
    }
    const got = hooks.sha256hex(hooks.canonicalize(actual));
    if (got.toLowerCase() === expected.output_digest.toLowerCase()) {
      return { pass: true, detail: "ok" };
    }
    return {
      pass: false,
      detail: `expected digest ${expected.output_digest} / got ${got}`,
    };
  }
  if (!failed) {
    return { pass: false, detail: capDetail(`expected error ${expected.error.code} / got output ${short(actual)}`) };
  }
  for (const k of Object.keys(expected.error)) {
    if (!deepEqual(actual[k], expected.error[k])) {
      return {
        pass: false,
        detail: capDetail(`expected error.${k} ${short(expected.error[k])} / got ${short(actual[k])}`),
      };
    }
  }
  return { pass: true, detail: "ok" };
}

// runChecks({artifact, fixtures, hooks?}) -> {pass, results, env_id}.
// hooks = {canonicalize, sha256hex}, required only when a fixture uses
// output_digest (supplied by the CLI / controller; xform never
// reimplements the receipts canonicalizer). Static invalidity THROWS
// (INVALID_ARTIFACT / INVALID_FIXTURE); per-fixture runtime errors are
// compared, never thrown.
export function runChecks({ artifact, fixtures, hooks }) {
  validateArtifact(artifact);
  if (!Array.isArray(fixtures)) failFixture("fixtures must be an array");
  fixtures.forEach(validateFixture);
  const ids = new Set();
  for (const f of fixtures) {
    if (ids.has(f.id)) failFixture(`duplicate fixture id: ${f.id}`);
    ids.add(f.id);
  }
  const needDigest = fixtures.some((f) => Object.hasOwn(f.expected, "output_digest"));
  if (needDigest && (!hooks || typeof hooks.canonicalize !== "function" ||
      typeof hooks.sha256hex !== "function")) {
    throw new Error("runChecks: output_digest fixtures need hooks {canonicalize, sha256hex}");
  }
  const results = fixtures.map((f) => {
    const t0 = Date.now();
    let actual;
    let failed = false;
    try {
      actual = interpret(artifact, f.input);
    } catch (e) {
      if (e instanceof XformError) {
        actual = e.toObject();
        failed = true;
      } else {
        throw e;
      }
    }
    const { pass, detail } = compareExpected(f.expected, actual, failed, hooks || {});
    return { fixture_id: f.id, criterion_id: f.criterion_id, pass, ms: Date.now() - t0, detail };
  });
  return { pass: results.every((r) => r.pass), results, env_id: ENV_ID };
}
