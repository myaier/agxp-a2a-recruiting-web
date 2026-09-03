// Backend contact-events 域 facade 的行为测试 —— strict decoder（页/item/organization
// 三层闭合键集、闭合 action、event/organization ID pattern、1–200 组织展示名、
// 严格 RFC3339、同页 event_id 不重复、next_cursor null 或 ≤512 base64url 全部
// fail closed）与首屏/续页查询参数、调用方 cursor 的发请求前校验。
// fixture 全部是闭合 wire 形状；接口失败绝不回退 Mock（本域也没有 Mock 分支）。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BFF错误, type BFF请求选项, type BFF响应 } from '../HTTP客户端';
import { 创建接触记录数据源, 解接触事件页 } from './接触记录';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

const wire事件 = {
  event_id: 'cev_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  organization: {
    organization_id: 'org_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    display_name: 'Acme',
  },
  action: 'contact_started',
  occurred_at: '2026-09-01T08:00:00Z',
};

const wire页 = { items: [wire事件], next_cursor: null };

describe('解接触事件页', () => {
  it('合法页整页解出规范化 DTO', () => {
    const 页 = 解接触事件页(wire页);
    expect(页).toEqual({
      items: [{
        eventId: 'cev_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        organization: {
          organizationId: 'org_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          displayName: 'Acme',
        },
        action: 'contact_started',
        occurredAt: '2026-09-01T08:00:00Z',
      }],
      nextCursor: null,
    });
  });

  it.each([
    'anonymous_profile_viewed',
    'contact_started',
    'submitted_resume_viewed',
  ] as const)('接受闭合 action %s', (action) => {
    expect(解接触事件页({ ...wire页, items: [{ ...wire事件, action }] }).items[0].action)
      .toBe(action);
  });

  it('合法 next_cursor 解出字符串，null 解出 null', () => {
    expect(解接触事件页({ ...wire页, next_cursor: 'Y3Vyc29yXzI' }).nextCursor)
      .toBe('Y3Vyc29yXzI');
    expect(解接触事件页(wire页).nextCursor).toBeNull();
  });

  it('空 items 是合法空页', () => {
    expect(解接触事件页({ items: [], next_cursor: null })).toEqual({ items: [], nextCursor: null });
  });

  it('同页 event ID 重复按契约漂移拒绝', () => {
    expect(() => 解接触事件页({ ...wire页, items: [wire事件, wire事件] })).toThrowError(
      expect.objectContaining({ status: 200, code: 'invalid_response' }),
    );
  });

  it.each([
    // 未知键：页级 / item 级 / organization 级逐层闭合
    { ...wire页, extra: true },
    { ...wire页, items: [{ ...wire事件, organization: { ...wire事件.organization, extra: 1 } }] },
    { ...wire页, items: [{ ...wire事件, recruiter_name: 'Alice' }] },
    // 坏 enum
    { ...wire页, items: [{ ...wire事件, action: 'profile_downloaded' }] },
    // 坏时间
    { ...wire页, items: [{ ...wire事件, occurred_at: 'yesterday' }] },
    { ...wire页, items: [{ ...wire事件, occurred_at: '2026-09-01' }] },
    // 坏 ID
    { ...wire页, items: [{ ...wire事件, event_id: 'cev_short' }] },
    { ...wire页, items: [{ ...wire事件, organization: { ...wire事件.organization, organization_id: 'org_short' } }] },
    // 空 / 过长 display_name（1–200）
    { ...wire页, items: [{ ...wire事件, organization: { ...wire事件.organization, display_name: '' } }] },
    { ...wire页, items: [{ ...wire事件, organization: { ...wire事件.organization, display_name: 'x'.repeat(201) } }] },
    // 坏 / 过长 / 缺 next_cursor
    { ...wire页, next_cursor: 'bad cursor' },
    { ...wire页, next_cursor: '' },
    { ...wire页, next_cursor: 'c'.repeat(513) },
    { items: [wire事件] },
  ])('契约漂移 fail closed', (input) => {
    expect(() => 解接触事件页(input)).toThrowError(
      expect.objectContaining({ status: 200, code: 'invalid_response' }),
    );
  });
});

describe('创建接触记录数据源', () => {
  const 请求Mock = vi.fn();
  const 请求 = 请求Mock as unknown as 请求函数;

  beforeEach(() => {
    请求Mock.mockReset();
    请求Mock.mockResolvedValue({ result: wire页, etag: null, requestId: 'r1' });
  });

  it('无 cursor 首屏请求 limit=50 且不缓存', async () => {
    const 源 = 创建接触记录数据源(请求);
    await 源.读取接触事件();
    expect(请求Mock).toHaveBeenCalledTimes(1);
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/me/contact-events?limit=50',
      不缓存: true,
    });
  });

  it('有 cursor 续页带上 URL 编码的 cursor', async () => {
    const 源 = 创建接触记录数据源(请求);
    await 源.读取接触事件('Y3Vyc29yXzI');
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/me/contact-events?limit=50&cursor=Y3Vyc29yXzI',
      不缓存: true,
    });
  });

  it.each([
    '',
    'bad cursor',
    'c'.repeat(513),
  ])('非法调用方 cursor %j 发请求前抛 invalid_request 且零请求', async (cursor) => {
    const 源 = 创建接触记录数据源(请求);
    await expect(源.读取接触事件(cursor)).rejects.toThrowError(
      expect.objectContaining({ status: 0, code: 'invalid_request' }),
    );
    expect(请求Mock).not.toHaveBeenCalled();
  });

  it('响应体先过 strict decode：坏页原样抛 BFF错误', async () => {
    请求Mock.mockResolvedValue({ result: { ...wire页, extra: true }, etag: null, requestId: 'r1' });
    const 源 = 创建接触记录数据源(请求);
    await expect(源.读取接触事件()).rejects.toThrowError(
      expect.objectContaining({ status: 200, code: 'invalid_response' }),
    );
  });

  it('接口失败原样抛出（BFF错误 不经本层改写）', async () => {
    请求Mock.mockRejectedValue(new BFF错误(500, 'internal_error', '服务暂不可用'));
    const 源 = 创建接触记录数据源(请求);
    await expect(源.读取接触事件()).rejects.toThrowError(
      expect.objectContaining({ status: 500, code: 'internal_error' }),
    );
  });
});