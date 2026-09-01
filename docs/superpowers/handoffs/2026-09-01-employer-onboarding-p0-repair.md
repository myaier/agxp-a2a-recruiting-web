# Employer Onboarding P0 Repair Handoff

## Baselines
- Candidate onboarding implementation commit: `c8d9a17afe4c0ffc39f14d9cf66f040dd216a61e` (validated with `git cat-file -e`; final task commit of `fix/candidate-onboarding-backend-persist` at merge time)
- Employer Spec commit: `ea27b66e0e0dcbb56a1cf4d0f0d0b1bd1a2f5f0e` — see `docs/superpowers/specs/2026-09-01-employer-onboarding-repair-design.md` at branch history; Spec content frozen before execution and unchanged during it
- Employer Plan commit: `2eab89196f426bc386fba47de9e697de96ad57ab` (Plan SHA-256 `ad5ec355c10bcdd6d763a2f78d97b8d68bd0ac5ceb2dad6c9a3719bfc9c87e3b`, verified before execution)
- Execution baseline (predecessor merged into this worktree, `--no-ff`): `b174d7607445cc53ddd54ad63986a13783126f74`
- Pre-integration candidate commit: `59cd1ee6dfa3a0ba43ec30b3b1d33cc28e8a23e8`
- Final candidate commit (after merging remote target): `68935537d7a835eccfdc6f14aae2754ae2954af6`

Integration note: `origin/main` had advanced 4 commits beyond `c8d9a17a` by integration time (`32bc1456`, `09f447f7`, `f7dd9a27`, `e1493eed`), two of them product review-fixes to candidate onboarding persistence/prefill. `origin/main` was merged (never rebased) into this branch at `68935537`; the merge was conflict-free and brought in 3 files. All final evidence below was re-run on `68935537`.

## Task Commits and Files
| Task | Commit | Files |
| --- | --- | --- |
| 1 Model missing profiles + organization hydration lifecycle | `b76cdcc6`, `3de7d8cf` | `src/状态/后端/类型.ts`, `src/状态/后端/组织操作.ts(+test)`, `src/状态/后端/会话操作.ts(+test)`, `src/状态/应用状态.tsx(+test)`, and 7 `后端状态` test scaffolds requiring the two new fields |
| 2 Revision-zero creation + deterministic routing | `19d8b360`, `4b3c3890` | `src/应用.tsx`, `src/应用.test.tsx` (new), `src/屏幕/选身份.tsx(+test)`, `src/数据/招聘数据源/组织.test.ts`, `src/状态/后端/类型.ts`, `组织操作.ts(+test)`, `会话操作.ts(+test)`, `src/状态/应用状态.test.ts` |
| 3 Atomic recruiter card + company claim save | `7ea67872`, `c8f2dc32` | `src/屏幕/招聘名片.tsx(+test)`, `src/状态/后端/组织操作.ts(+test)` |
| 4 Independent requirements + complete JobCreate | `7b961c4e`, `241966b9` | `src/屏幕/发布岗位.tsx(+test)`, `src/数据/后端映射.ts(+test)`, `src/状态/后端/岗位操作.ts(+test)`, `src/数据/招聘数据源/岗位.test.ts`, `e2e/onboarding.spec.ts`, `e2e/换壳无闪屏.spec.ts`, `e2e/真实后端/旅程/招聘CRUD.sh` |
| 5 Truthful organization availability + verification | `52c69824`, `65c42d84` | `src/屏幕/招聘方组织门.tsx` (new), `公司档案编辑.tsx(+test)`, `公司档案分区编辑.tsx(+test)`, `企业设置.tsx(+test)`, `src/数据/组织映射.ts(+test)` |
| 6 Localized errors, neutral copy, zoom | `862dd7c7`, `0c2eadb3` | `src/数据/HTTP客户端.ts(+test)`, `src/屏幕/发布岗位.tsx(+test)`, `src/屏幕/账号安全.tsx(+test)`, `index.html`, `README.md`, `docs/前端修改指南.md`, `src/配置/viewport合同.test.ts` (new), `e2e/数据源模式.spec.ts`, 6 collateral test files |
| 7 Full onboarding data-source E2E | `a49b415d` | `e2e/数据源模式.spec.ts` |
| Review fixes | `c6bae88b` (Codex r1), `59cd1ee6` (final whole-branch wave) | `src/屏幕/发布岗位.tsx(+test)`, `src/数据/HTTP客户端.ts(+test)`, `src/应用.tsx(+test)`, `e2e/数据源模式.spec.ts` |
| Terminal integration merge | `68935537` | merge of `origin/main`; no conflicts |

