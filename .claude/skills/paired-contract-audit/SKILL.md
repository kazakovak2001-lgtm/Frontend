---
name: paired-contract-audit
description: Runs a read-only, implementation-first audit of the exact Frontend/backend paired release, truthful workspace behavior, project isolation, security, accessibility, tests, and release evidence.
argument-hint: "[optional target or commit range]"
disable-model-invocation: true
---

# Paired contract audit

Audit `$ARGUMENTS` when supplied; otherwise audit the current Frontend HEAD against the exact backend candidate in `config/integration/paired-release.json`.

This workflow is read-only. Do not edit, commit, merge, push, change branches or pins, rewrite history, or modify external state. Inspect implementation and tests before accepting documentation claims. Treat older audits as historical evidence.

Coordinate independent reviews with these project agents:

1. `frontend-architecture-auditor`: trace routes, contexts, services, truthful read models, project isolation, stale work, SSR, and current authority.
2. `backend-contract-reviewer`: compare REST, Socket.IO, authentication, autonomous, generation, and Studio contracts with the exact paired backend source when available.
3. `test-engineer`: in read-only mode, map invariants to unit, integration, production-pair, responsive, build, and bundle evidence; do not add or change tests.
4. `security-reviewer`: audit credential handling, project/user boundaries, untrusted data, browser sinks, configuration, and failure behavior.
5. `accessibility-reviewer`: audit keyboard, focus, semantics, forms, status communication, and responsive behavior without claiming unperformed manual checks.
6. `release-reviewer`: verify exact commits, clean state, protected CI gates, runtime pair evidence, and Lovable-safe history.

Run independent reviews in parallel when possible. Require every material statement to be classified as `FACT`, `INFERENCE`, `GAP`, `RISK`, or `RECOMMENDATION` with precise evidence. Cross-check conflicting claims instead of averaging them.

Return:

1. Scope, exact Frontend HEAD, backend pin, and worktree state.
2. An invariant-to-evidence matrix.
3. Ranked findings with the required classifications.
4. Commands run and exact outcomes, separating failures from checks not run.
5. Both an implementation verdict (`CONFORMANT`, `NON-CONFORMANT`, or `INSUFFICIENT EVIDENCE`) and release verdict (`READY`, `NOT READY`, or `INSUFFICIENT EVIDENCE`).
6. The smallest recommended next vertical slice. Do not implement it.
