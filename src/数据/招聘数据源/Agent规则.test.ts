// Agent 规则域数据源测试：冻结每个 browser call 的 method/path/If-Match/幂等/body 形状，
// 并锁定分页循环（cursor 拼接与空/重复/非串/多余页键拒绝）、strict decode（exact key set、
// 闭合 enum、ID 正则、日期可解析、interpreting/ready/terminal 三种提案形状差异）
// 与双角色 body 闭合（candidate 必须带 scope、recruiter 永远没有 scope）。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type { BFFAgent规则作用域 } from '../BFF契约';
import {
  BFFAgent规则样本,
  BFF意向Agent规则样本,
  BFFAgent规则解释中提案样本,
  BFFAgent规则就绪提案样本,
} from '../../测试/BFF样本';
import { 创建Agent规则数据源 } from './Agent规则';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

const 前缀 = { candidate: '/api/v1/me', recruiter: '/api/v1/recruiter' } as const;

describe('Agent 规则数据源', () => {
  const 请求Mock = vi.fn();
  const 请求 = 请求Mock as unknown as 请求函数;
  const 数据源 = 创建Agent规则数据源(请求);
  beforeEach(() => {
    请求Mock.mockReset();
  });

  it('candidate create and recruiter create use different closed bodies', async () => {
    请求Mock
      .mockResolvedValueOnce({ result: BFFAgent规则解释中提案样本, etag: null, requestId: 'p1' })
      .mockResolvedValueOnce({ result: BFFAgent规则解释中提案样本, etag: null, requestId: 'p2' });

    await 数据源.创建Agent规则提案('candidate', '大小周不谈', {
      type: 'intention', intention_id: 'int_0123456789abcdef0123456789abcdef',
    });
    await 数据源.创建Agent规则提案('recruiter', '竞对在职候选人不接触');

    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      {
        path: '/api/v1/me/agent-rule-proposals', method: 'POST', 幂等: true,
        body: { text: '大小周不谈', scope: { type: 'intention', intention_id: 'int_0123456789abcdef0123456789abcdef' } },
      },
      {
        path: '/api/v1/recruiter/agent-rule-proposals', method: 'POST', 幂等: true,
        body: { text: '竞对在职候选人不接触' },
      },
    ]);
  });

  it('replacement, pause, accept, dismiss and archive freeze headers and bodies', async () => {
    请求Mock
      .mockResolvedValueOnce({ result: BFFAgent规则解释中提案样本, etag: null, requestId: 'p3' })
      .mockResolvedValueOnce({ result: { ...BFFAgent规则样本, version: 4, state: 'paused' }, etag: '"4"', requestId: 'r4' })
      .mockResolvedValueOnce({ result: BFFAgent规则样本, etag: '"3"', requestId: 'r5' })
      .mockResolvedValueOnce({ result: { ...BFFAgent规则就绪提案样本, state: 'dismissed' }, etag: null, requestId: 'p4' })
      .mockResolvedValueOnce({ result: undefined, etag: null, requestId: 'r6' });

    await 数据源.创建Agent规则替换提案('candidate', BFFAgent规则样本, '只接受双休');
    await 数据源.修改Agent规则('recruiter', BFFAgent规则样本.rule_id, 3, 'pause');
    await 数据源.接受Agent规则提案('candidate', BFFAgent规则就绪提案样本.proposal_id);
    await 数据源.放弃Agent规则提案('candidate', BFFAgent规则就绪提案样本.proposal_id);
    await 数据源.删除Agent规则('candidate', BFFAgent规则样本.rule_id, 3);

    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      {
        path: `/api/v1/me/agent-rules/${BFFAgent规则样本.rule_id}/replacement-proposals`,
        method: 'POST', body: { text: '只接受双休', scope: { type: 'global' } }, ifMatch: '"3"', 幂等: true,
      },
      {
        path: `/api/v1/recruiter/agent-rules/${BFFAgent规则样本.rule_id}`,
        method: 'PATCH', body: { operation: 'pause' }, ifMatch: '"3"',
      },
      {
        path: `/api/v1/me/agent-rule-proposals/${BFFAgent规则就绪提案样本.proposal_id}/accept`,
        method: 'POST', body: {}, 幂等: true,
      },
      {
        path: `/api/v1/me/agent-rule-proposals/${BFFAgent规则就绪提案样本.proposal_id}/dismiss`,
        method: 'POST', body: {}, 幂等: true,
      },
      {
        path: `/api/v1/me/agent-rules/${BFFAgent规则样本.rule_id}`,
        method: 'DELETE', ifMatch: '"3"',
      },
    ]);
  });

  it('recruiter replacement omits candidate scope', async () => {
    请求Mock.mockResolvedValueOnce({ result: BFFAgent规则解释中提案样本, etag: null, requestId: 'rp1' });
    await 数据源.创建Agent规则替换提案('recruiter', BFFAgent规则样本, '竞对候选人先人工确认');
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: `/api/v1/recruiter/agent-rules/${BFFAgent规则样本.rule_id}/replacement-proposals`,
      method: 'POST',
      body: { text: '竞对候选人先人工确认' },
      ifMatch: '"3"',
      幂等: true,
    });
  });

  it.each(['candidate', 'recruiter'] as const)('%s 读单条规则和单条提案用各自前缀的裸 GET', async (role) => {
    请求Mock
      .mockResolvedValueOnce({ result: BFFAgent规则样本, etag: '"3"', requestId: 'r1' })
      .mockResolvedValueOnce({ result: BFFAgent规则解释中提案样本, etag: null, requestId: 'r2' });
    await expect(数据源.读取单条Agent规则(role, BFFAgent规则样本.rule_id)).resolves.toEqual(BFFAgent规则样本);
    await expect(数据源.读取Agent规则提案(role, BFFAgent规则解释中提案样本.proposal_id))
      .resolves.toEqual(BFFAgent规则解释中提案样本);
    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      { path: `${前缀[role]}/agent-rules/${BFFAgent规则样本.rule_id}` },
      { path: `${前缀[role]}/agent-rule-proposals/${BFFAgent规则解释中提案样本.proposal_id}` },
    ]);
  });

  it('candidate 规则列表按过滤器拼出三种查询形式，recruiter 只有裸路径', async () => {
    const 意向ID = 'int_0123456789abcdef0123456789abcdef';
    const 过滤用例: [BFFAgent规则作用域 | undefined, string][] = [
      [undefined, `${前缀.candidate}/agent-rules`],
      [{ type: 'global' }, `${前缀.candidate}/agent-rules?scope=global`],
      [{ type: 'intention', intention_id: 意向ID },
        `${前缀.candidate}/agent-rules?scope=intention&intention_id=${意向ID}`],
    ];
    for (const [filter, path] of 过滤用例) {
      请求Mock.mockResolvedValueOnce({ result: { rules: [] }, etag: null, requestId: 'q' });
      await 数据源.读取Agent规则('candidate', filter);
      expect(请求Mock.mock.calls.at(-1)![0].path).toBe(path);
    }
    请求Mock.mockResolvedValueOnce({ result: { rules: [] }, etag: null, requestId: 'q' });
    await 数据源.读取Agent规则('recruiter');
    expect(请求Mock.mock.calls.at(-1)![0].path).toBe(`${前缀.recruiter}/agent-rules`);
  });

  it('recruiter 规则列表拒绝任何过滤参数且不发请求', async () => {
    await expect(数据源.读取Agent规则('recruiter', { type: 'global' }))
      .rejects.toMatchObject({ status: 0, code: 'invalid_request' });
    await expect(数据源.读取Agent规则('recruiter', {
      type: 'intention', intention_id: 'int_0123456789abcdef0123456789abcdef',
    })).rejects.toMatchObject({ code: 'invalid_request' });
    expect(请求Mock).not.toHaveBeenCalled();
  });

  it('提案列表固定 state=interpreting|ready 查询并区分角色前缀', async () => {
    for (const role of ['candidate', 'recruiter'] as const) {
      for (const state of ['interpreting', 'ready'] as const) {
        请求Mock.mockResolvedValueOnce({ result: { proposals: [] }, etag: null, requestId: 's' });
        await expect(数据源.读取Agent规则提案列表(role, state)).resolves.toEqual([]);
        expect(请求Mock.mock.calls.at(-1)![0].path).toBe(`${前缀[role]}/agent-rule-proposals?state=${state}`);
      }
    }
  });

  it('规则列表翻完所有页并拼接条目，cursor 追加且 encodeURIComponent', async () => {
    请求Mock
      .mockResolvedValueOnce({ result: { rules: [BFFAgent规则样本], next_cursor: '页/2+节' }, etag: null, requestId: 'p1' })
      .mockResolvedValueOnce({ result: { rules: [BFF意向Agent规则样本], next_cursor: '最后' }, etag: null, requestId: 'p2' })
      .mockResolvedValueOnce({ result: { rules: [] }, etag: null, requestId: 'p3' });
    await expect(数据源.读取Agent规则('candidate')).resolves.toEqual([BFFAgent规则样本, BFF意向Agent规则样本]);
    expect(请求Mock.mock.calls.map(([选项]) => 选项.path)).toEqual([
      '/api/v1/me/agent-rules',
      `/api/v1/me/agent-rules?cursor=${encodeURIComponent('页/2+节')}`,
      `/api/v1/me/agent-rules?cursor=${encodeURIComponent('最后')}`,
    ]);
  });

  it('已有 state 查询的提案列表用 &cursor= 翻页', async () => {
    请求Mock
      .mockResolvedValueOnce({ result: { proposals: [BFFAgent规则就绪提案样本], next_cursor: 'next-1' }, etag: null, requestId: 'l1' })
      .mockResolvedValueOnce({ result: { proposals: [] }, etag: null, requestId: 'l2' });
    await expect(数据源.读取Agent规则提案列表('candidate', 'ready')).resolves.toEqual([BFFAgent规则就绪提案样本]);
    expect(请求Mock.mock.calls.map(([选项]) => 选项.path)).toEqual([
      '/api/v1/me/agent-rule-proposals?state=ready',
      '/api/v1/me/agent-rule-proposals?state=ready&cursor=next-1',
    ]);
  });

  it('空串、非字符串或重复出现的 cursor 都按契约漂移拒绝', async () => {
    请求Mock
      .mockResolvedValueOnce({ result: { rules: [], next_cursor: '' }, etag: null, requestId: 'e1' });
    await expect(数据源.读取Agent规则('candidate')).rejects.toMatchObject({ status: 0, code: 'invalid_response' });

    请求Mock
      .mockResolvedValueOnce({ result: { rules: [], next_cursor: 7 }, etag: null, requestId: 'e2' });
    await expect(数据源.读取Agent规则('candidate')).rejects.toMatchObject({ code: 'invalid_response' });

    // 第二页继续吐同一个 cursor → 死循环风险，必须拒绝。
    请求Mock
      .mockResolvedValueOnce({ result: { rules: [], next_cursor: 'dup' }, etag: null, requestId: 'e3a' })
      .mockResolvedValue({ result: { rules: [], next_cursor: 'dup' }, etag: null, requestId: 'e3b' });
    await expect(数据源.读取Agent规则('candidate')).rejects.toMatchObject({
      status: 0, code: 'invalid_response',
    });
  });

  it('页 wrapper 缺 items 键、多出未知页键或条目不是数组都抛 invalid_response', async () => {
    请求Mock.mockResolvedValueOnce({ result: { items: [] }, etag: null, requestId: 'w1' });
    await expect(数据源.读取Agent规则('candidate')).rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce({ result: { rules: [], total: 5 }, etag: null, requestId: 'w2' });
    await expect(数据源.读取Agent规则('candidate')).rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce({ result: { rules: {} }, etag: null, requestId: 'w3' });
    await expect(数据源.读取Agent规则('candidate')).rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce({ result: { proposals: [], total: 5 }, etag: null, requestId: 'w4' });
    await expect(数据源.读取Agent规则提案列表('candidate', 'ready')).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('规则缺必需键或多出未知键抛 invalid_response', async () => {
    const { updated_at: _updated_at, ...缺键规则 } = BFFAgent规则样本;
    请求Mock.mockResolvedValueOnce({ result: 缺键规则, etag: '"3"', requestId: 'k1' });
    await expect(数据源.读取单条Agent规则('candidate', BFFAgent规则样本.rule_id))
      .rejects.toMatchObject({ status: 0, code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce({ result: { ...BFFAgent规则样本, subject_id: 'sub_1' }, etag: '"3"', requestId: 'k2' });
    await expect(数据源.读取单条Agent规则('candidate', BFFAgent规则样本.rule_id))
      .rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('非法 ID/版本/日期/display_text/state/scope/clause kind 抛 invalid_response', async () => {
    const 变体们: Record<string, unknown>[] = [
      { ...BFFAgent规则样本, rule_id: 'job_0123456789abcdef0123456789abcdef' },
      { ...BFFAgent规则样本, rule_id: 'RUL_0123456789ABCDEF0123456789ABCDEF' },
      { ...BFFAgent规则样本, version: 0 },
      { ...BFFAgent规则样本, version: -2 },
      { ...BFFAgent规则样本, version: 1.5 },
      { ...BFFAgent规则样本, version: '3' },
      { ...BFFAgent规则样本, created_at: 'yesterday' },
      { ...BFFAgent规则样本, updated_at: '' },
      { ...BFFAgent规则样本, display_text: '' },
      { ...BFFAgent规则样本, display_text: 42 },
      { ...BFFAgent规则样本, state: 'expired' },
      { ...BFFAgent规则样本, clause_kinds: ['work_schedule', 'sparkles'] },
      { ...BFFAgent规则样本, clause_kinds: 'work_schedule' },
      { ...BFFAgent规则样本, scope: { type: 'workspace' } },
      { ...BFFAgent规则样本, scope: { type: 'intention' } },
      { ...BFFAgent规则样本, scope: { type: 'intention', intention_id: 'INT_0123456789ABCDEF0123456789ABCDEF' } },
      { ...BFFAgent规则样本, scope: { type: 'intention', intention_id: 'int_0123456789abcdef0123456789abcdeX' } },
      { ...BFFAgent规则样本, scope: { type: 'global', intention_id: 'int_0123456789abcdef0123456789abcdef' } },
    ];
    for (const 变体 of 变体们) {
      请求Mock.mockResolvedValueOnce({ result: 变体, etag: '"3"', requestId: 'v' });
      await expect(数据源.读取单条Agent规则('candidate', BFFAgent规则样本.rule_id))
        .rejects.toMatchObject({ code: 'invalid_response' });
    }
    expect(请求Mock).toHaveBeenCalledTimes(变体们.length);
  });

  it('返回 ETag 与规则版本不一致时抛 invalid_response，一致时透传原 DTO', async () => {
    请求Mock.mockResolvedValueOnce({ result: BFFAgent规则样本, etag: '"4"', requestId: 't1' });
    await expect(数据源.读取单条Agent规则('candidate', BFFAgent规则样本.rule_id))
      .rejects.toMatchObject({ status: 0, code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce({ result: BFFAgent规则样本, etag: '"3"', requestId: 't2' });
    await expect(数据源.读取单条Agent规则('candidate', BFFAgent规则样本.rule_id)).resolves.toEqual(BFFAgent规则样本);

    请求Mock.mockResolvedValueOnce({ result: BFFAgent规则样本, etag: null, requestId: 't3' });
    await expect(数据源.修改Agent规则('candidate', BFFAgent规则样本.rule_id, 3, 'resume'))
      .rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('interpreting 回执接受 absent 或合法 created_at，禁止 normalized_text/consequence', async () => {
    // fresh create：只有 proposal_id + state
    请求Mock.mockResolvedValueOnce({
      result: { proposal_id: BFFAgent规则解释中提案样本.proposal_id, state: 'interpreting' },
      etag: null, requestId: 'i1',
    });
    await expect(数据源.读取Agent规则提案('candidate', BFFAgent规则解释中提案样本.proposal_id))
      .resolves.toEqual({ proposal_id: BFFAgent规则解释中提案样本.proposal_id, state: 'interpreting' });

    // list/get 视图：加合法 created_at
    请求Mock.mockResolvedValueOnce({ result: BFFAgent规则解释中提案样本, etag: null, requestId: 'i2' });
    await expect(数据源.读取Agent规则提案('candidate', BFFAgent规则解释中提案样本.proposal_id))
      .resolves.toEqual(BFFAgent规则解释中提案样本);

    // 非法 created_at
    请求Mock.mockResolvedValueOnce({
      result: { ...BFFAgent规则解释中提案样本, created_at: '还没定' }, etag: null, requestId: 'i3',
    });
    await expect(数据源.读取Agent规则提案('candidate', BFFAgent规则解释中提案样本.proposal_id))
      .rejects.toMatchObject({ code: 'invalid_response' });

    // 解释中的回执不允许携带已定事实字段（即使值合法）
    请求Mock.mockResolvedValueOnce({
      result: { ...BFFAgent规则解释中提案样本, normalized_text: '提前出现' }, etag: null, requestId: 'i4',
    });
    await expect(数据源.读取Agent规则提案('candidate', BFFAgent规则解释中提案样本.proposal_id))
      .rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce({
      result: { ...BFFAgent规则解释中提案样本, consequence: 'mixed' }, etag: null, requestId: 'i5',
    });
    await expect(数据源.读取Agent规则提案('candidate', BFFAgent规则解释中提案样本.proposal_id))
      .rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('ready 回执缺任一已定字段都拒绝，带齐时原样解码', async () => {
    for (const 缺失键 of ['normalized_text', 'consequence', 'created_at'] as const) {
      const 残缺 = { ...BFFAgent规则就绪提案样本 };
      delete 残缺[缺失键];
      请求Mock.mockResolvedValueOnce({ result: 残缺, etag: null, requestId: `rd-${缺失键}` });
      await expect(数据源.读取Agent规则提案('candidate', BFFAgent规则就绪提案样本.proposal_id))
        .rejects.toMatchObject({ code: 'invalid_response' });
    }
    请求Mock.mockResolvedValueOnce({ result: BFFAgent规则就绪提案样本, etag: null, requestId: 'rd-ok' });
    await expect(数据源.读取Agent规则提案('candidate', BFFAgent规则就绪提案样本.proposal_id))
      .resolves.toEqual(BFFAgent规则就绪提案样本);
  });

  it('terminal 回执只允许五个公开键，出现过的可选项须过同样的校验', async () => {
    // 终态最小形状：只有 proposal_id + state
    请求Mock.mockResolvedValueOnce({
      result: { proposal_id: BFFAgent规则解释中提案样本.proposal_id, state: 'accepted' },
      etag: null, requestId: 'tm1',
    });
    await expect(数据源.放弃Agent规则提案('candidate', BFFAgent规则解释中提案样本.proposal_id))
      .resolves.toEqual({ proposal_id: BFFAgent规则解释中提案样本.proposal_id, state: 'accepted' });

    // 终态带全部可选项且值合法 → 通过
    请求Mock.mockResolvedValueOnce({
      result: { ...BFFAgent规则就绪提案样本, state: 'dismissed' }, etag: null, requestId: 'tm2',
    });
    await expect(数据源.放弃Agent规则提案('candidate', BFFAgent规则就绪提案样本.proposal_id))
      .resolves.toEqual({ ...BFFAgent规则就绪提案样本, state: 'dismissed' });

    // 畸形可选项逐个拒绝：坏后果 / 非串正文 / 坏日期
    for (const [字段, 值] of [
      ['consequence', '肯定的'], ['normalized_text', 7], ['created_at', 'never'],
    ] as const) {
      请求Mock.mockResolvedValueOnce({
        result: { ...BFFAgent规则就绪提案样本, state: 'failed', [字段]: 值 }, etag: null, requestId: `tm-${字段}`,
      });
      await expect(数据源.读取Agent规则提案('candidate', BFFAgent规则就绪提案样本.proposal_id))
        .rejects.toMatchObject({ code: 'invalid_response' });
    }

    // 终态多出未知键拒绝；未知状态也拒绝
    请求Mock.mockResolvedValueOnce({
      result: { ...BFFAgent规则就绪提案样本, state: 'accepted', extra: 1 }, etag: null, requestId: 'tm-extra',
    });
    await expect(数据源.读取Agent规则提案('candidate', BFFAgent规则就绪提案样本.proposal_id))
      .rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce({
      result: { proposal_id: BFFAgent规则解释中提案样本.proposal_id, state: 'closed' },
      etag: null, requestId: 'tm-state',
    });
    await expect(数据源.读取Agent规则提案('candidate', BFFAgent规则解释中提案样本.proposal_id))
      .rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('提案非法 ID、缺 proposal_id、未知键抛 invalid_response', async () => {
    for (const 破损 of [
      { ...BFFAgent规则解释中提案样本, proposal_id: 'pro_0123456789abcdef0123456789abcdef' },
      { state: 'ready' as const, normalized_text: '', consequence: 'advisory' as const, created_at: '2026-08-27T02:05:00Z' },
      { ...BFFAgent规则就绪提案样本, weight: 3 },
    ]) {
      请求Mock.mockResolvedValueOnce({ result: 破损, etag: null, requestId: 'bad-p' });
      await expect(数据源.读取Agent规则提案('candidate', BFFAgent规则解释中提案样本.proposal_id))
        .rejects.toMatchObject({ code: 'invalid_response' });
    }
  });

  it('创建文本去首尾空白并按 Unicode 码点限长，越界时本地拒绝不发请求', async () => {
    请求Mock.mockResolvedValueOnce({ result: BFFAgent规则解释中提案样本, etag: null, requestId: 'cp1' });
    await 数据源.创建Agent规则提案('candidate', '  大小周不谈  ', { type: 'global' });
    expect(请求Mock.mock.calls[0][0].body).toEqual({ text: '大小周不谈', scope: { type: 'global' } });

    // 3000 个 UTF-16 单元但只有 1500 个码点：按码点数放行
    请求Mock.mockResolvedValueOnce({ result: BFFAgent规则解释中提案样本, etag: null, requestId: 'cp2' });
    await 数据源.创建Agent规则提案('candidate', '𝕏'.repeat(1500), { type: 'global' });
    expect(请求Mock).toHaveBeenCalledTimes(2);

    for (const 无效 of ['', '   ', 'あ'.repeat(2001)]) {
      await expect(数据源.创建Agent规则提案('candidate', 无效, { type: 'global' }))
        .rejects.toMatchObject({ code: 'validation_failed' });
      await expect(数据源.创建Agent规则替换提案('recruiter', BFFAgent规则样本, 无效))
        .rejects.toMatchObject({ code: 'validation_failed' });
    }
    expect(请求Mock).toHaveBeenCalledTimes(2);
  });

  it('candidate 创建必须有 scope，recruiter 创建拒绝传入 scope 且不发请求', async () => {
    await expect(数据源.创建Agent规则提案('candidate', '大小周不谈'))
      .rejects.toMatchObject({ status: 0, code: 'invalid_request' });
    await expect(数据源.创建Agent规则提案('recruiter', '竞对不接触', { type: 'global' }))
      .rejects.toMatchObject({ code: 'invalid_request' });
    await expect(数据源.创建Agent规则提案('recruiter', '竞对不接触', {
      type: 'intention', intention_id: 'int_0123456789abcdef0123456789abcdef',
    })).rejects.toMatchObject({ code: 'invalid_request' });
    expect(请求Mock).not.toHaveBeenCalled();
  });
});
