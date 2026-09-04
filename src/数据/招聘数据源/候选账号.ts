// 候选账号档案域：头像的权威 revision、上传、删除与内容地址。
// 响应按 OpenAPI 闭合解码；multipart 只发送 media，不手写 Content-Type。

import { BFF错误 } from '../HTTP客户端';
import type { BFF请求选项, BFF响应 } from '../HTTP客户端';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

export interface BFF候选账号档案 {
  avatar_url: '/api/v1/me/avatar/content' | null;
  revision: number;
  updated_at: string | null;
}

export interface 候选账号数据源 {
  读取候选账号档案(): Promise<BFF候选账号档案>;
  替换候选头像(file: File, revision: number): Promise<BFF候选账号档案>;
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

export function 创建候选账号数据源(请求: 请求函数): 候选账号数据源 {
  return {
    async 读取候选账号档案() {
      const { result } = await 请求<unknown>({
        path: '/api/v1/me/account-profile',
        不缓存: true,
      });
      return 解候选账号档案(result);
    },
    async 替换候选头像(file, revision) {
      const formData = new FormData();
      formData.append('media', file);
      const { result } = await 请求<unknown>({
        path: '/api/v1/me/avatar',
        method: 'POST',
        formData,
        ifMatch: 修订etag(revision),
        幂等: true,
      });
      return 解候选账号档案(result);
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
