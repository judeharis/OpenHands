// Compare a phone-test run with a baseline: taps, time, what was approved without a tap.
// usage: node compare.mjs <baseline: name in baselines/ or a path> <run: name under /tmp/phone-test or a path>
import fs from "fs";
const [b, r] = process.argv.slice(2);
const resolve = (x) => [x, `baselines/${x}.json`, `/tmp/phone-test/${x}/log.json`].find((p) => fs.existsSync(p));
const load = (x) => JSON.parse(fs.readFileSync(resolve(x), "utf8"));
const base = load(b), run = load(r);
const secs = (d) => Math.round(d.totalSec ?? 0);
const bugs = (d) => (d.log || []).filter((e) => e.kind === "bug").length;
const row = (name, a, c) => {
  const delta = typeof a === "number" && typeof c === "number" ? `${c - a >= 0 ? "+" : ""}${c - a}` : "";
  console.log(`${name.padEnd(30)} ${String(a).padStart(8)} ${String(c).padStart(8)} ${delta.padStart(8)}`);
};
console.log(`${"".padEnd(30)} ${"baseline".padStart(8)} ${"run".padStart(8)} ${"delta".padStart(8)}`);
row("taps", base.approvals ?? 0, run.approvals ?? 0);
row("  of which Allow for session", base.allows ?? 0, run.allows ?? 0);
row("wall time (s)", secs(base), secs(run));
row("agent actions", base.actions ?? "n/a", run.actions ?? "n/a");
row("approved without a tap", base.autoApproved ?? "n/a", run.autoApproved ?? "n/a");
row("scrolls to reach the panel", base.scrolls ?? 0, run.scrolls ?? 0);
row("panel missing while waiting", base.missingPanel ?? 0, run.missingPanel ?? 0);
row("bugs logged", bugs(base), bugs(run));
const confirms = (run.log || []).filter((e) => e.kind === "confirm");
console.log("\nrun confirms:", confirms.map((e) => `${e.actionKinds || "?"}${e.risk ? `/${e.risk}` : ""}${e.count > 1 ? `x${e.count}` : ""}`).join("  ") || "none");
console.log("run actions by kind:", JSON.stringify(run.actionsByKind || {}));
