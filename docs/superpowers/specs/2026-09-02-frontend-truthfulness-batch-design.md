# Frontend Truthfulness Batch Design

## Status

- Approved in brainstorming on 2026-09-02.
- Frontend baseline: `origin/main@b2827dae16e89b199b487ab1564246b7b66e34f6`.
- Backend contract baseline: `release/0.2.5@45f7323e34f6f6db11faee658144e28d338b36be`.
- Runtime mode under acceptance: `VITE_DATA_SOURCE=backend`.

## Objective

Correct the A-G frontend truthfulness defects without changing the backend contract. Backend mode must show only server-authoritative facts and must never fall back to Mock fixtures, local reducers, timers, localStorage, inferred identifiers, or locally synthesized success states. Mock mode keeps its existing prototype behavior.

## Visual Freeze

This batch is owned as data-layer and logic wiring. Product Management retains ownership of UI components and visual design.

The implementation therefore must:

- not modify any file under `src/组件/**`;
- not create a new visual or shared component;
- not modify CSS;
- not add, move, or redesign cards, rows, lists, panels, or other visual structures;
- reuse the pages' current banners, empty states, text sections, bubbles, quick-action slots, and primary action slots;
- limit visible changes to required copy, authoritative facts, status/disabled changes, conditional visibility, and role-correct navigation;
- allow page-level conditional rendering and ARIA changes when they reuse the existing slots and styles.

The requirements necessarily produce some visible differences: corrected wording, different button states, additional CandidateJob facts in existing text slots, and removal of fake Backend Agent statistics, conversations, quick questions, and input. Those changes are content/state corrections, not component or layout design.

## Architecture

Use thin pure mappings and the existing operation layer.

- Pages continue to read the data source, authoritative snapshots, and operations from `use应用状态`.
- All HTTP continues through the existing operations. Pages do not create a parallel fetch or cache path.
- Existing subject, role, session, visible-scope, request-scope, and route generation fences remain authoritative for late-response rejection.
- `后端状态.岗位快照`, `候选岗位推荐`, `招聘可用候选`, delegation receipts, and P5 snapshots remain the only Backend in-memory facts.
- Shared additions are limited to pure organization-prerequisite, CandidateJob projection, delegation-presentation, and safe-navigation decisions.
- No new BFF field, enum, error code, idempotency contract, or permissive decoder is introduced.

## A. Intention Workplace-Mode Validation

The save action must remain operable when required values are missing so submission can provide a reason. New and edit routes use the same synchronous validator before the existing mutation.

Validation order is work city, desired role, then workplace mode. Any failure produces zero mutation. Workplace-mode failure uses the existing `轻提示` with `请选择办公方式`, scrolls the current workplace-mode group into view if needed, focuses its first button, and sets `aria-invalid="true"` plus `aria-description="请选择办公方式"` on the existing group. It adds no inline error row, DOM element, or CSS.

Selecting any workplace mode clears the invalid state. A valid submission continues through the existing intention mutation, the user's exact workplace-mode wire values, revision/`If-Match`, and authoritative reread. No default onsite, hybrid, or remote value is supplied.

Form errors are local to the current create/edit session and clear on successful save, exit, or route target change.

## B. Recruiter Recommendation Organization Prerequisite

The current active job's authoritative source is `后端状态.岗位快照[currentJobId]`. A pure selector returns:

- `unknown` when the owner Job snapshot has not arrived;
- `blocked` when the snapshot exists but `hiring_organization_verification_status !== 'verified'`, or its `hiring_organization_ref` is absent/blank;
- `ready` only when the status is `verified` and the ref is non-blank.

The selector must not inspect company display names, recruiter profiles, affiliation counts, free claims, or fixtures.

For `unknown`, the page reuses its existing loading/empty-state slot and sends no refresh mutation. For `blocked`, it reuses the existing Agent banner, empty-state copy, and bottom supply-action slot to explain the verified-organization prerequisite. The banner navigates to `路径.企业实名认证`; the supply-action slot changes to `加入企业` and navigates to `路径.企业邀请加入`. No new alert or CTA component is added. The disabled refresh reason is exposed through the existing button's accessible name/description, and activation is guaranteed to send zero refresh mutation.

For `ready`, existing list, refresh, feedback, delegation, privacy, and Mock behavior remain unchanged.

