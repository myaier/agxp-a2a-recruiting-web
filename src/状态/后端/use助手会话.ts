// use助手会话：求职端「问 AI 代理」聊天的页面局部轮次状态机（Task 4 / 合同 C + Spec §3）。
// 只持单页局部状态：一个活动轮询 timer、一个在飞写操作（ref 同步锁，快速双击只一个
// POST）、一个待确认请求 {kind, text 或 turnId, key}；不引入 reducer 框架、轮次队列、
// 全局快照或持久化发件箱。消息以 message_id 去重，旧到新排列；旧页（加载更早）只能补充
// 更早的消息，不能覆盖已由 retry/轮询更新的 turn_id。身份/范围栅栏分两层：seam（助手会话
// 访问.ts）先挡身份过时（AbortError）并统一 401 清账号；本钩子对 范围键/卸载 再加本地
// 请求代际，AbortError 与 401 都不展示为业务失败。幂等键用 crypto.randomUUID（业务轮次
// 重试才生成新 key；提交不明/重试提交一律同 key 重放）。

import { useEffect, useRef, useState } from 'react';
import { BFF错误, 取后端错误文案 } from '../../数据/HTTP客户端';
import type { AssistantMessage, AssistantMessagePage } from '../../数据/招聘数据源/助手会话';
import type { 助手会话访问 } from './助手会话访问';

/** 提交结果不明时保存的原请求：重试提交原样重放；确认权威轮次前不允许发起不同内容。 */
type 待确认请求 =
  | {
    kind: '发送';
    text: string;
    key: string;
    /** 进待确认时已知的全部 message_id：已受理的服务端必产生新 id；未受理时首页最新仍是基线内旧消息。 */
    已知编号基线: ReadonlySet<string>;
  }
  | { kind: '重试'; turnId: string; key: string };

/** Spec §3：202 后每 2 秒定向轮询，无 SSE、无逐字模拟输出。 */
const 轮询间隔毫秒 = 2_000;
const 首读失败文案 = '消息读取失败，请重试';
const 轮询失败文案 = '助手回复状态读取失败，请重读恢复';
const 代理不可用文案 = 'AI 代理当前不可用，请稍后再试';
const 重试确认失败文案 = '重试状态确认失败，请重读消息';
const 待确认仍不明文案 = '提交结果暂时无法确认，可稍后重试';
const 加载更早失败文案 = '更早消息读取失败，请重试';

const 是中止 = (错误: unknown): boolean =>
  错误 instanceof DOMException && 错误.name === 'AbortError';

const 是401 = (错误: unknown): boolean =>
  错误 instanceof BFF错误 && 错误.status === 401;

/** 会话/范围层面中断：401 归 seam/Provider 的统一清账号处理，AbortError 表示旧范围已丢弃。 */
const 是会话中断 = (错误: unknown): boolean => 是中止(错误) || 是401(错误);

/**
 * 提交结果是否不明（Spec §3）：网络错误、超时、5xx（含 503）或已接受但解码失败
 * （200 invalid_response）——同 key 重放；其余 4xx（含本地入参预检的 0/invalid_request）
 * 是明确拒绝，不进待确认。
 */
const 是不明结果 = (错误: unknown): boolean => {
  if (!(错误 instanceof BFF错误)) return true;
  return 错误.status === 0
    ? 错误.code === 'network_error'
    : 错误.status >= 500 || 错误.status === 200;
};

