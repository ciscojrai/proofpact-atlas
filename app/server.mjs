// ProofPact app/server.mjs — HTTP API (S2, INTERFACES §7). JSON, node:http.
// Store loads at boot; every mutation persists before responding success.
// Error codes come from app/ERRORS.md; unknown failures stay server-side.
import http from "node:http";
import { seed } from "./seed.mjs";
import { loadStore, saveStore } from "./store.mjs";
import * as C from "./controller.mjs";

const PORT = Number(process.env.PORT || 8788);
const BODY_MAX = 128 * 1024;
const store = loadStore();

const STATUS = {
  JOB_NOT_FOUND: 404, RECEIPT_NOT_FOUND: 404, BODY_TOO_LARGE: 413,
  BAD_STATE: 409, STALE_VERIFICATION: 409, DOUBLE_SETTLE: 409,
  DEADLINE_PASSED: 409, BUDGET_REVISIONS: 409, BUDGET_REQUESTS: 409,
  BUDGET_WALLCLOCK: 409,
};

function json(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": data.length });
  res.end(data);
}

function codedError(code, message) {
  return Object.assign(new Error(message), { code });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    req.on("data", (c) => {
      if (done) return;
      size += c.length;
      if (size > BODY_MAX) {
        done = true;
        reject(codedError("BODY_TOO_LARGE", "HTTP body over 128KB"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      if (done) return;
      done = true;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(codedError("INVALID_ENVELOPE", "body was not JSON"));
      }
    });
    req.on("error", () => {});
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const seg = url.pathname.split("/").filter(Boolean);
  try {
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("proofpact app (S2 controller)\n");
    }
    if (req.method === "GET" && url.pathname === "/api/demo/seed") return json(res, 200, seed);
    if (req.method === "POST" && seg.join("/") === "api/jobs") {
      const job = C.createJob(store, await readBody(req));
      saveStore(store);
      return json(res, 200, { job_id: job.job_id, state: job.state });
    }
    if (seg[0] === "api" && seg[1] === "jobs" && seg[2]) {
      const id = seg[2];
      if (req.method === "GET" && seg.length === 3) return json(res, 200, C.jobView(store, id));
      if (req.method === "POST" && seg.length === 4) {
        const body = await readBody(req);
        let out;
        if (seg[3] === "artifact") out = C.submitArtifact(store, id, body);
        else if (seg[3] === "challenge") out = C.submitChallenge(store, id, body);
        else if (seg[3] === "verify") out = C.verifyJob(store, id);
        else if (seg[3] === "settle") out = C.settleJob(store, id);
        else return json(res, 404, { error: "NOT_FOUND" });
        saveStore(store);
        return json(res, 200, out);
      }
    }
    if (req.method === "GET" && seg[0] === "api" && seg[1] === "receipts" && seg[2] && seg.length === 3) {
      const r = store.receipts[seg[2]];
      if (!r) return json(res, 404, { error: "RECEIPT_NOT_FOUND" });
      return json(res, 200, r);
    }
    return json(res, 404, { error: "NOT_FOUND" });
  } catch (e) {
    const code = e?.code || "INTERNAL";
    if (!e?.code) console.error("internal:", e);
    return json(res, STATUS[code] || 400, { error: code, detail: e?.code ? e.message : undefined });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`proofpact app on http://127.0.0.1:${PORT}`);
});
