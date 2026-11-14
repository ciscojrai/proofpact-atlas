// ProofPact app/store.mjs — JSON-file durable store (S2).
// Data lives at $DATA_PATH or data/proofpact.json (gitignored). Writes are
// atomic (tmp + rename). The controller mutates the passed object; the caller
// persists BEFORE reporting success. Single-process MVP.
import fs from "node:fs";
import path from "node:path";

export function dataPath() {
  return process.env.DATA_PATH || path.join(process.cwd(), "data", "proofpact.json");
}

export function loadStore() {
  try {
    const s = JSON.parse(fs.readFileSync(dataPath(), "utf8"));
    s.seq = s.seq || 0;
    s.jobs = s.jobs || {};
    s.receipts = s.receipts || {};
    return s;
  } catch {
    return { seq: 0, jobs: {}, receipts: {} };
  }
}

export function saveStore(store) {
  const p = dataPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(store));
  fs.renameSync(tmp, p);
}

export function logEvent(store, job, type, payload) {
  store.seq += 1;
  const entry = { seq: store.seq, ts: Date.now(), type, payload: payload || {} };
  job.timeline.push(entry);
  return entry;
}
