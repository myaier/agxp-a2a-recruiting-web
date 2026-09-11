// 意向域数据源：BFF /api/v1/me/intentions 的读取与增删改。
// 从 HTTP招聘数据源 按真实后端 owner 拆出，协议代码（path / method / body / If-Match / 幂等 / status=active）
// 原样搬移，不改 URL、body、DTO 校验或错误透传。接口失败绝不回退 Mock。
//
// J-PILOT-02 Task 7：新增 读取指定意向（GET exact ID），并给 创建首次意向 / 更新意向
// 追加可选 建档写入跟踪 —— 发送前固定命令（创建复用原幂等键、CAS 带权威 revision），
// 响应一到先交回执，之后才 GET 列表。普通调用省略该参数，请求与行为逐字不变。

import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type { BFFOwnerIntention } from '../BFF契约';
import type {
  页面意向快照, 意向草稿型, 意向映射上下文, 首次意向输入, 建档待写入, 建档写入跟踪,
} from '../招聘数据源类型';
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
  /** 单条 owner 意向的 exact ID 读取（J-PILOT-02 Global 8）：已有本轮回执时只核对这一条，
   *  不用列表非空冒充本次成功。同源根路径，发送时带前导斜杠。 */
  读取指定意向(id: string): Promise<BFFOwnerIntention>;
  创建意向(draft: 意向草稿型, context: 意向映射上下文): Promise<页面意向快照>;
  /** 返回类型不变；跟踪在场时 POST 的 intention_id/revision 先交回执，之后才 GET 列表
   *  （Spec §5.3：列表失败不得丢掉 201 回执）。普通调用省略跟踪，行为逐字不变。 */
  创建首次意向(input: 首次意向输入, 跟踪?: 建档写入跟踪): Promise<页面意向快照>;
  /** 跟踪在场时按 first-intention-update 记 CAS 命令（ifMatch = 权威 revision）；
   *  日常意向 CRUD 省略该参数，请求形状与行为不变。 */
  更新意向(id: string, draft: 意向草稿型, context: 意向映射上下文, 跟踪?: 建档写入跟踪): Promise<页面意向快照>;
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
    async 读取指定意向(id) {
      const { result } = await 请求<BFFOwnerIntention>({ path: `/api/v1/me/intentions/${id}` });
      return result;
    },
    async 创建意向(draft, context) {
      await 请求<BFFOwnerIntention>({ path: '/api/v1/me/intentions', method: 'POST', body: 转意向写入(draft, context), 幂等: true });
      return 读取意向();
    },
    async 创建首次意向(input, 跟踪) {
      const body = 转首次意向写入(input);
      const 命令: 建档待写入 = {
        种类: 'first-intention-create',
        请求体: { ...body } as Record<string, unknown>,
        阶段: 'prepared',
      };
      const 定 = 跟踪?.发送前(命令) ?? 命令;
      const { result } = await 请求<BFFOwnerIntention>({
        path: '/api/v1/me/intentions',
        method: 'POST',
        body,
        幂等: true,
        ...(定.幂等键 !== undefined ? { 幂等键: 定.幂等键 } : {}),
      });
      // 201 的身份先落回执，之后才 GET 列表：列表失败也不丢这一条的 ID/revision
      跟踪?.已确认(定, { id: result.intention_id, revision: result.revision });
      return 读取意向();
    },
    async 更新意向(id, draft, context, 跟踪) {
      if (!context.原始) throw new Error('更新意向需要原始意向');
      const body = 转意向写入(draft, context);
      const 命令: 建档待写入 = {
        种类: 'first-intention-update',
        资源编号: id,
        请求体: { ...body } as Record<string, unknown>,
        ifMatch: context.原始.revision,
        阶段: 'prepared',
      };
      const 定 = 跟踪 === undefined ? 命令 : 跟踪.发送前(命令);
      const { result } = await 请求<BFFOwnerIntention>({
        path: `/api/v1/me/intentions/${id}`,
        method: 'PATCH',
        body,
        ifMatch: 修订etag(context.原始.revision),
      });
      跟踪?.已确认(定, { id: result.intention_id, revision: result.revision });
      return 读取意向();
    },
    async 删除意向(id, revision) {
      await 请求<BFF意向删除回执>({ path: `/api/v1/me/intentions/${id}`, method: 'DELETE', ifMatch: 修订etag(revision) });
      return 读取意向();
    },
  };
}