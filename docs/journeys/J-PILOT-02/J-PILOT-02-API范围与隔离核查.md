# J-PILOT-02：API 范围与 01 合同交集核查

> 后续校准：当前产品规则见[旅程v1.0](J-PILOT-02-产品旅程与状态规则.md)，新增作品集／Highlights范围见[合同校准](J-PILOT-02-Highlights与作品集合同校准.md)。本报告保留初轮研究时态，旧待决策与交集结论不能覆盖后续确认的范围。

日期：2026-09-10。以下是研究候选范围，并非要求每条正常路径调用全部接口。删除/替换为编辑或异常分支，屏蔽公司是否在本轮接线仍待产品讨论。接口存在不等于浏览器旅程通过。

源码基线：BE `1ae0b7a46f060e27c7f6db38e0469d15c626e2c5`；对照 01 合同 `264829174`。公开 Spec 为 `apps/recruitment-bff/openapi/mobile-v1.yaml`，内部 Spec 为 `apps/recruitment/openapi/mobile-resources-v1.yaml`。

| 范围 | operationId | BFF 方法与路径 | 请求 Schema | 成功响应 Schema | 内部 operation |
|---|---|---|---|---|---|
| 身份前置 | `beginLogin` | `POST /api/v1/auth/login-attempts` | LoginBeginRequest | 200 LoginAttemptEnvelope | 身份入口，另见Server/身份处理链 |
| 身份前置 | `completeLogin` | `POST /api/v1/auth/login-attempts/{attempt_id}/complete` | CompleteRequest | 200 LoginCompleteEnvelope | 身份入口，另见Server/身份处理链 |
| 身份前置 | `getCurrentSession` | `GET /api/v1/session` | — | 200 CurrentSessionEnvelope | 身份入口，另见Server/身份处理链 |
| 身份前置 | `getMe` | `GET /api/v1/me` | — | 200 PrincipalEnvelope | 身份入口，另见Server/身份处理链 |
| 身份前置 | `ensureRole` | `PUT /api/v1/me/roles/{role}` | EmptyRequest | 200 PrincipalEnvelope | 身份入口，另见Server/身份处理链 |
| 身份前置 | `setLastUsedRole` | `PUT /api/v1/me/preferences/last-used-role` | PreferenceRequest | 200 PrincipalEnvelope | 身份入口，另见Server/身份处理链 |
| 目录选择 | `listJobCategories` | `GET /api/v1/catalog/job-categories` | — | 200 TaxonomyPageEnvelope | listJobCategories |
| 目录选择 | `listLocations` | `GET /api/v1/catalog/locations` | — | 200 LocationPageEnvelope | listLocations |
| 目录选择 | `listIndustries` | `GET /api/v1/catalog/industries` | — | 200 TaxonomyPageEnvelope | listIndustries |
| 目录选择 | `listEducationInstitutions` | `GET /api/v1/catalog/education-institutions` | — | 200 InstitutionPageEnvelope | listEducationInstitutions |
| 目录选择 | `listMajors` | `GET /api/v1/catalog/majors` | — | 200 TaxonomyPageEnvelope | listMajors |
| 在线简历 | `getResume` | `GET /api/v1/me/resume` | — | 200 ResumeEnvelope | getResume |
| 在线简历 | `replaceResumeProfile` | `PATCH /api/v1/me/resume/profile` | ProfileWrite | 200 ResumeEnvelope | patchResumeProfile |
| 在线简历 | `replaceResumeSummary` | `PATCH /api/v1/me/resume/summary` | SummaryWrite | 200 ResumeEnvelope | patchResumeSummary |
| 在线简历 | `replaceResumeSkills` | `PATCH /api/v1/me/resume/skills` | SkillsWrite | 200 ResumeEnvelope | patchResumeSkills |
| 在线简历 | `createResumeExperience` | `POST /api/v1/me/resume/experiences` | ExperienceWrite | 201 ResumeEntryMutationEnvelope | createExperience |
| 在线简历 | `replaceResumeExperience` | `PATCH /api/v1/me/resume/experiences/{experience_id}` | ExperienceWrite | 200 ResumeEnvelope | patchExperience |
| 在线简历 | `deleteResumeExperience` | `DELETE /api/v1/me/resume/experiences/{experience_id}` | — | 200 ResumeEnvelope | deleteExperience |
| 在线简历 | `createResumeProject` | `POST /api/v1/me/resume/experiences/{experience_id}/projects` | ProjectWrite | 201 ResumeEntryMutationEnvelope | createProject |
| 在线简历 | `replaceResumeProject` | `PATCH /api/v1/me/resume/experiences/{experience_id}/projects/{project_id}` | ProjectWrite | 200 ResumeEnvelope | patchProject |
| 在线简历 | `deleteResumeProject` | `DELETE /api/v1/me/resume/experiences/{experience_id}/projects/{project_id}` | — | 200 ResumeEnvelope | deleteProject |
| 在线简历 | `createResumeEducation` | `POST /api/v1/me/resume/educations` | EducationWrite | 201 ResumeEntryMutationEnvelope | createEducation |
| 在线简历 | `replaceResumeEducation` | `PATCH /api/v1/me/resume/educations/{education_id}` | EducationWrite | 200 ResumeEnvelope | patchEducation |
| 在线简历 | `deleteResumeEducation` | `DELETE /api/v1/me/resume/educations/{education_id}` | — | 200 ResumeEnvelope | deleteEducation |
| 在线简历 | `createResumeCertificate` | `POST /api/v1/me/resume/certificates` | CertificateWrite | 201 ResumeEntryMutationEnvelope | createCertificate |
| 在线简历 | `replaceResumeCertificate` | `PATCH /api/v1/me/resume/certificates/{certificate_id}` | CertificateWrite | 200 ResumeEnvelope | patchCertificate |
| 在线简历 | `deleteResumeCertificate` | `DELETE /api/v1/me/resume/certificates/{certificate_id}` | — | 200 ResumeEnvelope | deleteCertificate |
| PDF与预填 | `listResumeFiles` | `GET /api/v1/me/resume-files` | — | 200 ResumeFileListEnvelope | listResumeFiles |
| PDF与预填 | `createResumeFile` | `POST /api/v1/me/resume-files` | ResumeFileUploadCreate | 201 ResumeFileEnvelope | createResumeFile |
| PDF与预填 | `replaceResumeFileContent` | `PUT /api/v1/me/resume-files/{file_id}/content` | ResumeFileUploadReplace | 200 ResumeFileEnvelope | replaceResumeFileContent |
| PDF与预填 | `requestResumeFileParse` | `POST /api/v1/me/resume-files/{file_id}/parse` | ResumeFileParseRequest | 202 ResumeFileParseStatusEnvelope | requestResumeFileParse |
| PDF与预填 | `getResumeParseResult` | `GET /api/v1/me/resume-files/{file_id}/parse-result` | — | 200 ResumePrefillEnvelope | getResumeParseResult |
| PDF与预填 | `downloadResumeFile` | `GET /api/v1/me/resume-files/{file_id}/content` | — | 200 string | downloadResumeFile |
| 首次意向 | `createIntention` | `POST /api/v1/me/intentions` | IntentionWrite | 201 OwnerIntentionEnvelope | createIntention |
| 首次意向 | `listIntentions` | `GET /api/v1/me/intentions` | — | 200 OwnerIntentionListEnvelope | listOwnedIntentions |
| 首次意向 | `getIntention` | `GET /api/v1/me/intentions/{intention_id}` | — | 200 OwnerIntentionEnvelope | getOwnedIntention |
| 首次意向 | `replaceIntention` | `PATCH /api/v1/me/intentions/{intention_id}` | IntentionWrite | 200 OwnerIntentionEnvelope | replaceIntention |
| 头像 | `getCandidateAccountProfile` | `GET /api/v1/me/account-profile` | — | 200 AccountProfileEnvelope | getAccountProfile |
| 头像 | `replaceCandidateAvatar` | `POST /api/v1/me/avatar` | object | 201 AccountProfileEnvelope；200 AccountProfileEnvelope | replaceAvatar |
| 头像 | `getCandidateAvatarContent` | `GET /api/v1/me/avatar/content` | — | 200 string | getAvatarContent |
| 屏蔽公司待定接线 | `getPrivacy` | `GET /api/v1/me/privacy` | — | 200 PrivacyViewEnvelope | getPrivacy |
| 屏蔽公司待定接线 | `createPrivacyOrganizationBlock` | `POST /api/v1/me/privacy/organization-blocks` | PrivacyBlockCreate | 201 PrivacyBlockReceiptEnvelope；200 PrivacyBlockReceiptEnvelope | createOrganizationBlock |
| 屏蔽公司待定接线 | `unblockPrivacyOrganization` | `POST /api/v1/me/privacy/organization-blocks/{organization_id}/unblock` | PrivacyUnblock | 200 PrivacyViewEnvelope | unblockOrganization |

## 静态交集结论

本次检查 43 个公开 operation，递归展开其引用的 132 个 BFF Schema；按路径与方法映射的内部 operation 为 37 个。两份 Spec 与01相比，所选 operation 改动交集及递归 Schema 改动交集均为空。机器结果见 [api-overlap.json](api-overlap.json)。

这表示当前候选范围无需承接01的新字段或状态，并不表示资源完全独立：两条均使用附件库，01还消费已保存的意向和简历。02若改共享字段、解析就绪语义、授权或文件版本规则，须重新评估。共用错误、会话、Catalog Schema 按现有定义引用，不为02重构。

本次未检出独立“完成 onboarding”API；是否需要持久完成事实应先由产品规则决定，不能从缺少该名称直接推导必须新增端点。屏蔽公司需真实组织身份和隐私接口，不能用私有诉求文本替代。

该核查只检查当前列举对象及其引用；不是全部在途分支的互斥证明，也没有发出 API 请求或运行 E2E。
