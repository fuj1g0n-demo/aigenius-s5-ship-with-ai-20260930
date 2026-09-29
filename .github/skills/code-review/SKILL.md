---
name: code-review
description: Reviews pull requests for security and correctness in this staged Astro demo. Use for GitHub Copilot Code Review of PR diffs, not for implementation or general coding tasks.
---

# Pull request review

Use this guidance only when reviewing a pull request. Read `demo-kit.json` and
the presenter guides before evaluating changes to the release sequence: an
intentionally blocked deployment is not necessarily a defect.

- Check changed GitHub Actions workflows for least-privilege `GITHUB_TOKEN`
  permissions. Grant write scopes only to jobs that need them, and use full
  commit SHAs rather than mutable tags or branches for `uses:` references.
- Trace user-controlled values from the UI to their persistence boundary.
  Check that required fields reject empty content, persisted text has
  reasonable length limits, and rejected submissions have a visible error
  path. Client-side form attributes alone do not protect storage functions.
- Evaluate changed behavior against its documented intent, tests, and
  security impact. Treat explanatory comments as context, not as a reason
  to overlook a remaining risk; report actionable findings on changed lines.
- Preserve the versioned demo start state and its separate remediation step
  unless the pull request explicitly calls for changing them.
