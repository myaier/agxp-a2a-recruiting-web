// useCasePDF预览 —— Backend 详情的授权原始 PDF 控制 hook（契约 C，Task 7 自
// 屏幕/P5/MatchCase详情 的 详情主体 原样搬入，租约/在飞/代际生命周期逐项对照旧实现）。
// 只 Backend 使用此 hook；Mock 详情的仿真文件预览控制留在原屏（真实 PDF 字节与 Mock
// 仿真纸身是两种内容能力，不混同一数据通道）。
//
// 租约生命周期（spec §5 must-protect）：Plan 1 的对象 URL 租约只活在弹层生命周期 ——
// 关闭/换 Case/换角色/卸载即 revoke，绝不缓存不持久化，也不写任何全局租约表（hook 内部
// 只有 ref/state）。在飞单发防连点双租约。局部读代际保证迟到的成功租约立即回收、不开旧
// Case 的弹层；迟到的失败也不在新 Case 上弹提示。读取只走 (role, caseId) 的 Case 专属
// role 路径，输入由调用方注入（读取 = 应用操作['读取简历PDF']）；本 hook 不读 blob
// 文本/字节，弹层正文由展示层以租约地址经 URL 呈现。
//
// 生命周期（plan 固定）：本 hook 只在正常详情子组件无条件调用（Task 7 暂在原
// 详情主体，Task 9 迁 后端正常详情），不从始终挂载的读取 hook 条件调用。子组件卸载
// （含 Tab 切走时随进度槽卸载）即同步回收持有的租约并把代际 +1 —— 在飞读取落回时只
// 回收自己那张，绝无无人回收的在飞租约。

import { useEffect, useRef, useState } from 'react';
import { 轻提示 } from '../../组件/轻提示';
import { 取后端错误文案 } from '../../数据/HTTP客户端';
import type { PDF对象租约 } from '../../数据/PDF对象租约';
import type { P5角色 } from '../../数据/MatchCase展示映射';
import type { 应用操作 } from '../../状态/后端/类型';

/** 契约 C 的输入：读取 注入 Case 专属 role 路径（操作面同形），hook 不自持操作表。 */
export interface CasePDF预览输入 {
  role: P5角色;
  caseId: string;
  读取: 应用操作['读取简历PDF'];
}

export interface CasePDF预览结果 {
  预览: { 文件名: string; 地址: string } | null;
  打开: (文件名: string) => Promise<void>;
  关闭: () => void;
}

export function useCasePDF预览({ role, caseId, 读取 }: CasePDF预览输入): CasePDF预览结果 {
  const [预览, 设预览] = useState<{ 文件名: string; 地址: string } | null>(null);
  const 租约引用 = useRef<PDF对象租约 | null>(null);
  const 在飞 = useRef(false);
  /** 回收当前持有的租约：幂等（回收后引用即空；租约自身也只回收一次），只处理自己持有的那张。 */
  const 回收租约 = () => {
    租约引用.current?.revoke();
    租约引用.current = null;
  };
  // 本次读取的局部代际：换 Case / 换角色 / 卸载都让它 +1（不建全局租约系统）。
  // 迟到的成功租约立刻 revoke 且不 setState —— 绝不在新 Case 上打开旧 Case 的弹层；
  // 迟到的失败也不在新 Case 上弹提示。
  const 读代际 = useRef(0);
  useEffect(() => () => {
    读代际.current += 1;
    回收租约();
    设预览(null);
    // 换代即释放在飞标志：新 Case 的第一次点击不该被上一 Case 的在飞锁挡住
    在飞.current = false;
  }, [role, caseId]);

  const 打开 = async (文件名: string) => {
    if (在飞.current || 预览 !== null || caseId === '') return;
    在飞.current = true;
    const 本次代际 = 读代际.current;
    try {
      // 只走 Case 专属 role 路径；操作层已建租约并在会话边界登记回收
      const 租约 = await 读取(role, caseId);
      if (读代际.current !== 本次代际) {
        // 迟到成功：本次租约立即回收（幂等 revoke），不开弹层、不写 state
        租约.revoke();
        return;
      }
      回收租约(); // 防御：上一张（理论上不存在）先回收再挂新的
      租约引用.current = 租约;
      设预览({ 文件名, 地址: 租约.url });
    } catch (错误) {
      if (读代际.current !== 本次代际) return;
      轻提示(取后端错误文案(错误));
    } finally {
      // 只有当前那次读取的 finally 能释放自己的在飞标志，不给新请求解锁
      if (读代际.current === 本次代际) 在飞.current = false;
    }
  };

  const 关闭 = () => {
    回收租约();
    设预览(null);
  };

  return { 预览, 打开, 关闭 };
}
