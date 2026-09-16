// 助手会话访问 seam 的身份 fence 单元测试（Task 4 / 合同 C）：
//   · candidate 有效会话才提供访问；范围键 = 环境 + subject + 角色 + 真实会话代际；
//   · 四个方法原样透传给数据源（不重写协议）；
//   · 请求前 / 响应后都核对主体与会话代际：过时成功与过时 401 都抛 AbortError，不清新会话
//     （同 subject 重新登录代际已递增，仅比较字符串 subject 不够）；
//   · 当前轮 401 收口到 清账号状态 全套依赖（派发清空 + 登出 + 清空目录缓存 + 代际递增）
//     后原样 rethrow，与既有会话操作同一口径。

import { describe, expect, it, vi } from 'vitest';
import { 创建助手会话访问, type 助手会话访问依赖 } from './助手会话访问';
import { BFF错误 } from '../../数据/HTTP客户端';
import type { BFF主体 } from '../../数据/BFF契约';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import type { AssistantMessage, AssistantMessagePage } from '../../数据/招聘数据源/助手会话';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const 候选主体: BFF主体 = {
  subject_id: 'sub_1',
  roles: [{ role: 'candidate', status: 'active' }],
  last_used_role: 'candidate',
};

const 成功消息: AssistantMessage = {
  message_id: `asm_${'11'.repeat(16)}`,
  turn_id: `ast_${'22'.repeat(16)}`,
  text: '你好',
  created_at: '2026-09-16T08:00:00Z',
  status: 'succeeded',
  retryable: false,
  error_code: null,
  reply: { text: '好的', visibility: 'available', cards: [] },
};

/** seam 单测的依赖桩：清账号状态 的可选引用缺席时跳过引用级清理，状态摊平仍可观察。 */
function 创建依赖(覆盖: Partial<助手会话访问依赖> = {}) {
  const 派发 = vi.fn<(动作: unknown) => void>();
  const 设后端状态 = vi.fn<(更新: (旧: unknown) => unknown) => void>();
  const 后端 = {
    读取助手历史: vi.fn<(cursor?: string) => Promise<AssistantMessagePage>>(
      async () => ({ items: [], next_cursor: null }),
    ),
    发送助手消息: vi.fn<(text: string, key: string) => Promise<AssistantMessage>>(
      async () => 成功消息,
    ),
    读取助手轮次: vi.fn<(turnId: string) => Promise<AssistantMessage>>(
      async () => 成功消息,
    ),
    重试助手轮次: vi.fn<(turnId: string, key: string) => Promise<AssistantMessage>>(
      async () => 成功消息,
    ),
    清空目录缓存: vi.fn(),
  };
  const 主体标识引用 = { current: 'sub_1' as string | null };
  const 会话代际 = { current: 5 };
  const deps = {
    是后端: true,
    后端: 后端 as unknown as HTTP招聘数据源,
    派发,
    设后端状态,
    主体标识引用,
    会话代际,
    环境: 'stg',
    主体: 候选主体,
    已登录: true,
    代际: 5,
    ...覆盖,
  } as 助手会话访问依赖;
  return { deps, 派发, 设后端状态, 后端, 主体标识引用, 会话代际 };
}