The legacy `recommendation_unavailable` error maps to the organization guidance only when all of these remain true at presentation time:

1. the structured error code is exactly `recommendation_unavailable`;
2. the active job is still the same job that owned the request;
3. that job's current owner snapshot proves `blocked`.

Without that evidence, the current generic unavailable/retry path remains. A 401, 503, unknown error, missing snapshot, role change, job change, or session change must never be described as an organization-verification problem.

## C. Candidate Job Deep-Link Recovery and Safe Return

The job detail keeps the current rule that recommendation coordinates come only from the active intention.

Recovery proceeds as follows:

1. If the active intention's successful recommendation snapshot is already in memory, search it without a request.
2. If Backend session hydration is incomplete, wait for the existing candidate-intention hydration; do not create a second intention reader.
3. Once the current active `intention_id` is known, call the existing `加载候选岗位(intentionId)` only when that scope snapshot is missing or not successfully loaded.
4. Restore coordinates only from a card whose `intention_id` equals the active intention and whose `job.job_id` equals the route job ID.
5. Restore that card's `recommendation_id`, `intention_id`, and latest delegation summary.

The standalone CandidateJob detail read can proceed independently for readable job facts. It must never supply or synthesize recommendation coordinates. No other intention is scanned, even if it contains the same job ID.

When CandidateJob is readable but the active intention has no matching recommendation, the existing detail remains read-only. The existing primary action slot changes to a clear unavailable explanation and is disabled; recommendation feedback and delegation remain zero-mutation. No new explanatory component is added.

Market-to-detail navigation writes a finite internal source marker through the existing navigation state API. Safe return behaves as follows:

- a recognized in-app source with a valid prior history entry uses normal back navigation;
- a direct link, refreshed link, absent marker, or untrusted history first dispatches the existing `职位` tab and `看市场` subview state, then replaces the location with `路径.主壳`;
- no `document.referrer`, blind `navigate(-1)`, external destination, `about:blank`, or Mock route is used.

Loading, error, 404, and normal detail headers use the same safe return decision.

## D. CandidateJob Facts and Job-Editing Copy

Extend the explicit `P4候选岗位页面` allowlist projection with facts sourced only from CandidateJob:

- location display name;
- workplace mode;
- office location;
- annual salary months;
- structured experience requirement;
- structured education requirement;
- description;
- requirements.

The existing detail text/fact slots consume this projection. The JSX must not read raw DTOs or query the Mock detail table in Backend mode.

Display rules are:

- show city and mapped workplace mode from the wire;
- show office location only when non-blank;
- for remote plus blank office location, emit no empty label or separator;
- show `X 薪` only when `annual_salary_months` is non-null;
- never infer a 12-month default;
- describe experience and education as structured requirements configured on the job;
- present `requirements` as candidate-facing requirements/supplemental text, without claiming that its natural language participated in automatic matching;
- show match score/reasons only when a recommendation card supplies them; a standalone CandidateJob does not render a fabricated zero-score result.

On the job create/edit page, no helper block is added. Existing labels change to `经验要求（自动匹配读取）`, `最低学历（自动匹配读取）`, and `给候选人看的职位要求（补充文字，不自动解析为硬门槛）`. Existing ARIA labels receive the same truthful wording.

No listener, regular expression, keyword rule, or model parses the textarea. Copy changes do not alter structured selections or payloads.

## E. P4 Delegation State Truthfulness

A closed pure presentation map is shared by candidate/recruiter cards and details:

| State | Backend copy | In progress | Case navigation |
| --- | --- | --- | --- |
| `accepted` | 已提交给 AI，等待处理 | yes | none |
| `evaluating` | AI 正在评估 | yes | none |
| `case_started` | 已创建真实在谈 | no | non-blank server `case_id` only |
| `needs_user` | 需要你处理 | no | existing contract-authorized entry only |
| `refused` | 本次未能继续 | no | none |
| `failed` | 本次处理未完成 | no | none |

Only `accepted` and `evaluating` enter the existing poller. All other states clear in-progress styling and polling. Every Backend delegation-summary slot uses the closed table above, so Backend occurrences of `AI代理已接手` and `已开始沟通` are removed. Mock copy and reducers remain unchanged.

When the same delegation's authoritative receipt remains available, `refused` may use the existing closed refusal-code copy. After reload, if the recommendation summary contains only the state, it uses the generic safe copy and does not infer a reason.

