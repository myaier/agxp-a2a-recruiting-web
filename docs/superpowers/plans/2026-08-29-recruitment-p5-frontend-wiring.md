# Recruitment P5 Frontend Wiring Plan Index

> **Status:** Superseded by two independently acceptable plans. Do not execute the former monolithic plan from Git history.

The P5 frontend work is intentionally split so useful contract-independent work can proceed while the backend closes its four required gaps.

## Plan 1 — Execute Now

`docs/superpowers/plans/2026-08-29-recruitment-p5-frontend-foundation.md`

Independent deliverables:

- opt-in JSON/PDF `Request.cache = 'no-store'` transport seam;
- explicit P4 attachment PDF file/version selection and exact delegation body;
- closed S0 supplementary-question resolver;
- one-shot PDF object-URL lease;
- full frontend verification with no P5 read DTO or page wiring.

Its completion statement must remain:

```text
P5 frontend foundation complete; contract-gated wiring not started.
```

## Plan 2 — Recalibrate After Backend Completion

`docs/superpowers/plans/2026-08-29-recruitment-p5-frontend-contract-wiring.md`

This plan owns the final P5 workspace/history/detail/actions/archive/handoff UI. It currently carries status `BLOCKED_PENDING_FINAL_BACKEND_RECALIBRATION` and must not be executed until the frontend owner audits one clean final backend HEAD, records the exact schema/matrix/test evidence, and commits a `READY_FOR_EXECUTION` recalibration.

## Shared Design

`docs/superpowers/specs/2026-08-29-recruitment-p5-frontend-wiring-design.md`

P5.1 rich presentation and P7 conversation publication remain outside both plans.
