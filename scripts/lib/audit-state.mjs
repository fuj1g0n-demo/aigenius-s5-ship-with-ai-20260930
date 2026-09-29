export function resolveAuditState(requestedState, packageJson, manifest) {
  if (requestedState !== 'auto') {
    return requestedState;
  }
  return packageJson.dependencies?.marked === manifest.startState.dependencies.marked
    ? 'start'
    : 'clean';
}

export function validateAuditState(report, expectedState, policy) {
  if (!['start', 'clean'].includes(expectedState)) {
    return { valid: false, message: 'Expected audit state must be "start" or "clean".' };
  }

  const counts = report?.metadata?.vulnerabilities;
  if (
    report?.error ||
    !counts ||
    ![counts.high, counts.critical].every((count) => Number.isInteger(count) && count >= 0) ||
    !report.vulnerabilities ||
    typeof report.vulnerabilities !== 'object' ||
    Array.isArray(report.vulnerabilities)
  ) {
    return { valid: false, message: 'Audit report contains an error or is missing valid vulnerability counts or findings.' };
  }
  const findings = Object.entries(report.vulnerabilities);
  if (findings.some(([, finding]) => !['info', 'low', 'moderate', 'high', 'critical'].includes(finding?.severity))) {
    return { valid: false, message: 'Audit report contains a finding without a valid severity.' };
  }
  const highPackages = findings
    .filter(([, finding]) => finding.severity === 'high')
    .map(([name]) => name)
    .sort();
  if (
    counts.high !== highPackages.length ||
    counts.critical !== findings.filter(([, finding]) => finding.severity === 'critical').length
  ) {
    return { valid: false, message: 'Audit vulnerability counts do not match the reported findings.' };
  }

  if (expectedState === 'start') {
    const expectedPackages = [...policy.packages].sort();
    const valid =
      highPackages.length === expectedPackages.length &&
      highPackages.every((name, index) => name === expectedPackages[index]) &&
      counts.high === policy.high &&
      counts.critical === policy.critical;

    return {
      valid,
      message: valid
        ? 'Audit matches the expected demo start state.'
        : 'Start state must contain only the expected high-severity package findings and no unexpected critical findings.',
    };
  }

  const valid =
    counts.high === policy.high &&
    counts.critical === policy.critical;
  return {
    valid,
    message: valid
      ? 'Audit matches the expected clean state.'
      : 'Clean state must contain no high or critical audit findings.',
  };
}
