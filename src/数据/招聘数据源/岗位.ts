// 岗位域数据源：BFF /api/v1/recruiter/jobs 的分页读取与增删改 + 附属存储。
// 从 HTTP招聘数据源 按真实后端 owner 拆出，协议代码（path / method / body / If-Match / 幂等 / 分页循环）
// 原样搬移，不改 URL、body、DTO 校验或错误透传。接口失败绝不回退 Mock。

import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type { BFFOwnerJob } from '../BFF契约';
import type { 后端环境 } from '../../配置/运行配置';
import type { 岗位附属存储 } from '../前端附属数据';
import type { 页面岗位快照, 岗位创建上下文 } from '../招聘数据源类型';
import type { 在招岗位 } from '../类型';
import { 从BFF岗位, 转岗位创建, 转岗位补丁 } from '../后端映射';

interface BFF岗位页 {
  jobs: BFFOwnerJob[];
  next_cursor?: string | null;
}
interface BFF删除回执 {
  deleted: boolean;
}

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

function 修订etag(revision: number): string {
  return `"${revision}"`;
}

export interface 岗位数据源 {
  读取岗位(): Promise<页面岗位快照>;
  /** P1C Task 5：创建只吃显式 claim（direct + 声明）；refs/verification status 服务端推导。 */
  创建岗位(job: 在招岗位, context: 岗位创建上下文): Promise<页面岗位快照>;
  /** P1C Task 5：更新不接公司 context —— 补丁沿用 previous 的 mode 与 claim。 */
  更新岗位(job: 在招岗位, previous: BFFOwnerJob): Promise<页面岗位快照>;
  归档岗位(id: string, revision: number): Promise<页面岗位快照>;
  重开岗位(id: string, revision: number): Promise<页面岗位快照>;
  删除岗位(id: string, revision: number): Promise<页面岗位快照>;
}

export function 创建岗位数据源(
  请求: 请求函数,
  后端环境: 后端环境,
  附属存储: 岗位附属存储,
): 岗位数据源 {
  async function 读取岗位(): Promise<页面岗位快照> {
    const 全部: BFFOwnerJob[] = [];
    let cursor: string | undefined;
    while (true) {
      const path = cursor
        ? (`/api/v1/recruiter/jobs?cursor=${encodeURIComponent(cursor)}` as `/api/v1/${string}`)
        : '/api/v1/recruiter/jobs';
      const { result } = await 请求<BFF岗位页>({ path });
      全部.push(...result.jobs);
      cursor = result.next_cursor ?? undefined;
      if (!cursor) break;
    }
    const 列表 = 全部.map((dto) => 从BFF岗位(dto, 附属存储.读取(后端环境, dto.job_id)));
    const 服务端: Record<string, BFFOwnerJob> = {};
    for (const 项 of 全部) 服务端[项.job_id] = 项;
    return { 列表, 服务端 };
  }

  function 写入岗位附属(jobId: string, job: 在招岗位): void {
    const 附属: { 加分关键词?: string[]; 实习转正?: boolean } = {};
    if (job.加分关键词) 附属.加分关键词 = job.加分关键词;
    if (job.实习转正 !== undefined) 附属.实习转正 = job.实习转正;
    附属存储.写入(后端环境, jobId, 附属);
  }

  return {
    读取岗位,
    async 创建岗位(job, context) {
      const { result } = await 请求<BFFOwnerJob>({
        path: '/api/v1/recruiter/jobs',
        method: 'POST',
        body: 转岗位创建(job, context),
        幂等: true,
      });
      写入岗位附属(result.job_id, job);
      return 读取岗位();
    },
    async 更新岗位(job, previous) {
      await 请求<BFFOwnerJob>({
        path: `/api/v1/recruiter/jobs/${job.编号}`,
        method: 'PATCH',
        body: 转岗位补丁(job, previous),
        ifMatch: 修订etag(previous.revision),
      });
      写入岗位附属(job.编号, job);
      return 读取岗位();
    },
    async 归档岗位(id, revision) {
      await 请求<BFFOwnerJob>({ path: `/api/v1/recruiter/jobs/${id}/archive`, method: 'POST', ifMatch: 修订etag(revision) });
      return 读取岗位();
    },
    async 重开岗位(id, revision) {
      await 请求<BFFOwnerJob>({ path: `/api/v1/recruiter/jobs/${id}/reopen`, method: 'POST', ifMatch: 修订etag(revision) });
      return 读取岗位();
    },
    async 删除岗位(id, revision) {
      await 请求<BFF删除回执>({ path: `/api/v1/recruiter/jobs/${id}`, method: 'DELETE', ifMatch: 修订etag(revision) });
      附属存储.删除(后端环境, id);
      return 读取岗位();
    },
  };
}