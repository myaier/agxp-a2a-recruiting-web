// 发现推荐域数据源测试：冻结 P4 双端每个 browser call 的 method/path/body/调用方幂等键形状，
// 并锁定分页循环（next_cursor 必在、末页显式 null、空/重复/非串/非 base64url/超长 cursor 拒绝）、
// strict decode（exact key set、闭合 enum、rank/score 边界、条件可空、owner-only 键、隐私金丝雀）
// 与委托批次恰好一条回执的闭合纪律。watch / 候选撤销 / 委托列表 / top 选择不在本 facade。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type { BFF淘汰原因, BFF发现偏好 } from '../BFF契约';
import {
  BFF意向样本,
  BFF岗位样本,
  BFFCandidateJob样本,
  BFF候选岗位推荐样本,
  BFF招聘候选推荐样本,
  BFF发现批次样本,
  BFF招聘发现批次样本,
  BFF候选委托回执样本,
  BFF招聘委托回执样本,
  BFF发现偏好样本,
} from '../../测试/BFF样本';
import { 创建发现推荐数据源, type 发现推荐数据源 } from './发现推荐';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

function 响应<T>(result: T): BFF响应<T> {
  return { result, etag: null, requestId: 'fixture-request' };
}

const 招聘淘汰路径 = `/api/v1/recruiter/jobs/${BFF岗位样本.job_id}/candidate-recommendations/${BFF招聘候选推荐样本.recommendation_id}/rejection`;
const 收藏路径 = `/api/v1/recruiter/jobs/${BFF岗位样本.job_id}/candidate-recommendations/${BFF招聘候选推荐样本.recommendation_id}/favorite`;
const 候选列表路径 = `/api/v1/me/job-recommendations?intention_id=${BFF意向样本.intention_id}&limit=50`;
const 招聘列表路径 = `/api/v1/recruiter/jobs/${BFF岗位样本.job_id}/candidate-recommendations?limit=50`;
const 招聘已筛路径 = `/api/v1/recruiter/jobs/${BFF岗位样本.job_id}/candidate-recommendations?state=rejected&limit=50`;