The existing primary status/action slot is reused. For `case_started`, it becomes `查看进展` only when the backend `case_id` is non-blank:

- candidate navigates to `路径.在谈详情(caseId)`;
- recruiter navigates to `路径.候选详情(caseId)`.

No job, recommendation, delegation, alias, or local-array value is converted into a Case ID. Missing `case_id` means no CTA. Existing list rereads restore the latest delegation summary; existing delegation GET can update the same delegation. Unknown states continue to fail closed in the strict decoder.

Whether a terminal delegation may be initiated again remains governed by the current business conditions, resume selection, and disclosure flow. This batch adds no retry policy.

P5 lists/details continue to load MatchCases authoritatively. P4 CTA, P5 list, and P5 detail must use the same server `case_id`. A Case 404 uses the existing safe state and returns to the role-correct Case list, never a Mock Case.

## F. P5 Agent Semantics and Screening Boundary

Keep the 17-row lifecycle/stage/status/step matrix, `needs_action`, `available_actions`, and the action intersection algorithm unchanged. Change only the existing closed step-copy table:

```text
candidate_evaluation  -> 候选方 AI 正在评估岗位
recruiter_answer      -> 等待招聘方 AI 回答补充问题
screening_resume      -> 招聘方 AI 正在初筛已提交简历
coordinating          -> 双方 AI 正在核对剩余差异
```

No five-step visual block is introduced. The existing step/status text slot must distinguish:

- `awaiting_resume_parse`: server parse/readiness;
- `screening_resume`: recruiter AI screening of the submitted resume;
- `awaiting_recruiter_decision`: waiting for the recruiter's manual decision.

Candidate PDF selection/submission copy, server-readiness copy, AI-screening copy, and the existing `decide_resume_screening` action copy must not imply that one stage proves another succeeded. Parse success is not AI screening success; AI screening is not recruiter acceptance.

Candidate viewers retain their current attachment and action privacy. Buttons remain exactly the intersection of the matrix row's allowlist and `available_actions`. `attention_required` stays neutral as `需注意`, gains no inferred cause, and gains no Agent retry. Terminal/history views do not show in-progress Agent wording.

## G. Backend/Mock Agent Page Isolation

Each Agent page branches on `数据源模式` before initializing Mock conversation state or effects.

Mock mode retains its current briefings, funnel, quick questions, input, keyword replies, and prototype rule behavior. Mock reply timer handles are tracked and cancelled on unmount/data-source switch so a queued reply cannot survive into Backend mode.

Backend mode does not instantiate or render fixture statistics, fixture conversations, quick questions, sendable input, keyword reply logic, or timers. It reuses the current page shell, existing Agent bubble slot, and existing quick-action button row:

- the candidate bubble says `真实匹配与委托请从「市场」进入，真实阶段请到「在谈」查看，长期规则请到「规则库」设置。当前 Backend 模式暂不提供自由对话、日报和漏斗。`;
- the recruiter bubble says `真实匹配与委托请从「推荐」进入，真实阶段请到「在谈」查看，长期规则请到「AI 代理设置」提交。当前 Backend 模式暂不提供自由对话、日报和漏斗。`;
- the candidate quick-action slots become `去市场`, `看在谈`, and `规则库`;
- the recruiter quick-action slots become `看推荐`, `看在谈`, and `AI代理设置`;
- the existing input slot is not rendered.

Candidate CTAs select and navigate to market, Cases, and the candidate rule library. Recruiter CTAs select and navigate to recommendations, Cases, and recruiter Agent settings. Navigation uses existing routes and reducer actions; it adds no new route or component.

The current Backend initialization gate remains the first defense against Mock flash. The page-level synchronous data-source branch is the second. Network failure, logout, first hydration, and source switching never choose the Mock branch as a fallback.

All call sites that navigate to `路径.问AI代理` or `路径.企业问AI代理` are audited. In Backend mode, their existing action text becomes `查看代理功能 ›`, not copy that promises live free-form chat. Mock wording remains unchanged.

## Error, Concurrency, and Isolation Rules

