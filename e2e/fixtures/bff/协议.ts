// e2e/fixtures/bff/协议.ts
// BFF fixture 的共用协议件（C2）：重复的信封/目录页构造、multipart 部件切分、
// 请求拦截投影与写入 body 的键集断言。从 e2e/数据源模式.spec.ts 原样迁出，
// 不含任何域状态；域间共享的只有这些纯函数与纯类型。

import { expect, type Request, type Route } from '@playwright/test';

// ── BFF 信封与目录页 ──

/** BFF 信封：{ result, meta: { request_id, api_version } } */
export function 信封<T>(result: T): { result: T; meta: { request_id: string; api_version: 'v1' } } {
  return { result, meta: { request_id: 'fixture-req', api_version: 'v1' } };
}

/** BFF 目录页：items + next_cursor + catalog_version */
export function 目录页<T extends { id: string; display_name: string }>(items: T[]): {
  items: T[];
  next_cursor: string | null;
  catalog_version: string;
} {
  return { items, next_cursor: null, catalog_version: 'fixture-v1' };
}

// ── 写入 body 的键集断言（候选 onboarding 与默认 onboarding 路由共用） ──

/** 精确键集：Object.keys(body).sort() 必须与允许键集完全一致（多一个少一个都拒收） */
export function 断言精确键集(body: unknown, 允许键: readonly string[]): void {
  expect(body).toBeTruthy();
  expect(Object.keys(body as object).sort()).toEqual([...允许键].sort());
}

/** 闭合键集（带可选键的端点用）：未知字段一律拒收，必含键缺席也拒收 */
export function 断言闭合键集(body: unknown, 允许键: readonly string[], 必含键: readonly string[]): void {
  expect(body).toBeTruthy();
  const 键们 = Object.keys(body as object);
  expect(键们.filter((键) => !允许键.includes(键))).toEqual([]);
  for (const 键 of 必含键) expect(键们).toContain(键);
}

// ── 请求拦截投影 ──

/** 请求拦截收到的请求投影；multipart 的 metadata 只在测试进程内比对 */
export interface 拦截请求形 {
  path: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
  /** URL query 原文（含 ?；组织搜索断言 q/limit/cursor 用） */
  query?: string;
  /** multipart 请求：part 名按出现顺序 + metadata part 内容（无则 undefined） */
  multipart?: { parts: string[]; metadata?: unknown };
}

// ── multipart 部件切分 ──

/**
 * 按 content-type boundary 切分 multipart body，取 part 名 / part 类型 / part 字节。
 * 不用 JSON parser 解析整体：boundary 字节是 ASCII，latin1 索引与原 Buffer 一一对应，
 * part 内容回切原 Buffer 后再按需 utf8 解码。
 */
export function 取multipart部件(请求: Request): { name: string; contentType: string; bytes: Buffer }[] | null {
  const 类型 = 请求.headers()['content-type'] ?? '';
  const 匹配 = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(类型);
  if (!匹配) return null;
  const 界串 = `--${(匹配[1] ?? 匹配[2]).trim()}`;
  const 原文 = 请求.postDataBuffer();
  if (!原文) return [];
  const 文本 = 原文.toString('latin1');
  const 部件: { name: string; contentType: string; bytes: Buffer }[] = [];
  let 位 = 文本.indexOf(界串);
  while (位 !== -1) {
    const 头起 = 位 + 界串.length;
    if (文本.slice(头起, 头起 + 2) === '--') break; // 终界
    const 头止 = 文本.indexOf('\r\n\r\n', 头起);
    if (头止 === -1) break;
    const 头 = 文本.slice(头起, 头止);
    const 名 = /name="([^"]*)"/i.exec(头)?.[1] ?? '';
    const 型 = /content-type:\s*([^\r\n]+)/i.exec(头)?.[1].trim() ?? '';
    const 下界 = 文本.indexOf(界串, 头止);
    const 体止 = 下界 === -1 ? 原文.length : 下界 - 2; // 去掉 part 尾部 \r\n
    部件.push({ name: 名, contentType: 型, bytes: 原文.subarray(头止 + 4, 体止) });
    if (下界 === -1) break;
    位 = 下界;
  }
  return 部件;
}

// ── metadata 部件解析 ──

/** metadata part 内容（application/json）：解析失败归 undefined，不让坏 JSON 中断路由 */
export function 解metadata部件(字节: Buffer): unknown {
  try {
    return JSON.parse(字节.toString('utf8'));
  } catch {
    return undefined;
  }
}

// ── 域 handler 的每请求上下文（由薄装配入口构造并按固定顺序传递）──

/** 一次 /api/v1 请求在域 handler 间的共享投影：route 与已解析的 path/method/body/部件们。 */
export interface 路由上下文形 {
  route: Route;
  /** route.request() 的调用结果（Route['request'] 是方法签名 () => Request，不是实例类型） */
  请求: Request;
  url: URL;
  path: string;
  method: string;
  body: unknown;
  部件们: { name: string; contentType: string; bytes: Buffer }[] | null;
}
