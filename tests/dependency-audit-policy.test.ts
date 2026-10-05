import assert from "node:assert/strict";
import test from "node:test";
import { evaluateDependencyAudit } from "../scripts/dependency-audit-policy.mjs";

const advisory = { name: "upstream", severity: "high", url: "https://github.com/advisories/GHSA-test" };
const exception = { scope: "root", package: "upstream", advisory: advisory.url, severity: "high",
  reason: "No compatible patch; tracked, not resolved", issue: "https://example.test/issues/1", expires: "2026-11-04" };
const now = new Date("2026-10-04T00:00:00Z");
const report = (via = [advisory]) => ({ auditReportVersion: 2,
  metadata: { vulnerabilities: { high: 2, critical: 0, total: 2 } },
  vulnerabilities: { wrapper: { severity: "high", via: ["upstream"] }, upstream: { severity: "high", fixAvailable: false, via } } });

test("dependency audit reports reviewed upstream advisory and inherited packages", () => {
  const checked = evaluateDependencyAudit(report(), [exception], "root", now);
  assert.equal(checked.known.length, 1);
  assert.equal(checked.counts.high, 2);
});

test("dependency audit rejects unreviewed advisory, different scope and changed severity", () => {
  assert.throws(() => evaluateDependencyAudit(report(), [], "root", now), /Unreviewed/);
  assert.throws(() => evaluateDependencyAudit(report(), [exception], "website", now), /Unreviewed/);
  assert.throws(() => evaluateDependencyAudit(report([{ ...advisory, severity: "moderate" }]), [exception], "root", now), /Unreviewed/);
});

test("dependency audit never exempts critical findings", () => {
  const input = report();
  input.vulnerabilities.wrapper.severity = "critical";
  assert.throws(() => evaluateDependencyAudit(input, [exception], "root", now), /Critical/);
  assert.throws(() => evaluateDependencyAudit(report([{ ...advisory, severity: "critical" }]), [exception], "root", now), /Critical/);
  assert.throws(() => evaluateDependencyAudit(report(), [{ ...exception, severity: "critical" }], "root", now), /Invalid/);
});

test("dependency audit exceptions expire and require tracking context", () => {
  assert.throws(() => evaluateDependencyAudit(report(), [exception], "root", new Date("2026-11-05T00:00:00Z")), /expired/);
  assert.throws(() => evaluateDependencyAudit(report(), [{ ...exception, reason: "" }], "root", now), /Invalid/);
});

test("dependency audit fails closed on missing, failed or incomplete reports", () => {
  for (const input of [{}, { error: { code: "NETWORK" } }, { auditReportVersion: 2 }]) {
    assert.throws(() => evaluateDependencyAudit(input, [], "root", now), /complete/);
  }
  const input = report();
  delete (input.vulnerabilities as Record<string, unknown>).upstream;
  input.metadata.vulnerabilities.total = 1;
  assert.throws(() => evaluateDependencyAudit(input, [exception], "root", now), /Incomplete/);
});

test("dependency audit requires re-review when a fix becomes available", () => {
  const input = report();
  input.vulnerabilities.upstream.fixAvailable = true;
  assert.throws(() => evaluateDependencyAudit(input, [exception], "root", now), /fix may now/);
});

test("dependency audit accepts clean report without masking raw results", () => {
  const input = { auditReportVersion: 2, metadata: { vulnerabilities: { total: 0 } }, vulnerabilities: {} };
  assert.deepEqual(evaluateDependencyAudit(input, [], "website", now), { counts: { total: 0 }, known: [] });
});

test("dependency audit permits only an explicitly reviewed no-effective-fix report", () => {
  const input = report([{ ...advisory, range: "<=6.6.1" }]);
  input.vulnerabilities.upstream.fixAvailable = true;
  const reviewed = { ...exception, reviewedFixAvailable: {
    value: true, advisoryRange: "<=6.6.1", reason: "Suggested compatible update applied; vulnerable primitive remains" } };
  assert.equal(evaluateDependencyAudit(input, [reviewed], "root", now).known.length, 1);
  assert.throws(() => evaluateDependencyAudit(input, [{ ...reviewed, reviewedFixAvailable: {
    ...reviewed.reviewedFixAvailable, advisoryRange: "<=6.6.0" } }], "root", now), /fix may now/);
  const concreteFix = structuredClone(input);
  (concreteFix.vulnerabilities.upstream as { fixAvailable: unknown }).fixAvailable = { name: "upstream", version: "2.0.0", isSemVerMajor: true };
  assert.throws(() => evaluateDependencyAudit(concreteFix, [reviewed], "root", now), /fix may now/);
  assert.throws(() => evaluateDependencyAudit(input, [{ ...reviewed, reviewedFixAvailable: {
    ...reviewed.reviewedFixAvailable, reason: "" } }], "root", now), /Invalid/);
});