export function use助手会话(访问: 助手会话访问 | null) {
  const 范围键 = 访问?.范围键 ?? null;
  const [消息, 设消息状态] = useState<AssistantMessage[]>([]);
  const [草稿, 设草稿状态] = useState('');
  const [首读阶段, 设首读阶段] = useState<'进行中' | '失败' | '完成'>('进行中');
  const [加载更早中状态, 设加载更早中状态] = useState(false);
  const [有更早, 设有更早] = useState(false);
  const [错误, 设错误] = useState<string | null>(null);
  const [待确认中, 设待确认] = useState(false);
  const [轮询中, 设轮询中] = useState(false);
  const [写在飞, 设写在飞] = useState(false);

  // ── 同步镜像 ref：异步续体与同步锁一律读 ref，不等 React 下一帧 ──
  const 访问引用 = useRef(访问);
  访问引用.current = 访问;
  const 消息引用 = useRef(消息);
  const 草稿引用 = useRef(草稿);
  const 首读完成引用 = useRef(false);
  const 加载更早中引用 = useRef(false);
  const 待确认请求引用 = useRef<待确认请求 | null>(null);
  /** 本地请求代际：范围键变化 / 卸载 时递增，旧范围的迟到结果整包丢弃。 */
  const 本地代际 = useRef(0);
  /** 当前跟踪的活动轮次（服务端仍在 processing 的那一轮）；null = 无轮次在处理。 */
  const 活动轮次 = useRef<string | null>(null);
  const 计时 = useRef<number | null>(null);
  /** 写入同步锁：同一时刻最多一个在飞写操作（发送 / 重试轮次 / 重试提交）。 */
  const 写锁 = useRef(false);
  const 读在飞 = useRef(false);
  const 下一游标 = useRef<string | null>(null);

  const 写消息 = (下一: AssistantMessage[]) => {
    消息引用.current = 下一;
    设消息状态(下一);
  };

  const 设草稿 = (值: string) => {
    草稿引用.current = 值;
    设草稿状态(值);
  };

  const 清计时 = () => {
    if (计时.current !== null) {
      window.clearTimeout(计时.current);
      计时.current = null;
    }
  };

  const 设活动轮次 = (turnId: string | null) => {
    活动轮次.current = turnId;
    设轮询中(turnId !== null);
  };

  /** 权威-now 消息（轮询 / 发送受理 / 重试受理 / retry_not_allowed 权威重读）：按 message_id 原位更新。 */
  const 合并权威消息 = (最新: AssistantMessage) => {
    const 已知 = 消息引用.current;
    const 位置 = 已知.findIndex((条) => 条.message_id === 最新.message_id);
    if (位置 === -1) {
      // 新消息只可能晚于已知历史（历史页新到旧、发送/重试发生在已读历史之后）：追加到尾部
      写消息([...已知, 最新]);
    } else {
      写消息(已知.map((条, 序) => (序 === 位置 ? 最新 : 条)));
    }
  };

  // ── 定向轮询：单一 timer 链，processing 期间每 2 秒一发，终态停 ──
  const 排一拍 = (turnId: string, 代际: number) => {
    清计时();
    计时.current = window.setTimeout(() => {
      void 拍(turnId, 代际);
    }, 轮询间隔毫秒);
  };

  const 拍 = async (turnId: string, 代际: number) => {
    if (本地代际.current !== 代际 || 活动轮次.current !== turnId) return;
    // fix 2：与其余入口同款判空 —— 轮询 timer 在「渲染提交 → passive effect 清理」的
    // 间隙到期时，访问 已翻 null 而本地代际尚未递增，`!` 解引用会在 setTimeout 回调里抛 TypeError
    const 当前访问 = 访问引用.current;
    if (当前访问 === null) return;
    try {
      const 最新 = await 当前访问.api.读取助手轮次(turnId);
      if (本地代际.current !== 代际 || 活动轮次.current !== turnId) return; // 乱序/换代：丢弃
      合并权威消息(最新);
      if (最新.status === 'processing') {
        排一拍(turnId, 代际);
      } else {
        设活动轮次(null);
        清计时();
      }
    } catch (错误) {
      if (本地代际.current !== 代际 || 活动轮次.current !== turnId) return;
      if (是会话中断(错误)) return; // 范围已变：hook 随 范围键 重置，401 归全局清理
      // 读取失败：暂停轮询（不再排拍）、显示可重试错误；活动轮次保留 —— 不擅自释放
      // processing 输入锁（服务端视角该轮可能仍在处理），通过 重读 恢复
      清计时();
      设错误(轮询失败文案);
    }
  };

  const 开始轮询 = (turnId: string) => {
    设活动轮次(turnId);
    排一拍(turnId, 本地代际.current);
  };

  /** 首页（最新一页，新到旧）落地：重读/首读共用。按 message_id 合并，恢复或停止轮询。 */
  const 应用首页 = (页: AssistantMessagePage) => {
    const 页内旧到新 = 页.items.slice().reverse();
    const 页内ID = new Set(页内旧到新.map((条) => 条.message_id));
    // 已加载的更早窗口与首页的重叠只可能来自分页漂移：已知消息保留现值（旧页不能覆盖
    // 已经由 retry/轮询更新的 turn_id），页内版本才是当前权威快照
    const 更早部分 = 消息引用.current.filter((条) => !页内ID.has(条.message_id));
    const 合并列表 = [...更早部分, ...页内旧到新];
    写消息(合并列表);
    下一游标.current = 页.next_cursor;
    设有更早(页.next_cursor !== null);
    const 最新消息 = 合并列表.length === 0 ? null : 合并列表[合并列表.length - 1];
    if (最新消息 !== null && 最新消息.status === 'processing') {
      开始轮询(最新消息.turn_id);
    } else {
      设活动轮次(null);
      清计时();
    }
  };

  /**
   * 待确认结算（重读路径）：服务端不回传幂等键，按可对账的最近事实识别 ——
   * · 发送：首页最新一条与待确认原文相同、且 message_id 不在进待确认时的已知基线内，
   *   才视为本次操作已受理（fix 1：同文旧消息 —— 用户反复问「下一批」—— 不得误判，
   *   否则会静默丢弃未落地的消息并清掉草稿）；
   * · 重试：从本地消息里找到原 turn 对应的 message_id，首页中该消息已换新 turn 即已受理。
   * 对不上就保持待确认，由 重试提交 同 key 重放取得权威轮次。
   */
  const 结算待确认 = (页: AssistantMessagePage) => {
    const 请求 = 待确认请求引用.current;
    if (请求 === null) return;
    if (请求.kind === '发送') {
      const 最新 = 页.items.length === 0 ? null : 页.items[0];
      if (
        最新 !== null &&
        最新.text === 请求.text &&
        !请求.已知编号基线.has(最新.message_id)
      ) {
        待确认请求引用.current = null;
        设待确认(false);
        设草稿(''); // 权威轮次已出现：受理事实成立，清草稿
      }
      return;
    }
    const 原消息 = 消息引用.current.find((条) => 条.turn_id === 请求.turnId);
    if (原消息 === undefined) return;
    const 页内 = 页.items.find((条) => 条.message_id === 原消息.message_id);
    if (页内 !== undefined && 页内.turn_id !== 请求.turnId) {
      待确认请求引用.current = null;
      设待确认(false);
    }
  };

  /** 首读 / 重读 / 409 恢复共用的首页读取：单飞；只读历史，绝不生成新 key。 */
  const 重读内部 = async (): Promise<void> => {
    if (访问引用.current === null || 读在飞.current) return;
    const 代际 = 本地代际.current;
    const api = 访问引用.current.api;
    读在飞.current = true;
    try {
      const 页 = await api.读取助手历史();
      if (本地代际.current !== 代际) return;
      结算待确认(页);
      应用首页(页);
      首读完成引用.current = true;
      设首读阶段('完成');
      设错误(null);
    } catch (错误) {
      if (本地代际.current !== 代际) return;
      if (是会话中断(错误)) return;
      // 首读失败不当作空历史：显示错误并锁输入；重读失败保留已展示历史
      设错误(首读失败文案);
      if (!首读完成引用.current) 设首读阶段('失败');
    } finally {
      读在飞.current = false;
    }
  };

  const 发送 = async (text?: string): Promise<void> => {
    const 当前访问 = 访问引用.current;
    if (当前访问 === null) return;
    if (写锁.current || !首读完成引用.current) return;
    if (活动轮次.current !== null || 待确认请求引用.current !== null) return;
    const 正文 = (text ?? 草稿引用.current).trim();
    const key = globalThis.crypto.randomUUID();
    const 代际 = 本地代际.current;
    写锁.current = true;
    设写在飞(true);
    try {
      const 受理 = await 当前访问.api.发送助手消息(正文, key);
      if (本地代际.current !== 代际) return;
      设草稿(''); // 确认受理才清草稿
      合并权威消息(受理);
      设错误(null);
      if (受理.status === 'processing') 开始轮询(受理.turn_id);
    } catch (错误) {
      if (本地代际.current !== 代际) return;
      if (是会话中断(错误)) return;
      if (错误 instanceof BFF错误 && 错误.status === 409 && 错误.code === 'assistant_turn_in_progress') {
        // 未受理：草稿保留、不加用户气泡；重读历史找到活动轮次并恢复轮询
        await 重读内部();
        return;
      }
      if (错误 instanceof BFF错误 && 错误.status === 409 && 错误.code === 'assistant_unavailable') {
        设错误(代理不可用文案);
        return;
      }
      if (是不明结果(错误)) {
        待确认请求引用.current = {
          kind: '发送',
          text: 正文,
          key,
          // 同文反例防线（fix 1）：记下当时已知 message_id 基线 —— 重读结算时最新一条
          // 必须是基线外的新 id 才算本次操作落地；「下一批」式同文旧消息不得误判为权威轮次
          已知编号基线: new Set(消息引用.current.map((条) => 条.message_id)),
        };
        设待确认(true);
        return;
      }
      设错误(取后端错误文案(错误)); // 明确拒绝：显示文案，保留草稿
    } finally {
      写锁.current = false;
      设写在飞(false);
    }
  };

  const 重试轮次 = async (messageId: string): Promise<void> => {
    const 当前访问 = 访问引用.current;
    if (当前访问 === null) return;
    if (写锁.current || !首读完成引用.current) return;
    if (活动轮次.current !== null || 待确认请求引用.current !== null) return;
    const 原 = 消息引用.current.find((条) => 条.message_id === messageId);
    if (原 === undefined || 原.status !== 'failed' || !原.retryable) return; // 只有 failed && retryable
    const key = globalThis.crypto.randomUUID(); // 业务轮次重试才生成新 key
    const 代际 = 本地代际.current;
    写锁.current = true;
    设写在飞(true);
    try {
      const 新 = await 当前访问.api.重试助手轮次(原.turn_id, key);
      if (本地代际.current !== 代际) return;
      合并权威消息(新); // 同 message_id 原位替换、turn_id 更新，不重复用户气泡
      设错误(null);
      if (新.status === 'processing') 开始轮询(新.turn_id);
    } catch (错误) {
      if (本地代际.current !== 代际) return;
      if (是会话中断(错误)) return;
      if (错误 instanceof BFF错误 && 错误.status === 409 && 错误.code === 'assistant_retry_not_allowed') {
        // 重读该轮：以服务端权威状态原位更新，不生成新 key
        try {
          const 权威 = await 当前访问.api.读取助手轮次(原.turn_id);
          if (本地代际.current !== 代际) return;
          合并权威消息(权威);
          设错误(null);
          if (权威.status === 'processing') 开始轮询(权威.turn_id);
        } catch (二错) {
          if (本地代际.current !== 代际 || 是会话中断(二错)) return;
          设错误(重试确认失败文案);
        }
        return;
      }
      if (错误 instanceof BFF错误 && 错误.status === 409 && 错误.code === 'assistant_unavailable') {
        设错误(代理不可用文案);
        return;
      }
      if (是不明结果(错误)) {
        待确认请求引用.current = { kind: '重试', turnId: 原.turn_id, key };
        设待确认(true);
        return;
      }
      设错误(取后端错误文案(错误));
    } finally {
      写锁.current = false;
      设写在飞(false);
    }
  };

  const 重试提交 = async (): Promise<void> => {
    const 当前访问 = 访问引用.current;
    if (当前访问 === null) return;
    const 请求 = 待确认请求引用.current;
    if (请求 === null || 写锁.current) return;
    const 代际 = 本地代际.current;
    写锁.current = true;
    设写在飞(true);
    try {
      const 结果 = 请求.kind === '发送'
        ? await 当前访问.api.发送助手消息(请求.text, 请求.key)
        : await 当前访问.api.重试助手轮次(请求.turnId, 请求.key);
      if (本地代际.current !== 代际) return;
      待确认请求引用.current = null; // 该操作返回权威轮次：解除待确认
      设待确认(false);
      合并权威消息(结果);
      if (请求.kind === '发送') 设草稿('');
      设错误(null);
      if (结果.status === 'processing') 开始轮询(结果.turn_id);
    } catch (错误) {
      if (本地代际.current !== 代际) return;
      if (是会话中断(错误)) return;
      if (错误 instanceof BFF错误 && 错误.status === 409 && 错误.code === 'assistant_turn_in_progress') {
        // 同 key 重放被拒说明原提交未被受理、已有别的轮次在处理：解除待确认，重读跟踪活动轮次
        待确认请求引用.current = null;
        设待确认(false);
        await 重读内部();
        return;
      }
      if (错误 instanceof BFF错误 && 错误.status === 409 && 错误.code === 'assistant_unavailable') {
        待确认请求引用.current = null;
        设待确认(false);
        设错误(代理不可用文案);
        return;
      }
      if (
        错误 instanceof BFF错误 && 错误.status === 409 && 错误.code === 'assistant_retry_not_allowed' &&
        请求.kind === '重试'
      ) {
        // 原重试未被受理且该轮已不可重试：解除待确认并重读该轮
        待确认请求引用.current = null;
        设待确认(false);
        try {
          const 权威 = await 当前访问.api.读取助手轮次(请求.turnId);
          if (本地代际.current !== 代际) return;
          合并权威消息(权威);
        } catch {
          // 权威重读失败：页面可通过 重读 再试
        }
        return;
      }
      if (是不明结果(错误)) {
        设错误(待确认仍不明文案); // 仍无法确认：保持同一 key 待确认，可稍后再试
        return;
      }
      // 其他明确拒绝：操作确定未被受理 —— 解除待确认、保留草稿、显示文案
      待确认请求引用.current = null;
      设待确认(false);
      设错误(取后端错误文案(错误));
    } finally {
      写锁.current = false;
      设写在飞(false);
    }
  };

  const 加载更早 = async (): Promise<void> => {
    const 当前访问 = 访问引用.current;
    if (当前访问 === null) return;
    if (!首读完成引用.current || 加载更早中引用.current || 下一游标.current === null) return;
    const 代际 = 本地代际.current;
    加载更早中引用.current = true;
    设加载更早中状态(true);
    try {
      const 页 = await 当前访问.api.读取助手历史(下一游标.current);
      if (本地代际.current !== 代际) return;
      const 已知 = new Set(消息引用.current.map((条) => 条.message_id));
      // 旧页只能补充更早的消息：已知 message_id 一律保留现值（旧页不能覆盖已更新的 turn_id）
      const 新增 = 页.items.slice().reverse().filter((条) => !已知.has(条.message_id));
      写消息([...新增, ...消息引用.current]);
      下一游标.current = 页.next_cursor;
      设有更早(页.next_cursor !== null);
    } catch (错误) {
      if (本地代际.current !== 代际) return;
      if (是会话中断(错误)) return;
      设错误(加载更早失败文案);
    } finally {
      加载更早中引用.current = false;
      设加载更早中状态(false);
    }
  };

  // ── 范围生命周期：范围键变化 / 无访问 / 卸载 ──
  const 复位局部 = () => {
    本地代际.current += 1; // 旧范围的在飞结果整包丢弃
    清计时();
    活动轮次.current = null;
    写锁.current = false;
    读在飞.current = false;
    加载更早中引用.current = false;
    待确认请求引用.current = null;
    首读完成引用.current = false;
    下一游标.current = null;
    消息引用.current = [];
    设消息状态([]);
    草稿引用.current = '';
    设草稿状态('');
    设首读阶段('进行中');
    设加载更早中状态(false);
    设有更早(false);
    设错误(null);
    设待确认(false);
    设轮询中(false);
    设写在飞(false);
  };

  useEffect(() => {
    if (范围键 === null) {
      复位局部(); // Mock / 未登录 / 非 candidate / 会话失效：输出全空底座，零请求
      return;
    }
    复位局部();
    void 重读内部(); // 首次进入先读历史（Spec §3）
    return () => {
      // 卸载或换范围：停表并作废在飞结果（迟到成功 / 401 一律丢弃）
      本地代际.current += 1;
      清计时();
      活动轮次.current = null;
    };
    // 内部函数只读 refs 与稳定 setter，每次渲染重建不进依赖；仅 范围键 变化才重置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [范围键]);

  const 首读中 = 访问 !== null && 首读阶段 === '进行中';
  const 输入禁用 = 访问 === null || 首读阶段 !== '完成' || 轮询中 || 待确认中 || 写在飞;

  return {
    消息, // 旧到新，message_id 唯一
    草稿,
    设草稿,
    首读中,
    加载更早中: 加载更早中状态,
    有更早,
    输入禁用,
    错误,
    提交待确认: 待确认中,
    发送,
    加载更早,
    重读: 重读内部,
    重试提交,
    重试轮次,
  };
}