- 401 continues through the existing session cleanup.
- Job or Case 404 enters the existing safe unavailable state.
- 503 and unknown errors remain generic and are never reclassified as organization verification.
- An unknown mutation outcome never displays success or creates a Case.
- Refresh and delegation keep their current idempotency keys.
- List, detail, and delegation reads keep their current single-flight behavior.
- Late responses must pass the existing subject, role, session, visible-scope, request-scope, and route fences.
- Job, intention, role, account, route, and data-source changes clear or rederive page-local errors, dialogs, and prerequisites for the new scope.
- Backend failures never read Mock fixtures, reducers, localStorage, delayed callbacks, or synthetic success state.

## Implementation Slices

### Slice 1: Form and Detail Truthfulness

Deliver A and D: intention validation, CandidateJob allowlist, detail projection, job-form copy, and their mapping/component tests.

### Slice 2: Discovery, Delegation, and Case

Deliver B, C, E, and F: organization prerequisite, active-intention recovery, safe return, closed P4 state presentation, server Case navigation, and P5 copy boundaries. This slice has one writer because its operation, poller, routing, and P4/P5 files overlap.

### Slice 3: Backend/Mock Agent Isolation

Deliver G: mode-first page branches, Mock timer cleanup, existing-slot Backend explanation/CTAs, and entry-copy audit.

One integration owner combines and verifies all slices. No slice creates a shared UI component or new state layer.

## Expected File Scope

Primary code scope:

```text
src/屏幕/添加意向.tsx
src/屏幕/候选推荐.tsx
src/屏幕/看市场.tsx
src/屏幕/职位详情.tsx
src/屏幕/匿名在线简历.tsx
src/屏幕/发布岗位.tsx
src/屏幕/在谈首页.tsx
src/屏幕/企业在谈候选.tsx
src/屏幕/P5/MatchCase列表.tsx
src/屏幕/P5/MatchCase历史.tsx
src/屏幕/P5/MatchCase详情.tsx
src/屏幕/问AI代理.tsx
src/屏幕/企业问AI代理.tsx
src/数据/发现推荐映射.ts
src/数据/MatchCase展示映射.ts
src/数据/招聘数据源类型.ts
src/状态/后端/发现推荐操作.ts
src/状态/后端/use发现推荐委托轮询.ts
src/路由/导航钩子.ts
```

Corresponding tests may change. Files under `src/组件/**`, all CSS, and `src/数据/BFF契约.ts` are excluded. The inspected BFF types already contain every required OwnerJob, CandidateJob, delegation, and MatchCase field/state.

## Testing

Targeted tests must cover:

- create/edit intention validation, focus, ARIA, error clearing, and zero invalid mutation;
- organization prerequisite `unknown`, `blocked`, and `ready` states;
- unverified, missing-ref, and verified-plus-ref jobs;
- evidence-qualified versus generic `recommendation_unavailable` handling;
- 401, 503, and unknown errors without verification misclassification;
- active-intention deep-link recovery and duplicate job IDs across intentions;
- rejection of late responses after route, role, subject, or session change;
- normal in-app back and no-history replacement to candidate market;
- CandidateJob null, remote, onsite, hybrid, office, and salary-month combinations;
- all six P4 delegation states, polling boundaries, and Case CTA rules;
- no Case CTA without a server Case ID and no local Case creation after refusal/failure;
- the unchanged 17-row P5 matrix and fail-closed illegal combinations;
- distinct parse, AI-screening, and manual-decision wording;
- Backend Agent DOM without fixture statistics, conversation, input, or timer behavior;
- Mock Agent behavior and timer cleanup after mode switching;
- a guard that no file under `src/组件/**` and no CSS file changed in this batch.

Implementation verification must run the repository's current gates:

```text
npm run test -- <target test files>
npm run typecheck
npm run lint
npm run build
```

Final acceptance uses `VITE_DATA_SOURCE=backend` against the unchanged frozen Backend baseline and performs the nine handoff browser scenarios. Mock mode is sampled for regression. Real Hosted Agent task completion is not an acceptance prerequisite.

## Non-Goals

- PDF parse-result prefilling.
- Agent chat, briefing, or funnel APIs.
- Future organization/delegation failure codes or states.
- Hub, Runtime, global identity, or tenant changes.
- JD parsing or upload expansion.
- Natural-language requirement inference.
- Backend-to-Mock fallback.
- Locally synthesized recommendations, Agent successes, or Cases.
- Backend product changes or unrelated frontend refactoring.
