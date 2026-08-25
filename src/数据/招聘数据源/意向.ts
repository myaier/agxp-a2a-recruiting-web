// 意向域数据源：BFF /api/v1/me/intentions 的读取与增删改。
// 从 HTTP招聘数据源 按真实后端 owner 拆出，协议代码（path / method / body / If-Match / 幂等 / status=active）
// 原样搬移，不改 URL、body、DTO 校验或错误透传。接口失败绝不回退 Mock。

import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type { BFFOwnerIntention } from '../BFF契约';
import type { 页面意向快照, 意向草稿型, 意向映射上下文, 首次意向输入 } from '../招聘数据源类型';
import { 从BFF意向, 转意向写入, 转首次意向写入 } from '../后端映射';
import type { 求职意向 } from '../类型';

interface BFF意向列表 {
  intentions: BFFOwnerIntention[];
}
interface BFF意向删除回执 {
  intention_id: string;
  status: string;
}

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

function 修订etag(revision: number): string {
  return `"${revision}"`;
}

export interface 意向数据源 {
  读取意向(): Promise<页面意向快照>;
  创建意向(draft: 意向草稿型, context: 意向映射上下文): Promise<页面意向快照>;
  创建首次意向(input: 首次意向输入): Promise<页面意向快照>;
  更新意向(id: string, draft: 意向草稿型, context: 意向映射上下文): Promise<页面意向快照>;
  删除意向(id: string, revision: number): Promise<页面意向快照>;
}

export function 创建意向数据源(请求: 请求函数): 意向数据源 {
  async function 读取意向(): Promise<页面意向快照> {
    const { result } = await 请求<BFF意向列表>({ path: '/api/v1/me/intentions?status=active' });
    const 列表: 求职意向[] = result.intentions.map(从BFF意向);
    const 服务端: Record<string, BFFOwnerIntention> = {};
    for (const 项 of result.intentions) 服务端[项.intention_id] = 项;
    return { 列表, 服务端 };
  }

  return {
    读取意向,
    async 创建意向(draft, context) {
      await 请求<BFFOwnerIntention>({ path: '/api/v1/me/intentions', method: 'POST', body: 转意向写入(draft, context), 幂等: true });
      return 读取意向();
    },
    async 创建首次意向(input) {
      await 请求<BFFOwnerIntention>({
        path: '/api/v1/me/intentions',
        method: 'POST',
        body: 转首次意向写入(input),
        幂等: true,
      });
      return 读取意向();
    },
    async 更新意向(id, draft, context) {
      if (!context.原始) throw new Error('更新意向需要原始意向');
      await 请求<BFFOwnerIntention>({
        path: `/api/v1/me/intentions/${id}`,
        method: 'PATCH',
        body: 转意向写入(draft, context),
        ifMatch: 修订etag(context.原始.revision),
      });
      return 读取意向();
    },
    async 删除意向(id, revision) {
      await 请求<BFF意向删除回执>({ path: `/api/v1/me/intentions/${id}`, method: 'DELETE', ifMatch: 修订etag(revision) });
      return 读取意向();
    },
  };
}