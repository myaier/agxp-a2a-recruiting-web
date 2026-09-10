// use后端详情控制 —— Backend 详情路由的读取控制 hook（契约 C，Task 9 自
// 屏幕/P5/MatchCase详情 的路由实例原样搬入：scope 登记/退出、直达强制读、3 秒可见
// 节拍、Case 叮嘱、展示映射与稳定回答在飞表；命令参数与生命周期逐项对照旧实现）。
//
// 生命周期（plan 固定）：本 hook 由主体会话范围的 route 实例（MatchCase详情）始终挂载，
// 不调用 use后端详情动作 或 useCasePDF预览（那两个归正常控制子组件 后端正常详情 按
// role/case key 重挂载时无条件调用）。回答在飞表只在本 hook 创建、经 动作输入 传入 ——
// 同会话跨 Case 或正常→错误→正常不重建，锁不随动作区卸载而丢；主体/会话换代由整个父
// 实例重置回收。全部 hooks 无条件调用，绝不条件挂 hook。
//
// 返回明确联合（不把错误变成正常缺失）：
//   · {kind:'不可用'; 状态:'加载'|'失败'|'契约错误'; 说明; 重试} —— 路由只按 kind 渲染
//     错误/加载页，不进共用外壳、不调顶栏 mapper；
//   · 后端正常资源 —— 顶栏/状态/分段/资料/底栏/终局的纯展示 props + 动作/PDF 输入 +
//     刷新错误与重试，只供 后端正常详情 消费，不放展示目录。
//
// 模式边界（spec §10.3 与 P5 冻结契约）：读取详情 恒 force=true（非 force 在成功快照上
// 短路会吞掉 3 秒节拍与直达刷新）；详情只凭 URL case_id + 已认证角色，不读列表快照。
// 叮嘱等服务器回话，绝不造乐观气泡，仅成功后清空输入；终局（ended/completed）底栏
// 只读「当前在谈已结束，仅可查看」，停 3 秒节拍；completed+pending 继续权威重读
// （不加前端超时终态）。会话/角色栅栏：已登录且 last_used_role 匹配才开节拍。

import { useEffect, useRef, useState, type RefObject } from 'react';
import { 轻提示 } from '../../组件/轻提示';
import {
  从P5到详情分段,
  从P5到详情顶栏,
  从P5到详情状态,
  从P5到职位资料,
} from '../../数据/详情展示映射';
import { 映射P5详情, P5契约错误提示 } from '../../数据/MatchCase展示映射';
import type { P5角色 } from '../../数据/MatchCase展示映射';
import type { 分段项 } from '../../组件/阶段对话流';
import type {
  详情底栏信息,
  终局区信息,
  顶栏信息,
  状态区信息,
  职位资料信息,
} from '../../组件/在谈详情/类型';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import { useMatchCase轮询 } from '../../状态/后端/useMatchCase轮询';
import { use应用状态 } from '../../状态/应用状态';
import { use导航 } from '../../路由/导航钩子';
import { 路径 } from '../../路由/路径表';
import { use后端详情动作 } from './use后端详情动作';
import { useCasePDF预览 } from './useCasePDF预览';

const 叮嘱占位 = '有想法就告诉你的AI代理';
const 读入中文案 = '正在读入这一单…';
const 叮嘱失败提示 = '叮嘱没有发出去，请重试';
/** spec §5 must-protect：终局保留底部区域，只读说明的约定文案（双端同款）。 */
export const 终局只读说明 = '当前在谈已结束，仅可查看';
/** completed+pending 的「开始私聊」在场但恒禁用（准备中），禁用说明就地解释。 */
const 移交准备中说明 = '准备中';

/** 契约 C：正常联合的资源形状（控制模块内部类型，只供 后端正常详情 消费）。 */
export interface 后端正常资源 {
  kind: '正常';
  顶栏: 顶栏信息;
  状态: 状态区信息;
  分段们: 分段项[];
  职位资料: 职位资料信息;
  底栏: 详情底栏信息;
  终局: 终局区信息;
  刷新错误: string | null;
  重试: () => void;
  当前段引用: RefObject<HTMLDivElement | null>;
  动作输入: Parameters<typeof use后端详情动作>[0];
  PDF输入: Parameters<typeof useCasePDF预览>[0];
}

