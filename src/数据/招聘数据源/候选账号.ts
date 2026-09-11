// 候选账号档案域：头像的权威 revision、上传、删除与内容地址。
// 响应按 OpenAPI 闭合解码；multipart 只发送 media，不手写 Content-Type。
// J-PILOT-02 Task 8：替换候选头像 在原参数之后追加可选 建档写入跟踪 ——
// 发送前固定 avatar 命令（五键文件核对 + 原 revision 的 ifMatch，绝不存字节），
// 沿用跟踪回带的原幂等键 / 原 If-Match（revision 也是幂等身份，Spec §6），
// 成功后立刻交 account revision 回执；跟踪缺省时行为与原实现逐字一致。

import { BFF错误 } from '../HTTP客户端';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type { 建档文件核对, 建档待写入, 建档写入跟踪 } from '../招聘数据源类型';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

export interface BFF候选账号档案 {
  avatar_url: '/api/v1/me/avatar/content' | null;
  revision: number;
  updated_at: string | null;
}

export interface 候选账号数据源 {
  读取候选账号档案(): Promise<BFF候选账号档案>;
  替换候选头像(file: File, revision: number, 跟踪?: 建档写入跟踪): Promise<BFF候选账号档案>;
  删除候选头像(revision: number): Promise<BFF候选账号档案>;
}

function 契约错误(): BFF错误 {
  return new BFF错误(200, 'invalid_response', '服务返回了不符合契约的候选账号数据');
}

function 解候选账号档案(input: unknown): BFF候选账号档案 {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw 契约错误();
  const raw = input as Record<string, unknown>;
  const 键 = Object.keys(raw);
  if (键.length !== 3 || !键.includes('avatar_url') || !键.includes('revision') || !键.includes('updated_at')) {
    throw 契约错误();
  }
  if (raw.avatar_url !== null && raw.avatar_url !== '/api/v1/me/avatar/content') throw 契约错误();
  if (typeof raw.revision !== 'number' || !Number.isInteger(raw.revision) || raw.revision < 0) throw 契约错误();
  if (raw.updated_at !== null && typeof raw.updated_at !== 'string') throw 契约错误();
  return {
    avatar_url: raw.avatar_url,
    revision: raw.revision,
    updated_at: raw.updated_at,
  };
}

function 修订etag(revision: number): string {
  return `"${revision}"`;
}

// ── J-PILOT-02 Task 8：头像命令的建档跟踪（与 附件简历.ts 文件命令同一模式）──

/**
 * 文件核对元数据：只有 name/type/size/lastModified 与内容 SHA-256 —— 绝不留字节，
 * 供「未知结果后用户重选同一张图片」核对。摘要不可用（非安全上下文）时返回 null，
 * 命令就不带 文件核对（调用方对认不出字节的命令不登记，Task 6 同款纪律）。
 */
async function 算文件核对(file: File): Promise<建档文件核对 | null> {
  try {
    const 摘要 = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      sha256: [...new Uint8Array(摘要)].map((字节) => 字节.toString(16).padStart(2, '0')).join(''),
    };
  } catch {
    return null;
  }
}

export function 创建候选账号数据源(请求: 请求函数): 候选账号数据源 {
  return {
    async 读取候选账号档案() {
      const { result } = await 请求<unknown>({
        path: '/api/v1/me/account-profile',
        不缓存: true,
      });
      return 解候选账号档案(result);
    },
    async 替换候选头像(file, revision, 跟踪) {
      const formData = new FormData();
      formData.append('media', file);
      // 跟踪在场时：先固定命令（抛出即本地拦截，请求一次都不发），请求沿用跟踪
      // 回带的原幂等键 / 原 ifMatch —— 重放不拿新快照的 revision 冒充原命令（Spec §6）。
      let 定: 建档待写入 | null = null;
      let 用revision = revision;
      if (跟踪 !== undefined) {
        const 核对 = await 算文件核对(file);
        const 命令: 建档待写入 = {
          种类: 'avatar',
          ifMatch: revision,
          阶段: 'prepared',
          ...(核对 !== null ? { 文件核对: 核对 } : {}),
        };
        定 = 跟踪.发送前(命令);
        if (定.ifMatch !== undefined) 用revision = 定.ifMatch;
      }
      const { result } = await 请求<unknown>({
        path: '/api/v1/me/avatar',
        method: 'POST',
        formData,
        ifMatch: 修订etag(用revision),
        幂等: true,
        ...(定?.幂等键 !== undefined ? { 幂等键: 定.幂等键 } : {}),
      });
      const 档案 = 解候选账号档案(result);
      // 回执只带 account revision（不存完整响应），先于任何后续 GET 交出
      if (跟踪 !== undefined && 定 !== null) 跟踪.已确认(定, { revision: 档案.revision });
      return 档案;
    },
    async 删除候选头像(revision) {
      const { result } = await 请求<unknown>({
        path: '/api/v1/me/avatar',
        method: 'DELETE',
        ifMatch: 修订etag(revision),
        幂等: true,
      });
      return 解候选账号档案(result);
    },
  };
}