## TDD Evidence
Every task ran RED before implementation, and each RED failed for the targeted product gap. Dependencies were installed first (`npm ci` exit 0, vitest 4.1.11 present), so no exit-127 was ever accepted as a product RED.

| Task | RED command/result | GREEN command/result |
| --- | --- | --- |
| 1 | `npm test -- src/状态/后端/组织操作.test.ts src/状态/后端/会话操作.test.ts src/状态/应用状态.test.ts` → exit `1`, 19 failed / 206 passed (two hydration fields and the 404 branch did not exist) | same command → exit `0`, 225 passed |
| 2 | `npm test -- src/数据/招聘数据源/组织.test.ts src/状态/后端/组织操作.test.ts src/状态/后端/会话操作.test.ts src/屏幕/选身份.test.tsx src/应用.test.tsx` → exit `1`, 10 failed / 151 passed (the data-source PATCH test already passed, as the Plan predicted) | same command → exit `0`, 161 passed |
| 3 | `npm test -- src/屏幕/招聘名片.test.tsx` → exit `1`, 5 failed / 18 passed (company still committed on blur; no `保存并继续`) | same command → exit `0`, 23 passed |
| 4 | `npm test -- src/状态/后端/岗位操作.test.ts src/数据/后端映射.test.ts src/数据/招聘数据源/岗位.test.ts src/屏幕/发布岗位.test.tsx` → exit `1`, 16 failed / 52 passed | same command → exit `0`, 68 passed |
| 5 | `npm test -- src/屏幕/公司档案编辑.test.tsx src/屏幕/公司档案分区编辑.test.tsx src/数据/组织映射.test.ts src/屏幕/企业设置.test.tsx` → exit `1`, 33 failed / 46 passed | same command → exit `0`, 79 passed |
| 6 | `npm test -- src/数据/HTTP客户端.test.ts src/屏幕/发布岗位.test.tsx src/屏幕/账号安全.test.tsx src/配置/viewport合同.test.ts` → exit `1`, 10 failed / 75 passed | same command → exit `0`, 85 passed |
| 7 | `npm run test:e2e:data-source -- --grep "新招聘方 onboarding"` → exit `1`, `ReferenceError: 创建招聘方OnboardingFixture is not defined` | same command → exit `0`, 1 passed (4.2s) |

Task 7 additionally repaired 3 pre-existing data-source E2E failures introduced by Tasks 2–6 (full suite 3 failed / 93 passed → 97 passed).

## Final Verification
All commands re-run on the final candidate commit `68935537` after merging `origin/main`.
Fixture/runtime/profile: node v26.3.0, vitest 4.1.11, jsdom 29, Playwright 1.62.1 with `channel: 'chrome'` against locally installed Google Chrome; dependencies from `npm ci` on the committed lockfile; data-source servers mock/stg `127.0.0.1:4181` and backend/stg `127.0.0.1:4182`, with all `/api/v1/*` route-fulfilled by in-spec fixtures.

| Command | Exit | Result |
| --- | ---: | --- |
| `npm test` | `0` | PASS — 127 files / 2096 tests |
| `npm run typecheck` | `0` | PASS |
| `npm run lint` | `0` | PASS |
| `npm run build` | `0` | PASS |
| `npm run test:e2e:data-source -- --grep "新招聘方 onboarding"` | `0` | PASS — 1 passed |
| `npm run test:e2e:data-source` (full suite) | `0` | PASS — 97 passed |
| `git diff --check` | `0` | PASS |
| `CI=true UI_VISUAL_GATE=report UI_CHANGE_APPROVED=false npm run ui:check -- --base c8d9a17a --output ui-regression-output/employer-onboarding-p0` | `0` | pass=17, warning=1, blocked=0, new=0, removed=0, **infrastructure=0** |

`npm test` is the single authoritative plan-scope gate; typecheck, lint, build and the intercepted data-source Playwright runs are orthogonal evidence.

Performance: total verification wall-clock ≈ 200s; slowest suite 76s. No `performance_observations` trigger (no suite ≥ 300s, total < 600s), and no unknown-path or global-review warning appeared in any evidence.

## Contract Proof
- First profile GET: **`404 not_found`**, and the app still proceeds to the recruiter card instead of failing the whole organization chain.
- First profile mutation: **`PATCH`**, **`If-Match: "0"`**, body exactly `{ public_name: '林澈', title: '招聘负责人' }`, response **`revision: 1`** — saved without any blur event.
- JobCreate response: **`201`**.
- Non-blank claim/description/requirements, captured by the fixture assertion and mutually distinct:
  - `hiring_organization_claim.display_name`: `星河科技`
  - `description`: `用户研究、产品验证、产品策略、实验、数据分析、需求执行、GTM、发布与增长`
  - `requirements`: `应届或毕业年级；有产品、技术、增长、分析或创业经历；关注 AI、SaaS、工作流、开发工具与 Agent`