describe('发现推荐数据源', () => {
  let 请求Mock: ReturnType<typeof vi.fn>;
  let source: 发现推荐数据源;

  beforeEach(() => {
    请求Mock = vi.fn();
    source = 创建发现推荐数据源(请求Mock as 请求函数);
  });

  it('双端 refresh 与 delegation 使用精确 body 和调用方幂等键', async () => {
    请求Mock
      .mockResolvedValueOnce(响应(BFF发现批次样本))
      .mockResolvedValueOnce(响应({ receipts: [BFF候选委托回执样本] }))
      .mockResolvedValueOnce(响应(BFF招聘发现批次样本))
      .mockResolvedValueOnce(响应({ receipts: [BFF招聘委托回执样本] }));

    await source.刷新候选岗位推荐(BFF意向样本.intention_id, 'candidate-refresh-key');
    await source.创建候选岗位委托({
      intentionId: BFF意向样本.intention_id,
      jobId: BFFCandidateJob样本.job_id,
      resumeFileId: 'rf_1',
      resumeFileVersionId: 'rfv_7',
      idempotencyKey: 'candidate-delegation-key',
      disclosureAcknowledged: true,
    });
    await source.刷新招聘候选(BFF岗位样本.job_id, 'recruiter-refresh-key');
    await source.创建招聘候选委托({
      jobId: BFF岗位样本.job_id,
      recommendationId: BFF招聘候选推荐样本.recommendation_id,
      idempotencyKey: 'recruiter-delegation-key',
    });

    expect(请求Mock.mock.calls.map(([options]) => options)).toEqual([
      { path: '/api/v1/me/job-recommendation-refreshes', method: 'POST',
        body: { intention_id: BFF意向样本.intention_id }, 幂等: true, 幂等键: 'candidate-refresh-key' },
      { path: '/api/v1/me/job-delegations', method: 'POST',
        body: { intention_id: BFF意向样本.intention_id,
          selection: { items: [BFFCandidateJob样本.job_id] }, disclosure_acknowledged: true,
          resume_file_id: 'rf_1', resume_file_version_id: 'rfv_7' },
        幂等: true, 幂等键: 'candidate-delegation-key' },
      { path: '/api/v1/recruiter/candidate-recommendation-refreshes', method: 'POST',
        body: { job_id: BFF岗位样本.job_id }, 幂等: true, 幂等键: 'recruiter-refresh-key' },
      { path: '/api/v1/recruiter/candidate-delegations', method: 'POST',
        body: { job_id: BFF岗位样本.job_id,
          selection: { items: [BFF招聘候选推荐样本.recommendation_id] } },
        幂等: true, 幂等键: 'recruiter-delegation-key' },
    ]);
  });

  it('候选委托 exact body 绑定调用方给出的精确简历坐标，缺任一坐标编译期即拒绝', async () => {
    // 下面两个 @ts-expect-error 探针在运行时也会真的发起（vitest 不做类型检查），
    // 所以桩用常驻 resolved 值而不是 Once。
    请求Mock.mockResolvedValue(响应({ receipts: [BFF候选委托回执样本] }));

    await source.创建候选岗位委托({
      intentionId: 'int_1',
      jobId: 'job_1',
      resumeFileId: 'rf_1',
      resumeFileVersionId: 'rfv_7',
      disclosureAcknowledged: true,
      idempotencyKey: 'delegation-key-0001',
    });

    expect(请求Mock).toHaveBeenCalledWith(expect.objectContaining({
      path: '/api/v1/me/job-delegations',
      method: 'POST',
      body: {
        intention_id: 'int_1',
        selection: { items: ['job_1'] },
        disclosure_acknowledged: true,
        resume_file_id: 'rf_1',
        resume_file_version_id: 'rfv_7',
      },
    }));

    // 编译期断言：缺任一简历坐标的输入都被拒绝（运行时这两行不该再被类型收留）
    // @ts-expect-error 缺 resumeFileId
    await source.创建候选岗位委托({ intentionId: 'int_1', jobId: 'job_1', resumeFileVersionId: 'rfv_7', disclosureAcknowledged: true, idempotencyKey: 'k2' });
    // @ts-expect-error 缺 resumeFileVersionId
    await source.创建候选岗位委托({ intentionId: 'int_1', jobId: 'job_1', resumeFileId: 'rf_1', disclosureAcknowledged: true, idempotencyKey: 'k3' });
  });

  it('招聘淘汰只发送 exact reason body，不发送幂等键或 If-Match', async () => {
    请求Mock.mockResolvedValueOnce(响应(BFF发现偏好样本));
    await source.设置招聘候选淘汰(
      BFF岗位样本.job_id,
      BFF招聘候选推荐样本.recommendation_id,
      'direction_mismatch',
    );
    expect(请求Mock).toHaveBeenCalledWith({
      path: `/api/v1/recruiter/jobs/${BFF岗位样本.job_id}/candidate-recommendations/${BFF招聘候选推荐样本.recommendation_id}/rejection`,
      method: 'PUT',
      body: { reason: 'direction_mismatch' },
    });
  });

  it.each(['experience_insufficient', 'direction_mismatch', 'primary_stack_mismatch', 'other'] as const)(
    '招聘淘汰 PUT 接受四个闭词之一 %s 且 body 原样透传',
    async (reason: BFF淘汰原因) => {
      请求Mock.mockResolvedValueOnce(响应(BFF发现偏好样本));
      await expect(source.设置招聘候选淘汰(BFF岗位样本.job_id, BFF招聘候选推荐样本.recommendation_id, reason))
        .resolves.toEqual(BFF发现偏好样本);
      expect(请求Mock).toHaveBeenCalledWith({ path: 招聘淘汰路径, method: 'PUT', body: { reason } });
    },
  );

  it('撤销淘汰是 rejection 资源上的无 body DELETE', async () => {
    const 已撤销: BFF发现偏好 = { ...BFF发现偏好样本, rejected: false, rejection_reason: null };
    请求Mock.mockResolvedValueOnce(响应(已撤销));
    await expect(source.撤销招聘候选淘汰(BFF岗位样本.job_id, BFF招聘候选推荐样本.recommendation_id))
      .resolves.toEqual(已撤销);
    expect(请求Mock.mock.calls[0][0]).toEqual({ path: 招聘淘汰路径, method: 'DELETE' });
  });

  it('收藏 PUT / DELETE 都无 body、无幂等键、无 If-Match', async () => {
    请求Mock
      .mockResolvedValueOnce(响应({ ...BFF发现偏好样本, favorite: true, rejected: false, rejection_reason: null }))
      .mockResolvedValueOnce(响应({ ...BFF发现偏好样本, favorite: false, rejected: false, rejection_reason: null }));
    await source.设置招聘候选收藏(BFF岗位样本.job_id, BFF招聘候选推荐样本.recommendation_id, true);
    await source.设置招聘候选收藏(BFF岗位样本.job_id, BFF招聘候选推荐样本.recommendation_id, false);
    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      { path: 收藏路径, method: 'PUT' },
      { path: 收藏路径, method: 'DELETE' },
    ]);
  });

  it('候选不感兴趣是无 body 无幂等的 PUT', async () => {
    请求Mock.mockResolvedValueOnce(响应(BFF发现偏好样本));
    await expect(source.标记候选岗位不感兴趣(BFF候选岗位推荐样本.recommendation_id))
      .resolves.toEqual(BFF发现偏好样本);
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: `/api/v1/me/job-recommendations/${BFF候选岗位推荐样本.recommendation_id}/not-interested`,
      method: 'PUT',
    });
  });

  it('候选岗位详情走 /api/v1/jobs/{job_id} 裸 GET，招聘详情走卡坐标 GET', async () => {
    请求Mock
      .mockResolvedValueOnce(响应(BFFCandidateJob样本))
      .mockResolvedValueOnce(响应(BFF招聘候选推荐样本));
    await expect(source.读取候选岗位详情(BFFCandidateJob样本.job_id)).resolves.toEqual(BFFCandidateJob样本);
    await expect(source.读取招聘候选详情(BFF岗位样本.job_id, BFF招聘候选推荐样本.recommendation_id))
      .resolves.toEqual(BFF招聘候选推荐样本);
    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      { path: `/api/v1/jobs/${BFFCandidateJob样本.job_id}` },
      { path: `/api/v1/recruiter/jobs/${BFF岗位样本.job_id}/candidate-recommendations/${BFF招聘候选推荐样本.recommendation_id}` },
    ]);
  });

  it('双端委托各用一次裸 GET 读取回执', async () => {
    请求Mock
      .mockResolvedValueOnce(响应(BFF候选委托回执样本))
      .mockResolvedValueOnce(响应(BFF招聘委托回执样本));
    await expect(source.读取候选岗位委托(BFF候选委托回执样本.delegation_id)).resolves.toEqual(BFF候选委托回执样本);
    await expect(source.读取招聘候选委托(BFF招聘委托回执样本.delegation_id)).resolves.toEqual(BFF招聘委托回执样本);
    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      { path: `/api/v1/me/job-delegations/${BFF候选委托回执样本.delegation_id}` },
      { path: `/api/v1/recruiter/candidate-delegations/${BFF招聘委托回执样本.delegation_id}` },
    ]);
  });

  it('双端列表首页固定 limit=50，rejected 视图显式发送 state=rejected', async () => {
    请求Mock
      .mockResolvedValueOnce(响应({ recommendations: [BFF候选岗位推荐样本], next_cursor: null }))
      .mockResolvedValueOnce(响应({ recommendations: [BFF招聘候选推荐样本], next_cursor: null }))
      .mockResolvedValueOnce(响应({ recommendations: [], next_cursor: null }));
    await expect(source.读取候选岗位推荐(BFF意向样本.intention_id)).resolves.toEqual([BFF候选岗位推荐样本]);
    await expect(source.读取招聘候选(BFF岗位样本.job_id)).resolves.toEqual([BFF招聘候选推荐样本]);
    await expect(source.读取招聘候选(BFF岗位样本.job_id, 'rejected')).resolves.toEqual([]);
    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      { path: 候选列表路径 },
      { path: 招聘列表路径 },
      { path: 招聘已筛路径 },
    ]);
  });

  it('列表读取全部页并拼接条目，cursor 追加且 encodeURIComponent，后续页保持 limit=50', async () => {
    请求Mock
      .mockResolvedValueOnce(响应({ recommendations: [BFF候选岗位推荐样本], next_cursor: 'Pg2_-1' }))
      .mockResolvedValueOnce(响应({ recommendations: [], next_cursor: null }))
      .mockResolvedValueOnce(响应({ recommendations: [BFF招聘候选推荐样本], next_cursor: 'eHl6Xzkw' }))
      .mockResolvedValueOnce(响应({ recommendations: [], next_cursor: null }));
    await expect(source.读取候选岗位推荐(BFF意向样本.intention_id)).resolves.toEqual([BFF候选岗位推荐样本]);
    await expect(source.读取招聘候选(BFF岗位样本.job_id, 'rejected')).resolves.toEqual([BFF招聘候选推荐样本]);
    expect(请求Mock.mock.calls.map(([选项]) => 选项.path)).toEqual([
      候选列表路径,
      `${候选列表路径}&cursor=${encodeURIComponent('Pg2_-1')}`,
      招聘已筛路径,
      `${招聘已筛路径}&cursor=${encodeURIComponent('eHl6Xzkw')}`,
    ]);
  });

  it('恰好 4096 字节的 cursor 是合法下一页', async () => {
    const 边界游标 = 'a'.repeat(4096);
    请求Mock
      .mockResolvedValueOnce(响应({ recommendations: [], next_cursor: 边界游标 }))
      .mockResolvedValueOnce(响应({ recommendations: [], next_cursor: null }));
    await expect(source.读取招聘候选(BFF岗位样本.job_id)).resolves.toEqual([]);
    expect(请求Mock.mock.calls[1][0].path).toBe(`${招聘列表路径}&cursor=${边界游标}`);
  });

  it('cursor 空/非串/非 base64url/超 4096 字节/重复出现都按契约漂移拒绝', async () => {
    for (const 坏游标 of ['', 7, 'bad/cursor+eq=', 'a'.repeat(4097)]) {
      请求Mock.mockResolvedValueOnce(响应({ recommendations: [], next_cursor: 坏游标 }));
      await expect(source.读取候选岗位推荐(BFF意向样本.intention_id))
        .rejects.toMatchObject({ code: 'invalid_response' });
    }
    // 翻页中途再次吐同一 cursor → 死循环风险，拒绝。
    请求Mock
      .mockResolvedValueOnce(响应({ recommendations: [], next_cursor: 'dup' }))
      .mockResolvedValue(响应({ recommendations: [], next_cursor: 'dup' }));
    await expect(source.读取候选岗位推荐(BFF意向样本.intention_id))
      .rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('页 wrapper 缺 next_cursor、缺 recommendations、多出未知页键或条目不是数组都抛 invalid_response', async () => {
    // P4 页永远要求 next_cursor 且末页用显式 null —— 与 Agent 规则域「键可选、present null 非法」不同。
    请求Mock.mockResolvedValueOnce(响应({ recommendations: [] }));
    await expect(source.读取候选岗位推荐(BFF意向样本.intention_id)).rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce(响应({ next_cursor: null }));
    await expect(source.读取招聘候选(BFF岗位样本.job_id)).rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce(响应({ recommendations: [], next_cursor: null, total: 5 }));
    await expect(source.读取候选岗位推荐(BFF意向样本.intention_id)).rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce(响应({ recommendations: {}, next_cursor: null }));
    await expect(source.读取招聘候选(BFF岗位样本.job_id)).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('推荐卡缺必需键或多出未知键抛 invalid_response', async () => {
    const { rank: _rank, ...缺键候选卡 } = BFF候选岗位推荐样本;
    请求Mock.mockResolvedValueOnce(响应({ recommendations: [缺键候选卡], next_cursor: null }));
    await expect(source.读取候选岗位推荐(BFF意向样本.intention_id)).rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce(响应({ recommendations: [{ ...BFF候选岗位推荐样本, weight: 2 }], next_cursor: null }));
    await expect(source.读取候选岗位推荐(BFF意向样本.intention_id)).rejects.toMatchObject({ code: 'invalid_response' });

    const { summary: _summary, ...缺键招聘卡 } = BFF招聘候选推荐样本;
    请求Mock.mockResolvedValueOnce(响应({ recommendations: [缺键招聘卡], next_cursor: null }));
    await expect(source.读取招聘候选(BFF岗位样本.job_id)).rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce(响应({ recommendations: [{ ...BFF招聘候选推荐样本, candidate_subject: 'sub_9' }], next_cursor: null }));
    await expect(source.读取招聘候选(BFF岗位样本.job_id)).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('非法 rank/score/state/枚举抛 invalid_response', async () => {
    const 候选变体们: Record<string, unknown>[] = [
      { ...BFF候选岗位推荐样本, rank: 0 },
      { ...BFF候选岗位推荐样本, rank: 4 },
      { ...BFF候选岗位推荐样本, rank: 1.5 },
      { ...BFF候选岗位推荐样本, rank: '2' },
      { ...BFF候选岗位推荐样本, match_score: -1 },
      { ...BFF候选岗位推荐样本, match_score: 101 },
      { ...BFF候选岗位推荐样本, state: 'expired' },
      { ...BFF候选岗位推荐样本, match_reasons: 'direction_match' },
      { ...BFF候选岗位推荐样本, job: { ...BFFCandidateJob样本, recruitment_type: 'contract' } },
      { ...BFF候选岗位推荐样本, job: { ...BFFCandidateJob样本, workplace_mode: 'anywhere' } },
      { ...BFF候选岗位推荐样本, job: { ...BFFCandidateJob样本, salary_period: 'year' } },
      { ...BFF候选岗位推荐样本, job: { ...BFFCandidateJob样本, status: 'archived' } },
      { ...BFF候选岗位推荐样本, job: { ...BFFCandidateJob样本, publisher_verification_status: 'pending' } },
      { ...BFF候选岗位推荐样本, job: { ...BFFCandidateJob样本, hiring_organization_verification_status: 'pending' } },
      {
        ...BFF候选岗位推荐样本,
        job: {
          ...BFFCandidateJob样本,
          hard_requirements: { ...BFFCandidateJob样本.hard_requirements, frequent_travel: '可选' },
        },
      },
      { ...BFF候选岗位推荐样本, delegation: { delegation_id: 'del_9', state: 'closed', case_id: null } },
    ];
    for (const 变体 of 候选变体们) {
      请求Mock.mockResolvedValueOnce(响应({ recommendations: [变体], next_cursor: null }));
      await expect(source.读取候选岗位推荐(BFF意向样本.intention_id)).rejects.toMatchObject({ code: 'invalid_response' });
    }
    const 招聘变体们: Record<string, unknown>[] = [
      { ...BFF招聘候选推荐样本, rank: 0 },
      { ...BFF招聘候选推荐样本, match_score: 101 },
      { ...BFF招聘候选推荐样本, compensation_relationship: 'equal' },
      { ...BFF招聘候选推荐样本, rejection_reason: 'too_junior' },
      { ...BFF招聘候选推荐样本, state: 'screened' },
      { ...BFF招聘候选推荐样本, experience_years: 'four' },
      { ...BFF招聘候选推荐样本, favorite: 'yes' },
      { ...BFF招聘候选推荐样本, educations: [{ ...BFF招聘候选推荐样本.educations[0], degree: 4 }] },
    ];
    for (const 变体 of 招聘变体们) {
      请求Mock.mockResolvedValueOnce(响应({ recommendations: [变体], next_cursor: null }));
      await expect(source.读取招聘候选(BFF岗位样本.job_id)).rejects.toMatchObject({ code: 'invalid_response' });
    }
    expect(请求Mock).toHaveBeenCalledTimes(候选变体们.length + 招聘变体们.length);
  });

  it('空串 ID 与空发现时间戳按契约漂移拒绝', async () => {
    const 列表变体们: Record<string, unknown>[] = [
      { ...BFF候选岗位推荐样本, recommendation_id: '' },
      { ...BFF候选岗位推荐样本, batch_id: '' },
      { ...BFF候选岗位推荐样本, intention_id: '' },
      { ...BFF招聘候选推荐样本, recommendation_id: '' },
      { ...BFF招聘候选推荐样本, job_id: '' },
      { ...BFF招聘候选推荐样本, candidate_alias: '' },
    ];
    for (const 变体 of 列表变体们) {
      请求Mock.mockResolvedValueOnce(响应({ recommendations: [变体], next_cursor: null }));
      await expect(source.读取招聘候选(BFF岗位样本.job_id)).rejects.toMatchObject({ code: 'invalid_response' });
    }
    请求Mock.mockResolvedValueOnce(响应({ ...BFFCandidateJob样本, job_id: '' }));
    await expect(source.读取候选岗位详情(BFFCandidateJob样本.job_id)).rejects.toMatchObject({ code: 'invalid_response' });

    for (const 坏批次 of [
      { ...BFF发现批次样本, batch_id: '' },
      { ...BFF发现批次样本, scope_ref: '' },
      { ...BFF发现批次样本, created_at: '' },
    ]) {
      请求Mock.mockResolvedValueOnce(响应(坏批次));
      await expect(source.刷新候选岗位推荐(BFF意向样本.intention_id, 'candidate-refresh-key'))
        .rejects.toMatchObject({ code: 'invalid_response' });
    }
    请求Mock.mockResolvedValueOnce(响应({ ...BFF发现偏好样本, updated_at: '' }));
    await expect(source.标记候选岗位不感兴趣(BFF候选岗位推荐样本.recommendation_id))
      .rejects.toMatchObject({ code: 'invalid_response' });
    请求Mock.mockResolvedValueOnce(响应({ ...BFF发现偏好样本, revision: 0 }));
    await expect(source.标记候选岗位不感兴趣(BFF候选岗位推荐样本.recommendation_id))
      .rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('批次 direction/ranking_version/count 闭合，缺键多键拒绝', async () => {
    请求Mock.mockResolvedValueOnce(响应(BFF发现批次样本));
    await expect(source.刷新候选岗位推荐(BFF意向样本.intention_id, 'candidate-refresh-key'))
      .resolves.toEqual(BFF发现批次样本);
    请求Mock.mockResolvedValueOnce(响应(BFF招聘发现批次样本));
    await expect(source.刷新招聘候选(BFF岗位样本.job_id, 'recruiter-refresh-key'))
      .resolves.toEqual(BFF招聘发现批次样本);
    for (const 坏批次 of [
      { ...BFF发现批次样本, direction: 'job_matches' },
      { ...BFF发现批次样本, ranking_version: 'v2' },
      { ...BFF发现批次样本, count: 4 },
      { ...BFF发现批次样本, count: -1 },
      { batch_id: 'bat_c1', direction: 'candidate_jobs', scope_ref: 'int_1', ranking_version: 'discovery-ranking.v1', count: 1 },
      { ...BFF发现批次样本, extra: true },
    ]) {
      请求Mock.mockResolvedValueOnce(响应(坏批次));
      await expect(source.刷新候选岗位推荐(BFF意向样本.intention_id, 'candidate-refresh-key'))
        .rejects.toMatchObject({ code: 'invalid_response' });
    }
  });

  it('偏好回执的 rejection_reason 只接受 not_interested、四闭词或 null', async () => {
    for (const 合法 of [
      { ...BFF发现偏好样本, rejection_reason: 'not_interested' },
      { ...BFF发现偏好样本, rejection_reason: null },
      { ...BFF发现偏好样本, rejection_reason: 'primary_stack_mismatch' },
    ] as BFF发现偏好[]) {
      请求Mock.mockResolvedValueOnce(响应(合法));
      await expect(source.标记候选岗位不感兴趣(BFF候选岗位推荐样本.recommendation_id)).resolves.toEqual(合法);
    }
    for (const 坏值 of ['too_junior', 3]) {
      请求Mock.mockResolvedValueOnce(响应({ ...BFF发现偏好样本, rejection_reason: 坏值 }));
      await expect(source.标记候选岗位不感兴趣(BFF候选岗位推荐样本.recommendation_id))
        .rejects.toMatchObject({ code: 'invalid_response' });
    }
    expect(请求Mock).toHaveBeenCalledTimes(5);
  });

  it('委托批次必须恰好一条回执：零条或两条都抛 invalid_response', async () => {
    for (const receipts of [[], [BFF招聘委托回执样本, BFF招聘委托回执样本]]) {
      请求Mock.mockResolvedValueOnce(响应({ receipts }));
      await expect(source.创建招聘候选委托({
        jobId: BFF岗位样本.job_id,
        recommendationId: BFF招聘候选推荐样本.recommendation_id,
        idempotencyKey: 'recruiter-delegation-key',
      })).rejects.toMatchObject({ code: 'invalid_response' });
    }
    // 恰好一条时原样解码；批次 wrapper 不接受分页键。
    请求Mock.mockResolvedValueOnce(响应({ receipts: [BFF招聘委托回执样本] }));
    await expect(source.创建招聘候选委托({
      jobId: BFF岗位样本.job_id,
      recommendationId: BFF招聘候选推荐样本.recommendation_id,
      idempotencyKey: 'recruiter-delegation-key',
    })).resolves.toEqual([BFF招聘委托回执样本]);
    请求Mock.mockResolvedValueOnce(响应({ receipts: [BFF招聘委托回执样本], next_cursor: null }));
    await expect(source.创建招聘候选委托({
      jobId: BFF岗位样本.job_id,
      recommendationId: BFF招聘候选推荐样本.recommendation_id,
      idempotencyKey: 'recruiter-delegation-key',
    })).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('回执缺必需键、多出未知键或坏 ID 抛 invalid_response', async () => {
    const { refusal_code: _refusal_code, ...缺键回执 } = BFF招聘委托回执样本;
    for (const 破损 of [
      缺键回执,
      { ...BFF候选委托回执样本, extra: true },
      { ...BFF候选委托回执样本, delegation_id: '' },
      { ...BFF招聘委托回执样本, delegation_id: '' },
    ]) {
      请求Mock.mockResolvedValueOnce(响应({ receipts: [破损] }));
      await expect(source.创建招聘候选委托({
        jobId: BFF岗位样本.job_id,
        recommendationId: BFF招聘候选推荐样本.recommendation_id,
        idempotencyKey: 'recruiter-delegation-key',
      })).rejects.toMatchObject({ code: 'invalid_response' });
    }
    expect(请求Mock).toHaveBeenCalledTimes(4);
  });

  it('委托摘要与回执的条件可空成员只接受 null 或合法闭合值', async () => {
    const 卡变体们: Record<string, unknown>[] = [
      { ...BFF候选岗位推荐样本, delegation: { delegation_id: 'del_9', state: 'accepted' } },
      { ...BFF候选岗位推荐样本, delegation: { delegation_id: 'del_9', state: 'accepted', case_id: 42 } },
      { ...BFF候选岗位推荐样本, delegation: { delegation_id: '', state: 'accepted', case_id: null } },
      { ...BFF候选岗位推荐样本, delegation: { delegation_id: 'del_9', state: 'accepted', case_id: null, extra: 1 } },
      { ...BFF候选岗位推荐样本, delegation: 0 },
    ];
    for (const 变体 of 卡变体们) {
      请求Mock.mockResolvedValueOnce(响应({ recommendations: [变体], next_cursor: null }));
      await expect(source.读取候选岗位推荐(BFF意向样本.intention_id)).rejects.toMatchObject({ code: 'invalid_response' });
    }
    const 回执变体们: Record<string, unknown>[] = [
      { ...BFF候选委托回执样本, recommendation_id: '' },
      { ...BFF候选委托回执样本, state: 'postponed' },
      { ...BFF候选委托回执样本, refusal_code: 'too_busy' },
      { ...BFF候选委托回执样本, case_id: 7 },
      { ...BFF招聘委托回执样本, recommendation_id: 9 },
    ];
    for (const 变体 of 回执变体们) {
      请求Mock.mockResolvedValueOnce(响应({ receipts: [变体] }));
      await expect(source.读取候选岗位委托(BFF候选委托回执样本.delegation_id))
        .rejects.toMatchObject({ code: 'invalid_response' });
    }
    expect(请求Mock).toHaveBeenCalledTimes(卡变体们.length + 回执变体们.length);
  });

  it('CandidateJob 接受三个可选键并保留可选引用，时间必须 RFC3339', async () => {
    const 带可选键 = {
      ...BFFCandidateJob样本,
      publisher_organization_ref: 'org_1',
      hiring_organization_ref: 'org_2',
      publisher_profile: {
        public_name: '林澈',
        title: '招聘负责人',
        personal_verification_status: 'verified',
        avatar_url: null,
      },
    };
    请求Mock.mockResolvedValueOnce(响应(带可选键));
    await expect(source.读取候选岗位详情(BFFCandidateJob样本.job_id)).resolves.toEqual(带可选键);
    for (const 坏值 of [
      { published_at: '昨天' },
      { created_at: '2026-08-24 00:00:00' },
      { updated_at: '' },
      { revision: -1 },
      { salary_lower: 300.5 },
      { annual_salary_months: '13' },
      { keywords: ['Python', 3] },
      { category: { id: 'tax_product' } },
      { category: { id: '', display_name: '产品经理' } },
      { hiring_organization_claim: {} },
      {
        hard_requirements: {
          alternate_weekend_work: 'unknown',
          outsourcing_only: 'unknown',
          onsite_only: 'unknown',
        },
      },
      { publisher_profile: { public_name: '林澈', title: '招聘负责人' } },
    ]) {
      请求Mock.mockResolvedValueOnce(响应({ ...BFFCandidateJob样本, ...坏值 }));
      await expect(source.读取候选岗位详情(BFFCandidateJob样本.job_id))
        .rejects.toMatchObject({ code: 'invalid_response' });
    }
  });

  it('CandidateJob 携带 owner-only 列按契约漂移拒绝', async () => {
    for (const owner键 of ['publisher_mode', 'publisher_affiliation_ref', 'private_screening_preferences']) {
      请求Mock.mockResolvedValueOnce(响应({ ...BFFCandidateJob样本, [owner键]: 'direct' }));
      await expect(source.读取候选岗位详情(BFFCandidateJob样本.job_id))
        .rejects.toMatchObject({ code: 'invalid_response' });
    }
    expect(请求Mock).toHaveBeenCalledTimes(3);
  });

  it('招聘卡携带隐私金丝雀（身份/联系方式/出生数据/薪资数字/简历文件/屏蔽事实）按契约漂移拒绝', async () => {
    const 金丝雀们: Record<string, unknown>[] = [
      { candidate_subject: 'sub_9' },
      { real_name: '沈亦舟' },
      { phone: '+8613800000000' },
      { gender: 'male' },
      { birth_year: 1998 },
      { salary_lower: 300 },
      { resume_file_id: 'file_1' },
      { organization_block: { organization_id: 'org_1' } },
    ];
    for (const 金丝雀 of 金丝雀们) {
      请求Mock.mockResolvedValueOnce(响应({ recommendations: [{ ...BFF招聘候选推荐样本, ...金丝雀 }], next_cursor: null }));
      await expect(source.读取招聘候选(BFF岗位样本.job_id)).rejects.toMatchObject({ code: 'invalid_response' });
    }
    expect(请求Mock).toHaveBeenCalledTimes(金丝雀们.length);
  });
});
