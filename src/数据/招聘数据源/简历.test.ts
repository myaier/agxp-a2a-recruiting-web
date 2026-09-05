// 简历数据源分区写入 · 空身份（M）：身份为 '' 时 profile 分区整体跳过，
// summary/skills/experiences/educations/certificates 仍独立 diff 照发；
// 身份非空且 profile 变化时才 PATCH。转资料写入 本身拒绝空身份（后端映射测试覆盖），
// 这里验证数据源不会因为 Context 里未提交的 /basic 草稿（空身份 + 本地姓名/生日）
// 抛错或阻断其它五个分区。

import { describe, expect, it, vi } from 'vitest';
import { BFF简历样本 } from '../../测试/BFF样本';
import { 从BFF简历 } from '../后端映射';
import { 创建简历数据源 } from './简历';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

/** 记录全部调用的 mock 请求：GET /me/resume 返回 最终简历（默认 BFF简历样本） */
function 请求桩(最终简历: typeof BFF简历样本 = BFF简历样本) {
  const 请求Mock = vi.fn(async (_选项: BFF请求选项) => ({ result: 最终简历, etag: null, requestId: 'r1' }));
  return { 请求Mock, 请求: 请求Mock as unknown as 请求函数 };
}

const 空身份页面 = (dto: typeof BFF简历样本) => {
  const 页面 = 从BFF简历(dto);
  return { ...页面, 基本信息: { ...页面.基本信息, 身份: '' as const } };
};

const 空profile简历 = (): typeof BFF简历样本 => ({
  ...BFF简历样本,
  profile: { ...BFF简历样本.profile, real_name: '', work_start_year: null, status: '' },
});

describe('简历数据源 · 空身份跳过 profile 分区（M）', () => {
  it('previous/next 身份均为空且只改技能：不发 profile PATCH，只发 skills PATCH', async () => {
    const previous = 空profile简历();
    const { 请求Mock, 请求 } = 请求桩();
    const next = { ...空身份页面(previous), 技能: ['TypeScript', 'React'] };
    await 创建简历数据源(请求).保存简历(next, previous);
    const 调用 = 请求Mock.mock.calls.map((c) => [(c[0] as BFF请求选项).method ?? 'GET', (c[0] as BFF请求选项).path]);
    expect(调用).toEqual([
      ['PATCH', '/api/v1/me/resume/skills'],
      ['GET', '/api/v1/me/resume'],
    ]);
  });

  it('previous 空 profile，next 空身份但带 /basic 本地姓名生日并改技能：跳过 profile，其余照发', async () => {
    const previous = 空profile简历();
    const { 请求Mock, 请求 } = 请求桩();
    const next = {
      ...空身份页面(previous),
      基本信息: { ...空身份页面(previous).基本信息, 真名: '沈', 出生年: '1998', 出生月: '6' },
      技能: ['TypeScript', 'React'],
    };
    await expect(创建简历数据源(请求).保存简历(next, previous)).resolves.toBeDefined();
    const 调用 = 请求Mock.mock.calls.map((c) => [(c[0] as BFF请求选项).method ?? 'GET', (c[0] as BFF请求选项).path]);
    expect(调用).toEqual([
      ['PATCH', '/api/v1/me/resume/skills'],
      ['GET', '/api/v1/me/resume'],
    ]);
  });

  it('previous 空 status、next 身份为离职：恰发一次 profile PATCH 且 body status = unemployed', async () => {
    const previous = 空profile简历();
    const { 请求Mock, 请求 } = 请求桩();
    const 页面 = 从BFF简历(previous);
    const next = { ...页面, 基本信息: { ...页面.基本信息, 身份: '离职' as const } };
    await 创建简历数据源(请求).保存简历(next, previous);
    const profile调用 = 请求Mock.mock.calls
      .map((c) => c[0] as BFF请求选项)
      .filter((选项) => 选项.path === '/api/v1/me/resume/profile');
    expect(profile调用).toHaveLength(1);
    expect(profile调用[0].body).toMatchObject({ status: 'unemployed' });
  });
});
