// family/verify-arcs.mjs — replays the six CSV-01..06 D10 arcs (SPEC §8):
// each broken artifact FAILS its arc fixture, reference.json passes it
// (and everything else). CSV-06's broken artifact is statically invalid,
// so its arc asserts INVALID_ARTIFACT instead of a fixture fail.
// usage: node family/verify-arcs.mjs (exit 0 = all arcs hold)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XformError, runChecks } from "./xform.mjs";
import { loadDigest } from "./digest.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const ARCS = [
  { criterion: "CSV-01", broken: "broken-csv01.json", fixture: "csv01-quoted-commas" },
  { criterion: "CSV-02", broken: "broken-csv02.json", fixture: "csv02-missing-column" },
  { criterion: "CSV-03", broken: "broken-csv03.json", fixture: "csv03-six-dp-exact" },
  { criterion: "CSV-04", broken: "broken-csv04.json", fixture: "csv04-late-numeric" },
  { criterion: "CSV-05", broken: "broken-csv05.json", fixture: "happy-basic" },
  { criterion: "CSV-06", broken: "broken-csv06.json", fixture: "csv06-over-rows", invalid: true },
];

const loadJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
let failures = 0;
const check = (ok, line) => {
  console.log(`${ok ? "ARC-OK  " : "ARC-FAIL"} ${line}`);
  if (!ok) failures += 1;
};

const hooks = await loadDigest();
const reference = loadJson(path.join(dir, "artifacts", "reference.json"));
const fixtures = fs.readdirSync(path.join(dir, "fixtures"))
  .filter((f) => f.endsWith(".json")).sort()
  .map((f) => loadJson(path.join(dir, "fixtures", f)));

const ref = runChecks({ artifact: reference, fixtures, hooks });
check(ref.pass, `reference.json passes all ${fixtures.length} fixtures`);

for (const arc of ARCS) {
  const broken = loadJson(path.join(dir, "artifacts", arc.broken));
  if (arc.invalid) {
    let code = null;
    try {
      runChecks({ artifact: broken, fixtures, hooks });
    } catch (e) {
      if (e instanceof XformError) code = e.code;
      else throw e;
    }
    check(code === "INVALID_ARTIFACT", `${arc.criterion}: ${arc.broken} rejected static (${code})`);
    const arcFix = fixtures.filter((f) => f.id === arc.fixture);
    const green = runChecks({ artifact: reference, fixtures: arcFix, hooks });
    check(green.pass, `${arc.criterion}: reference turns ${arc.fixture} green (ROW_LIMIT as designed)`);
    continue;
  }
  const arcFix = fixtures.filter((f) => f.id === arc.fixture);
  const bad = runChecks({ artifact: broken, fixtures: arcFix, hooks });
  const red = !bad.pass && bad.results.length === 1 && !bad.results[0].pass;
  check(red, `${arc.criterion}: ${arc.broken} FAILS ${arc.fixture} (${red ? bad.results[0].detail : "unexpectedly passed"})`);
  const green = runChecks({ artifact: reference, fixtures: arcFix, hooks });
  check(green.pass, `${arc.criterion}: reference turns ${arc.fixture} green`);
  const full = runChecks({ artifact: broken, fixtures, hooks });
  console.log(`   info: ${arc.broken} fails ${full.results.filter((r) => !r.pass).length}/${fixtures.length} overall: ` +
    full.results.filter((r) => !r.pass).map((r) => r.fixture_id).join(", "));
}

process.exit(failures === 0 ? 0 : 1);
