// 岗位域数据源测试：OwnerJob 读取页的 hard_requirements 完整性校验 fail closed ——
// 缺任一成员、枚举外值、多余成员都必须在状态层与映射层见到 DTO 之前按 invalid_response 拒绝。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type BFF请求选项, type BFF响应 } from '../HTTP客户端';
import { BFF岗位样本 } from '../../测试/BFF样本';
import { 创建岗位附属存储 } from '../前端附属数据';
import { 创建岗位数据源 } from './岗位';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

function 内存附属存储() {
  const values = new Map<string, string>();
  return 创建岗位附属存储({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
}

const 硬性成员 = ['alternate_weekend_work', 'outsourcing_only', 'onsite_only', 'frequent_travel'] as const;
const 完整硬性条件: Record<(typeof 硬性成员)[number], string> = {
  alternate_weekend_work: 'required',
  outsourcing_only: 'not_required',
  onsite_only: 'unknown',
  frequent_travel: 'required',
};

describe('岗位数据源 hard_requirements 校验', () => {
  const 请求Mock = vi.fn();
  const 数据源 = 创建岗位数据源(请求Mock as unknown as 请求函数, 'stg' as const, 内存附属存储());
  beforeEach(() => {
    请求Mock.mockReset();
  });

  function 页返回(jobs: unknown[]) {
    请求Mock.mockResolvedValue({ result: { jobs, next_cursor: null }, etag: null, requestId: 'r-jobs' });
  }

  it('hard_requirements 缺任一成员 / 枚举外值 / 多余成员 都让 读取岗位 抛 invalid_response', async () => {
    // 逐个去掉一个成员（wire 上就是缺键）
    for (const 成员 of 硬性成员) {
      const 缺员 = { ...完整硬性条件 };
      delete 缺员[成员];
      页返回([{ ...BFF岗位样本, hard_requirements: 缺员 }]);
      await expect(数据源.读取岗位()).rejects.toMatchObject({ status: 200, code: 'invalid_response' });
    }
    // 一个未知档位
    页返回([{ ...BFF岗位样本, hard_requirements: { ...完整硬性条件, onsite_only: 'banned' } }]);
    await expect(数据源.读取岗位()).rejects.toMatchObject({ code: 'invalid_response' });
    // 一个多余成员
    页返回([{ ...BFF岗位样本, hard_requirements: { ...完整硬性条件, extra_fact: true } }]);
    await expect(数据源.读取岗位()).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('完整 hard_requirements 映射进页面 硬性事实，服务端快照保留 DTO', async () => {
    // BFF岗位样本 的四员块：unknown / not_required / unknown / unknown
    页返回([{ ...BFF岗位样本 }]);
    const 快照 = await 数据源.读取岗位();
    expect(快照.列表[0].硬性事实).toEqual({
      大小周: '未说明', 纯外包乙方: '不要求', 全现场办公: '未说明', 频繁出差: '未说明',
    });
    expect(快照.服务端.job_1.hard_requirements).toEqual({
      alternate_weekend_work: 'unknown',
      outsourcing_only: 'not_required',
      onsite_only: 'unknown',
      frequent_travel: 'unknown',
    });
  });
});
