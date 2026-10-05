const severities = new Set(["info", "low", "moderate", "high", "critical"]);

/** Inspect leaf advisories, not just inherited package vulnerability counts. */
export function evaluateDependencyAudit(report, exceptions, scope, now = new Date()) {
  if (report?.error || report?.auditReportVersion !== 2 || !report?.metadata?.vulnerabilities ||
    !report.vulnerabilities || typeof report.vulnerabilities !== "object" || Array.isArray(report.vulnerabilities) ||
    !Number.isInteger(report.metadata.vulnerabilities.total) ||
    report.metadata.vulnerabilities.total !== Object.keys(report.vulnerabilities).length) {
    throw new Error("npm audit did not return a complete vulnerability report.");
  }
  const allowed = exceptions.filter(entry => entry.scope === scope);
  for (const entry of allowed) {
    if (!entry.package || !entry.advisory || !entry.reason || !entry.issue ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires) || !severities.has(entry.severity) || entry.severity === "critical" ||
      !Number.isFinite(Date.parse(`${entry.expires}T23:59:59Z`)) || now.getTime() > Date.parse(`${entry.expires}T23:59:59Z`)) {
      throw new Error(`Invalid or expired dependency audit exception: ${entry.package}`);
    }
    if (entry.reviewedFixAvailable && (entry.reviewedFixAvailable.value !== true ||
      !entry.reviewedFixAvailable.advisoryRange || !entry.reviewedFixAvailable.reason)) {
      throw new Error(`Invalid fix-availability review: ${entry.package}`);
    }
  }
  const findings = new Map();
  const visit = (name, path = new Set()) => {
    const item = report.vulnerabilities[name];
    if (!item || path.has(name) || !severities.has(item.severity) || !Array.isArray(item.via) || !item.via.length) {
      throw new Error(`Incomplete vulnerability chain: ${name}`);
    }
    if (item.severity === "critical") throw new Error(`Critical vulnerability is never exempted: ${name}`);
    const nextPath = new Set(path).add(name);
    for (const via of item.via) {
      if (typeof via === "string") { visit(via, nextPath); continue; }
      if (!via?.name || !via.url || !severities.has(via.severity)) throw new Error(`Malformed advisory: ${name}`);
      if (via.severity === "critical") throw new Error(`Critical advisory is never exempted: ${via.url}`);
      findings.set(`${via.name}:${via.url}`, { ...via, fixAvailable: item.fixAvailable });
    }
  };
  for (const name of Object.keys(report.vulnerabilities)) visit(name);
  const known = [];
  for (const finding of findings.values()) {
    const exception = allowed.find(entry => entry.package === finding.name && entry.advisory === finding.url && entry.severity === finding.severity);
    if (!exception) throw new Error(`Unreviewed ${finding.severity} advisory: ${finding.name} ${finding.url}`);
    if (exception.reviewedFixAvailable && exception.reviewedFixAvailable.advisoryRange !== finding.range) {
      throw new Error(`A fix may now be available or the affected range changed; review exception: ${finding.name}`);
    }
    if (finding.fixAvailable !== false && !(finding.fixAvailable === true &&
      exception.reviewedFixAvailable?.value === true &&
      exception.reviewedFixAvailable.advisoryRange === finding.range)) {
      throw new Error(`A fix may now be available; review exception: ${finding.name}`);
    }
    known.push({ ...finding, exception });
  }
  return { counts: report.metadata.vulnerabilities, known };
}
