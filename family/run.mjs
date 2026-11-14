// family/run.mjs — csv-xform/1 check CLI (INTERFACES §4, frozen shape).
// usage: node family/run.mjs <artifact.json> <fixtures-dir> --out <results.json>
// exit 0 = all fixtures pass, 1 = >=1 fixture failed, 2 = invalid input.
import fs from "node:fs";
import path from "node:path";
import { ENV_ID, XformError, runChecks } from "./xform.mjs";
import { loadDigest } from "./digest.mjs";

function usage() {
  return "usage: node family/run.mjs <artifact.json> <fixtures-dir> --out <results.json>";
}

function parseArgs(argv) {
  const positionals = [];
  let out = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--out") {
      if (out !== null || i + 1 >= argv.length) return { error: "--out given twice or without a path" };
      out = argv[i + 1];
      i += 1;
    } else if (a.startsWith("--out=")) {
      if (out !== null) return { error: "--out given twice" };
      out = a.slice("--out=".length);
      if (out === "") return { error: "--out needs a path" };
    } else if (a.startsWith("--")) {
      return { error: `unknown flag ${a}` };
    } else {
      positionals.push(a);
    }
  }
  if (positionals.length !== 2) return { error: usage() };
  return { artifactPath: positionals[0], fixturesDir: positionals[1], out };
}

function readJsonFile(p, what) {
  let raw;
  try {
    raw = fs.readFileSync(p, "utf8");
  } catch {
    throw new XformError("INVALID_INPUT", "cli", `cannot read ${what}: ${p}`, {});
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new XformError("INVALID_INPUT", "cli", `bad JSON in ${what}: ${p}`, {});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.error) {
    console.error(`run.mjs: ${args.error}`);
    process.exit(2);
  }
  const hooks = await loadDigest();
  try {
    const artifact = readJsonFile(args.artifactPath, "artifact");
    let names;
    try {
      names = fs.readdirSync(args.fixturesDir).filter((f) => f.endsWith(".json")).sort();
    } catch {
      throw new XformError("INVALID_INPUT", "cli", `cannot read fixtures dir: ${args.fixturesDir}`, {});
    }
    if (names.length === 0) {
      throw new XformError("INVALID_INPUT", "cli", `no fixtures (*.json) in ${args.fixturesDir}`, {});
    }
    const fixtures = names.map((f) => {
      const fix = readJsonFile(path.join(args.fixturesDir, f), "fixture");
      const stem = f.slice(0, -".json".length);
      if (fix !== null && typeof fix === "object" && !Array.isArray(fix) && fix.id !== stem) {
        throw new XformError("INVALID_INPUT", "cli",
          `fixture id ${JSON.stringify(fix.id)} != filename stem ${stem} in ${f}`, {});
      }
      return fix;
    });
    const report = runChecks({ artifact, fixtures, hooks });
    const digest = hooks.sha256hex(hooks.canonicalize(artifact));
    const out = {
      artifact_digest: digest,
      digest_src: hooks.src,
      env_id: ENV_ID,
      pass: report.pass,
      counts: {
        total: report.results.length,
        pass: report.results.filter((r) => r.pass).length,
        fail: report.results.filter((r) => !r.pass).length,
      },
      results: report.results,
    };
    const text = JSON.stringify(out, null, 2);
    if (args.out) fs.writeFileSync(args.out, `${text}\n`);
    else console.log(text);
    console.log(`${report.pass ? "pass" : "fail"} ${out.counts.pass}/${out.counts.total} (env ${ENV_ID}, artifact ${digest.slice(0, 12)}...)`);
    process.exit(report.pass ? 0 : 1);
  } catch (e) {
    if (e instanceof XformError) {
      console.error(`run.mjs: ${e.code}: ${e.message}`);
      process.exit(2);
    }
    throw e;
  }
}

await main();
