// 隐私域数据源测试：冻结 Privacy View / 屏蔽回执 的 method/path/body/If-Match/幂等 形状，
// 并锁定 strict decode（exact key set、闭合 enum、必需 updated_at、私有字段与 null 数组拒绝）。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import { BFF隐私视图样本, BFF屏蔽回执样本 } from '../../测试/BFF样本';
import { 创建隐私数据源 } from './隐私';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

describe('隐私数据源', () => {
  const 请求Mock = vi.fn();
  const 数据源 = 创建隐私数据源(请求Mock as unknown as 请求函数);
  beforeEach(() => 请求Mock.mockReset());

  it('GET/PATCH 使用完整 Privacy View 和 quoted revision', async () => {
    请求Mock
      .mockResolvedValueOnce({ result: BFF隐私视图样本, etag: '"2"', requestId: 'r1' })
      .mockResolvedValueOnce({ result: { ...BFF隐私视图样本, revision: 3 }, etag: '"3"', requestId: 'r2' });
    await 数据源.读取隐私();
    await 数据源.修改隐私({ employer_privacy_enabled: false }, 2);
    expect(请求Mock.mock.calls.map(([选项]) => 选项)).toEqual([
      { path: '/api/v1/me/privacy' },
      { path: '/api/v1/me/privacy', method: 'PATCH', body: { employer_privacy_enabled: false }, ifMatch: '"2"' },
    ]);
  });

  it('AddBlock 使用幂等键并接受 200/201 receipt shape', async () => {
    请求Mock.mockResolvedValue({ result: BFF屏蔽回执样本, etag: '"3"', requestId: 'r3' });
    await expect(数据源.添加组织屏蔽('org_1', 'manual', 2)).resolves.toEqual(BFF屏蔽回执样本);
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/me/privacy/organization-blocks', method: 'POST',
      body: { organization_id: 'org_1', source: 'manual' }, ifMatch: '"2"', 幂等: true,
    });
  });

  it('Unblock POST unblock 带 risk_acknowledged 与 If-Match，返回页面快照', async () => {
    请求Mock.mockResolvedValueOnce({ result: { ...BFF隐私视图样本, organization_blocks: [] }, etag: '"3"', requestId: 'r4' });
    await expect(数据源.解除组织屏蔽('org_block_1', true, 2)).resolves.toMatchObject({
      对现雇主隐身: true,
      屏蔽名单: [],
      服务端: { revision: 2 },
    });
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/me/privacy/organization-blocks/org_block_1/unblock',
      method: 'POST',
      body: { risk_acknowledged: true },
      ifMatch: '"2"',
    });
  });

  it('页面快照只投影四个页面自有字段，丢弃 updated_at', async () => {
    请求Mock.mockResolvedValueOnce({ result: BFF隐私视图样本, etag: '"2"', requestId: 'r5' });
    const 快照 = await 数据源.读取隐私();
    expect(Object.keys(快照)).toEqual(['对现雇主隐身', '披露偏好', '屏蔽名单', '服务端']);
    expect(Object.keys(快照.服务端).sort()).toEqual([
      'disclosure_preferences', 'employer_privacy_enabled', 'organization_blocks', 'revision',
    ]);
  });

  it('拒绝 null blocks、未知 source、缺 updated_at 和私有字段', async () => {
    for (const result of [
      { ...BFF隐私视图样本, organization_blocks: null },
      { ...BFF隐私视图样本, updated_at: undefined },
      { ...BFF隐私视图样本, organization_blocks: [{ ...BFF隐私视图样本.organization_blocks[0], source: 'other' }] },
      { ...BFF隐私视图样本, subject_id: 'private' },
    ]) {
      请求Mock.mockResolvedValueOnce({ result, etag: null, requestId: 'bad' });
      await expect(数据源.读取隐私()).rejects.toMatchObject({ code: 'invalid_response' });
    }
  });

  it('拒绝 receipt 私有字段', async () => {
    请求Mock.mockResolvedValueOnce({
      result: { ...BFF屏蔽回执样本, subject_id: 'private' }, etag: null, requestId: 'bad-receipt',
    });
    await expect(数据源.添加组织屏蔽('org_1', 'manual', 2))
      .rejects.toMatchObject({ code: 'invalid_response' });
  });
});
