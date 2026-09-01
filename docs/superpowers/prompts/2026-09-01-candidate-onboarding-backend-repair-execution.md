# Candidate Onboarding Backend Repair — Execution Prompt

You are implementing the already-approved candidate-onboarding Backend repair in this repository.

## Required workflow

1. Do **not** invoke `/development-workflow`.
2. Use `superpowers:subagent-driven-development` (recommended) to execute the plan task-by-task. If that skill is unavailable, use `superpowers:executing-plans`.
3. Before editing, read both documents completely:
   - `docs/superpowers/specs/2026-09-01-candidate-onboarding-backend-repair-design.md`
   - `docs/superpowers/plans/2026-09-01-candidate-onboarding-backend-repair.md`
4. Treat the Spec as the product/architecture authority and the Plan as the exact implementation sequence. If they appear inconsistent, stop and report the exact conflict rather than silently choosing a third design.
5. Work in the existing isolated worktree and branch:
   - worktree: `/Users/visionclaw/.paseo/worktrees/09eyc7i7/skillful-snake`
   - branch: `fix/candidate-onboarding-backend-persist`
   - reviewed document HEAD: `db9ee9c7`
6. Start with `git status --short`. Preserve all pre-existing user changes and never reset, overwrite, or include unrelated files in a task commit.
7. Update the Plan's checkboxes as tasks complete. Follow every task's TDD order: write the regression, run it and confirm the intended red reason, implement minimally, run focused green tests, then commit.
8. Use the exact per-task commit messages in the Plan unless a narrowly discovered defect requires its own focused fix commit.
9. After the implementation, use `superpowers:requesting-code-review` and address verified findings. Before claiming completion, use `superpowers:verification-before-completion` and run the full matrix from the Plan.

## Frozen product decisions

- Backend mode never falls back to Mock after an API failure.
- Certificate `year` is a required property on both BFF read and write DTOs, with type `number | null`.
- A name-only certificate sends `year: null`; the page-domain value remains `年份: ''`.
- Non-null years are integers from `1900` through `2100`. Never invent the current year or send `0`, `NaN`, `'null'`, or a missing property.
- The product is not launched. Do not implement migration, legacy missing-`year` support, dual read/write, version negotiation, or rollout flags for this contract.
- `/api/v1/me/resume` and `/api/v1/me/intentions` remain authoritative after submission.
- All resume request bodies must be materialized and validated before the first mutation. Preserve ordered mutations, failure recovery GET, final authoritative GET, idempotency, and new-experience ID writeback.
- Catalog writes use only the selected `{ id, display_name }`; do not infer IDs from labels or select the first search result automatically.
- Candidate onboarding draft persistence is an allowlisted `sessionStorage` cache scoped by `backend + environment + subject_id`. It is never a resume cache.
- Clear the active candidate draft on logout, 401, candidate-to-recruiter transfer, and subject change. Never let `null === null` authorize a storage write.
- Backend `账号手机号` comes only from the unique P8 `phone_otp.display` and routes changes to account security. It is not a candidate disclosure contact.
- Backend `简历披露手机号`, email, and WeChat remain visible but read-only as `未接入`; do not dispatch Mock contact state or invent an endpoint.
- Annotation UI is absent by default and enabled only with `VITE_ANNOTATION_ENABLED=true`. Its launcher portals to the reserved review lane; its panels and overlay remain anchored inside the device frame.
- The strict mutable E2E fixture verifies frontend wire behavior. It is not a claim that a real BFF or the attachment parser was exercised.

## Scope boundaries

- Implement all eight Plan tasks, in order.
- Do not implement PDF-to-online-resume auto-fill or change parser invalid-output behavior.
- Do not edit the separate backend repository or its known-issue/design documents.
- Do not add frontend aliases for school, major, job, location, or industry catalog entries.
- Do not persist cookies, PDF bytes/text, resume content, credential objects, raw contact data, or model output.
- Do not create an intention directly to bypass onboarding pages or use URL jumps in the full-flow E2E.
- Do not add compatibility code while waiting for the Backend nullable contract. If the real joint Recruitment/BFF baseline is unavailable, finish unit/component/strict-fixture evidence and report real-service integration as blocked by that external prerequisite.

## Evidence and completion

For every task, retain concise evidence of:

- the focused failing command and the failure that proved the regression;
- the focused passing command after the minimal implementation;
- the files changed and task commit SHA.

At the end, run exactly:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e:data-source
```

Do not claim success unless every executed command exits 0. The final report must include:

- the certificate contract actually implemented;
- task-by-task files and commits;
- focused red/green evidence;
- all five full-verification exit results;
- final E2E mutation counts: one experience POST, one skills PATCH, one certificate POST with `{ name: 'CET-4', year: null }`, one education POST, and one intention POST;
- authoritative reload state: one experience, one skill, one education, one name-only certificate retaining `year: null`, and exactly one `status: 'active'` intention;
- whether a real nullable-contract Recruitment/BFF baseline was available and tested;
- an explicit statement that attachment parser invalid-output handling remains a separate backend item.

Begin by reading the two frozen documents and reporting the first task you will execute. Then execute; do not rewrite the approved architecture before starting.