/** 不可用联合：错误路径（契约错误/首载失败/读入中）只给说明与重试，无正常字段。 */
export interface 后端详情不可用 {
  kind: '不可用';
  状态: '加载' | '失败' | '契约错误';
  说明: string;
  重试: (() => void) | null;
}

export type 后端详情控制结果 = 后端正常资源 | 后端详情不可用;

export function use后端详情控制({ role, caseId }: { role: P5角色; caseId: string }): 后端详情控制结果 {
  const { 数据源模式, 后端状态, 操作 } = use应用状态();
  const { 跳转 } = use导航();
  const 是后端 = 数据源模式 === 'backend';

  const scope键 = P5范围键.detail(role, caseId);
  const 快照 = 后端状态.P5详情?.[scope键];

  // 进屏 / 换 case：先注册可见范围再强制权威读（操作层栅栏靠注册的可见范围对上）；
  // 离开本屏或换 case 清回 null。Mock 模式本 hook 不挂载，操作层也恒早退。
  useEffect(() => {
    if (!是后端 || caseId === '') return;
    操作.设置P5范围(role, scope键);
    void 操作.读取详情(role, caseId, true).catch(() => undefined);
    return () => 操作.设置P5范围(role, null);
  }, [是后端, role, caseId, scope键, 操作]);

  // Case 叮嘱：等服务器回话再清输入（仅成功清空），绝不造乐观气泡 —— 展示永远以
  // 下一次权威 detail 重读为准（操作层在成功后已重读并刷新已载 scope）。在飞锁
  // （发送中 ref）归本控制层，不靠 disabled DOM。
  const [叮嘱草稿, 设叮嘱草稿] = useState('');
  const 发送中 = useRef(false);
  // 叮嘱代际（review-r1 F4，spec §3.1「切换 Case 或角色后重置」+ §5 迟到结果丢弃）：
  // 本 hook 常驻路由实例，scope（角色/单/主体）换代或卸载都递增；换代即清草稿并放
  // 在飞锁（锁归新 scope 干净起步），旧单迟到的清空/收口对不上代际整包作废。
  const 叮嘱代际 = useRef(0);
  const 主体ID = 后端状态.主体?.subject_id ?? null;
  useEffect(() => () => {
    叮嘱代际.current += 1;
  }, []);
  useEffect(() => {
    叮嘱代际.current += 1;
    发送中.current = false;
    设叮嘱草稿('');
  }, [role, caseId, 主体ID]);
  const 发叮嘱 = () => {
    const 内容 = 叮嘱草稿.trim();
    if (内容 === '' || caseId === '' || 发送中.current) return;
    const 本轮 = 叮嘱代际.current;
    发送中.current = true;
    操作.新增叮嘱(role, caseId, 内容)
      .then(() => {
        if (叮嘱代际.current === 本轮) 设叮嘱草稿('');
      })
      .catch(() => {
        if (叮嘱代际.current === 本轮) 轻提示(叮嘱失败提示);
      })
      .finally(() => {
        if (叮嘱代际.current === 本轮) 发送中.current = false;
      });
  };

  // 回答在飞锁表（review-r2）：归本 hook 所有 —— 正常控制子组件按 role/case 重挂载、
  // 动作区随「当前单无动作」整体卸载都不丢锁，回原单时续锁观察者靠表里的承诺链收口。
  const 回答在飞表 = useRef<Map<string, Promise<void>>>(new Map());
  // 主体换代整表替换（review-r2 F-r2-1，plan 生命周期「主体/会话换代时整个父实例重置」）：
  // RefObject 与契约 C 类型不变，但 .current 换成全新 Map —— 新主体不继承旧账号的在飞锁，
  // 旧单迟到的 delete 作用于 发回答 闭包捕获的旧表（use后端详情动作），删不到新表；
  // 换单/同主体重渲不换表（回原单续锁语义保持）。必须在渲染期完成替换：effects 自子向父
  // 触发，新主体子 hook 的换单续锁效果先于本 hook 的 passive effect 读表 —— effect 里换表
  // 会让新主体误继承旧账号的在飞锁（屏级测试钉住）。
  const 上轮主体ID = useRef<string | null>(主体ID);
  if (上轮主体ID.current !== 主体ID) {
    上轮主体ID.current = 主体ID;
    回答在飞表.current = new Map();
  }

  // 当前阶段段的定位引用（子组件渲染 阶段对话流 时挂到「当前」段并自动滚过去）
  const 当前段引用 = useRef<HTMLDivElement>(null);

  const 重读 = () => void 操作.读取详情(role, caseId, true).catch(() => undefined);

  // 视图与终局判定（非 hook，先算给节拍栅栏用）：
  // 正常视图只能来自快照里已 decode 的详情（detail 为空不映射）。
  const 原文 = 快照?.detail ?? null;
  const 视图 = 原文 !== null ? 映射P5详情(原文) : null;
  const 正常 = 视图 !== null && 视图.kind === '正常' ? 视图 : null;
  // 详情轮询停止口径 = ended 或已发布会话；pending（含 same-party 长期 pending）保持
  // 3 秒权威重读，绝不加前端超时终态。
  const 详情终局 = 正常 !== null && 正常.详情终局;

  // 可见 3 秒详情节拍（spec §10.3）：Backend + 会话/角色有效 + 详情在场 + 非终局；
  // 终局即停。每拍都走 读取详情(force=true) 的权威重读（成功快照不得短路节拍）。
  const 会话有效 = 后端状态.已登录 === true && 后端状态.主体?.last_used_role === role;
  useMatchCase轮询({
    开启: 是后端 && caseId !== '' && 会话有效 && !详情终局,
    列表: null,
    详情: { role, caseId },
    详情终局,
    刷新列表: async () => undefined,
    刷新详情: (范围) => 操作.读取详情(范围.role, 范围.caseId, true),
  });

  // ── 所有 hook 之后才收窄联合：错误路径（契约错误 / 首载失败 / 读入中）只给说明与
  //    重试，不进正常资源，更不给虚假详情。──
  if (视图 !== null && 视图.kind === '契约错误') {
    return { kind: '不可用', 状态: '契约错误', 说明: P5契约错误提示, 重试: 重读 };
  }
  if (正常 === null || 原文 === null) {
    if (快照 !== undefined && 快照.阶段 === '失败' && 快照.detail === null) {
      return {
        kind: '不可用', 状态: '失败',
        说明: 快照.error ?? '这一单暂时打不开', 重试: 重读,
      };
    }
    return { kind: '不可用', 状态: '加载', 说明: 读入中文案, 重试: null };
  }

  // 终局摘要与移交（completed 两步）：wire 原词原样，导航坐标只来自权威
  // conversation_ref —— 不生成、不缓存、不推断。
  const 移交 = 正常.handoff;
  const 终局: 终局区信息 = {
    摘要: 正常.终局摘要 !== null ? { ...正常.终局摘要 } : null,
    移交: 移交 === null ? null : {
      说明: 移交.copy,
      开始私聊: 移交.state === 'ready'
        ? {
            键: '开始私聊', 文案: '开始私聊', 外观: '主要', 禁用说明: null,
            执行: () => 跳转(role === 'candidate'
              ? 路径.真人会话路径(移交.conversationId)
              : 路径.企业真人会话路径(移交.conversationId)),
          }
        : { 键: '开始私聊', 文案: '开始私聊', 外观: '主要', 禁用说明: 移交准备中说明, 执行: null },
    },
  };

  // 底部 Case 叮嘱：终局只读（spec §5），进行中可输入（非终局的禁用由已有刷新/动作
  // 保护表达，不在底栏加锁）。
  const 底栏: 详情底栏信息 = 正常.终局
    ? { kind: '只读', 说明: 终局只读说明 }
    : { kind: '输入', 占位: 叮嘱占位, 值: 叮嘱草稿, 改变: 设叮嘱草稿, 发送: 发叮嘱, 禁用说明: null };

  return {
    kind: '正常',
    顶栏: 从P5到详情顶栏(正常),
    状态: 从P5到详情状态(正常),
    分段们: 从P5到详情分段(正常, 原文.state.stage),
    职位资料: 从P5到职位资料(正常),
    底栏,
    终局,
    // 刷新/轮询失败：旧详情原样保留只读，错误单独一行交代 + 重试（§10.3）
    刷新错误: 快照?.error && !快照.刷新中 ? 快照.error : null,
    重试: 重读,
    当前段引用,
    动作输入: { role, caseId, 视图: 正常, 详情: 原文, 操作, 回答在飞表 },
    PDF输入: { role, caseId, 读取: 操作.读取简历PDF },
  };
}