describe('创建助手会话访问', () => {
  it('candidate 有效会话提供访问：范围键含环境/主体/角色/代际，四方法透传', async () => {
    const { deps, 后端 } = 创建依赖();
    const seam = 创建助手会话访问(deps);
    expect(seam).not.toBe(null);
    expect(seam!.范围键).toBe('stg|sub_1|candidate|5');
    await seam!.api.读取助手历史();
    await seam!.api.发送助手消息('你好', 'key_0123456789abcdef');
    await seam!.api.读取助手轮次(`ast_${'33'.repeat(16)}`);
    await seam!.api.重试助手轮次(`ast_${'33'.repeat(16)}`, 'key_0123456789abcdee');
    expect(后端.读取助手历史).toHaveBeenCalledTimes(1);
    expect(后端.发送助手消息).toHaveBeenCalledWith('你好', 'key_0123456789abcdef');
    expect(后端.读取助手轮次).toHaveBeenCalledWith(`ast_${'33'.repeat(16)}`);
    expect(后端.重试助手轮次).toHaveBeenCalledWith(`ast_${'33'.repeat(16)}`, 'key_0123456789abcdee');
  });

  it('Mock / 未登录 / 主体缺席 / 非 candidate 角色一律不提供', () => {
    expect(创建助手会话访问(创建依赖({ 是后端: false }).deps)).toBe(null);
    expect(创建助手会话访问(创建依赖({ 后端: null }).deps)).toBe(null);
    expect(创建助手会话访问(创建依赖({ 已登录: false }).deps)).toBe(null);
    expect(创建助手会话访问(创建依赖({ 主体: null }).deps)).toBe(null);
    expect(创建助手会话访问(创建依赖({
      主体: { ...候选主体, last_used_role: 'recruiter' },
    }).deps)).toBe(null);
  });

  it('请求前身份已过时（同 subject 代际已变）：不触网直接 AbortError', async () => {
    const { deps, 后端, 会话代际 } = 创建依赖();
    const seam = 创建助手会话访问(deps)!;
    会话代际.current = 6; // 同 subject 重新登录：代际递增，旧 seam 失效
    await expect(seam.api.读取助手历史()).rejects.toMatchObject({ name: 'AbortError' });
    expect(后端.读取助手历史).not.toHaveBeenCalled();
  });

  it('迟到成功（响应后主体已换）整包丢弃：抛 AbortError，不落任何派发', async () => {
    const { deps, 后端, 派发, 主体标识引用 } = 创建依赖();
    const 页 = deferred<AssistantMessagePage>();
    后端.读取助手历史.mockReturnValue(页.promise);
    const seam = 创建助手会话访问(deps)!;
    const 请求 = seam.api.读取助手历史();
    主体标识引用.current = 'sub_2'; // 换主体登录
    页.resolve({ items: [成功消息], next_cursor: null });
    await expect(请求).rejects.toMatchObject({ name: 'AbortError' });
    expect(派发).not.toHaveBeenCalled();
  });

  it('迟到成功（同 subject 但代际已变）同样丢弃：仅比较字符串 subject 不够', async () => {
    const { deps, 后端, 会话代际 } = 创建依赖();
    const 轮 = deferred<AssistantMessage>();
    后端.读取助手轮次.mockReturnValue(轮.promise);
    const seam = 创建助手会话访问(deps)!;
    const 请求 = seam.api.读取助手轮次(`ast_${'33'.repeat(16)}`);
    会话代际.current = 6; // 同账号重登：代际变化
    轮.resolve(成功消息);
    await expect(请求).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('过时 401 不清新会话：抛 AbortError，零派发、零目录缓存清理', async () => {
    const { deps, 后端, 派发, 会话代际 } = 创建依赖();
    const 失败 = deferred<AssistantMessage>();
    后端.发送助手消息.mockReturnValue(失败.promise);
    const seam = 创建助手会话访问(deps)!;
    const 请求 = seam.api.发送助手消息('你好', 'key_0123456789abcdef');
    会话代际.current = 6; // 请求在飞期间开了新会话：这是旧会话的 401
    失败.reject(new BFF错误(401, 'invalid_session', 'expired'));
    await expect(请求).rejects.toMatchObject({ name: 'AbortError' });
    expect(派发).not.toHaveBeenCalled();
    expect(后端.清空目录缓存).not.toHaveBeenCalled();
    expect(会话代际.current).toBe(6); // 不因旧 401 再递增
  });

  it('当前轮 401 走 清账号状态 全套依赖后原样 rethrow', async () => {
    const { deps, 后端, 派发, 设后端状态, 主体标识引用, 会话代际 } = 创建依赖();
    后端.读取助手历史.mockRejectedValue(new BFF错误(401, 'invalid_session', 'expired'));
    const seam = 创建助手会话访问(deps)!;
    await expect(seam.api.读取助手历史()).rejects.toMatchObject({
      status: 401,
      code: 'invalid_session',
    });
    // 支持域快照清空 + 登出 + 清目录缓存 + 主体/代际复位，与既有会话操作同口径
    expect(派发).toHaveBeenCalledWith({ 型: '清后端隐私' });
    expect(派发).toHaveBeenCalledWith({ 型: '清后端草稿' });
    expect(派发).toHaveBeenCalledWith({ 型: '清后端Agent规则' });
    expect(派发).toHaveBeenCalledWith({ 型: '清后端MatchCase演示状态' });
    expect(设后端状态).toHaveBeenCalled();
    expect(后端.清空目录缓存).toHaveBeenCalledTimes(1);
    expect(主体标识引用.current).toBe(null);
    expect(会话代际.current).toBe(6);
  });
});