- Refresh route and authoritative state: URL `/hr`, fixture profile `revision: 1`, owner job count `1`, with the seeded `Fixture 实习岗位` visible after reload. Honest caveat: the ≥2-profile-GET and 200-status counters can also be satisfied by mid-scenario navigation because the wizard helper issues its own `page.goto`; the genuine reload proof is the `/hr` URL plus the visible authoritative job.
- Candidate predecessor contracts preserved: `客户端校验错误(field, message)` (`src/数据/HTTP客户端.ts`, still checked first in `取后端错误文案`), `必需引用(value, label, field)` (`src/数据/后端映射.ts`, untouched; the new `必需岗位文本` is layered beside it), candidate-only subject-scoped sessionStorage drafts (`src/状态/资料持久化.ts`, no draft codec/key/clearing-order line touched by this Plan), `VITE_ANNOTATION_ENABLED` (`src/main.tsx`), and the candidate mutable E2E fixture (never shared or reset; the recruiter fixture is a separate interface, option key, mutable object and test title). Verified at merge time and re-verified at HEAD by the final whole-branch review.
- `recruiter-post-job-3` visual evidence: report status **warning**, 0.59% pixel difference, `infrastructure=0`. Reviewed artifacts `reference/screenshots/recruiter-post-job-3.png`, `candidate/screenshots/recruiter-post-job-3.png` and `diff/recruiter-post-job-3.png`. **Human verdict: APPROVED as the intended change.** The sole delta is the restored independent job-requirements field (label 「给候选人看的职位要求」 with `aria-label="职位要求"` and its placeholder) inserted after 办公地点, which pushes 「补充加分偏好（可选）」 below the fold. Every other region is pixel-identical. This is exactly the UI change Spec §2 mandates (恢复独立职位要求); it is not a structural, API, or infrastructure failure.

## Real-BFF Integration
- Verdict: **`ENV_BLOCKED`**
- ENV_BLOCKED — real BFF and/or disposable recruiter/OTP fixture unavailable; intercepted Playwright PASS is not real-service PASS.
- Evidence/reason: the backend/stg dev server proxy resolved the configured upstream to `Error: getaddrinfo ENOTFOUND recruitment-stg.agxp.ai`, so the real BFF is unreachable from this environment; and no disposable brand-new recruiter account and no OTP/login fixture were supplied by the integration owner. Classification confirmed by the integration owner. No OTPs, cookies, or credentials were recorded or attempted.
- The data-source Playwright suite is an in-browser `page.route` fixture and is explicitly NOT real-service proof.

## Public L3 Infrastructure
The final integrated diff (`origin/main..HEAD`, 52 files) touches **no** public L3 infrastructure — no Playwright config, no `vitest.config.ts`, no `脚本/`, no `tsconfig*`, no CI workflow, no `package.json`/lockfile. No required Case Set re-run is owed on that basis. The one shared E2E helper change (`安装BFF路由`'s profile/avatar/job-create handlers) was verified field-identical for the pre-existing P1C fixture.

## Explicitly Deferred
- Remote empty office address: gated on backend implementation/OpenAPI/test handoff. NOT implemented here.
- JD PDF suggestion import: gated on backend implementation/OpenAPI/test handoff. NOT implemented here.

## Known Residuals (non-blocking, recorded rather than discarded)
1. `取P7错误文案` (`src/状态/后端/真人会话操作.ts:166`) and `取P8错误文案` (`src/状态/后端/P8控制面操作.ts:182`) keep their own `status === 0 ||` disjunct, so client-minted errors surfacing through them still read as network failures. Outside this Plan's approved file map; pre-existing.
2. Candidate 422s now show only the generic `填写内容未通过校验` while the recruiter Job form received a localized field mapping. Spec-mandated; a candidate-side mapping is a separate product decision.
3. `src/屏幕/用户协议.tsx:68` still says 「导出你的简历与协商记录」 while the account screen was neutralized. That screen is candidate-voiced legal copy end to end.
4. The account deletion disclosure lost its per-item enumeration, though all three material facts (immediate deletion, in-flight negotiations terminate, the counterparty sees only 「对方已退出」) were restored.
5. `e2e/数据源模式.spec.ts` is typechecked by no tsc project (`tsconfig.e2e.json` includes only `e2e/真实后端/**/*.ts`).
6. Three vocabularies for one organization-failure event across `应用.tsx` / `企业设置.tsx` / `招聘方组织门.tsx`; and a server-driven 422 on `hiring_organization_claim.display_name` still projects to 「请填写公司名称」 on a page without that field.
