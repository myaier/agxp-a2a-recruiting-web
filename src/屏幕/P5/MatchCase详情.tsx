// P5 Task 5：双端四阶段详情（Backend 专用共享组件；Mock 屏不渲染本组件）。
//
// 模式边界（spec §10.3 与 P5 冻结契约）：
//   · 详情只凭 URL case_id + 已认证角色强制 GET（读取详情 恒 force=true —— 非 force 在
//     成功快照上短路，会静默吞掉 3 秒轮询与直达刷新），绝不读列表快照补 context：
//     直达 URL 刷新（列表状态为空）必须整页可渲染。
//   · 候选端只渲染 intentionId（上下文标识）+ Case 冻结的工作区职位四事实；招聘端只渲染
//     candidate_alias（不透明展示文本，逐字原样）+ 冻结职位。没有姓名/联系方式/结构化
//     身份/公司画像/匹配分 —— 那些是 P5.1 依赖，缺合同的段一律不渲染、不放占位。
//   · 展示权威是 state.lifecycle/stage/status/step + viewer needs_action + available_actions
//     （映射P5详情 的闭词投影）；时间线/小结文本只作展示，绝不参与状态或动作判定。
//     阶段对话流 只当类型化分段渲染器用：分段态来自阶段区 state（pending/active/passed/
//     ended），不是从文本推的。
//   · 未知契约（矩阵外四元组等）按展示映射 fail closed：只给契约错误提示 + 重试（重新
//     GET），隐藏全部 mutation 控件。终局（ended/completed）只读：停 3 秒详情节拍、隐藏
//     叮嘱输入。
//   · Case 叮嘱（底部输入，双端同款）：POST 等服务器回话，绝不造乐观气泡/本地规则；
//     仅在成功后清空输入，展示永远以下一次权威 detail 重读为准（Task 3 操作层在
//     mutation 成功后已重读并刷新已载 scope）。
//   · 可见 3 秒详情节拍交给 useMatchCase轮询（隐藏当拍跳过、卸载即停、同目标在飞不并发）；
//     开启 栅栏 = Backend + 会话/角色有效 + 详情在场 + 非终局；本组件不持任何节拍。
//   · 键与请求坐标唯一归属 case_id；candidate_alias 不进任何键/请求/缓存坐标。

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import 列表样式 from './MatchCase列表.module.css';
import 阶段对话流, { type 分段项 } from '../../组件/阶段对话流';
import { 次级页外壳, 返回栏, 滚动区, 真输入条 } from '../../组件/通用';
import { 轻提示 } from '../../组件/轻提示';
import { use应用状态 } from '../../状态/应用状态';
import { use导航 } from '../../路由/导航钩子';
import { 映射P5详情, P5契约错误提示 } from '../../数据/MatchCase展示映射';
import type { P5角色, P5阶段, P5详情正常视图, P5阶段区块视图 } from '../../数据/MatchCase展示映射';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import { useMatchCase轮询 } from '../../状态/后端/useMatchCase轮询';
import type { P5详情快照 } from '../../状态/后端/类型';
import type { 对话条, 阶段 } from '../../数据/类型';
import type { RefObject } from 'react';

/** P5阶段 → 既有四阶段中文名（与 阶段顺序 同一闭集；顺序仍以 mapper 交付为准）。 */
const 阶段名表: Record<P5阶段, 阶段> = {
  anonymous_screening: '匿名初筛',
  resume_submission: '递交简历',
  needs_coordination: '需要协调',
  intent_confirmation: '意向确认',
};

const 叮嘱占位 = '有想法就告诉你的AI代理';
const 读入中文案 = '正在读入这一单…';
const 失败标题 = '这一单暂时打不开';
const 叮嘱失败提示 = '叮嘱没有发出去，请重试';

/** RFC3339 → 「HH:mm」（UTC 定长截取，纯展示格式化，绝不参与状态判定）。 */
function 取短时间(iso: string): string {
  return iso.slice(11, 16);
}

/**
 * 阶段区 typed 段 → 展示气泡：时间线与叮嘱回执都只是展示文本（原样带出，按归属分列），
 * 绝不参与状态或动作判定；无文本的事件（纯 reason_code 的系统事件）无可展示，跳过。
 */
function 段内对话(区: P5阶段区块视图, role: P5角色): 对话条[] {
  const 条们: 对话条[] = [];
  let 序 = 0;
  const 推 = (内容: string | undefined, 我方: boolean, 时间: string) => {
    if (内容 === undefined || 内容.trim() === '') return;
    序 += 1;
    条们.push({ 编号: 序, 方: 我方 ? '我方' : '对方', 时间: 取短时间(时间), 内容 });
  };
  区.时间线.forEach((项) => 推(项.text, 项.role === role, 项.occurredAt));
  区.叮嘱.forEach((条) => 推(条.expression, 条.owner === role, 条.occurredAt));
  return 条们;
}

// 版式沿用列表卡的既有类与设计令牌，只补几条行内布局（不另建 CSS 文件）
const 状态行样式: CSSProperties = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '12px 16px 4px',
};
const 步骤说明样式: CSSProperties = { flex: 1, minWidth: 0, fontSize: 12, color: 'var(--弱化)' };
const 意向样式: CSSProperties = { flex: 'none', fontSize: 11, color: 'var(--最弱)' };
const 轮次样式: CSSProperties = { flex: 'none', fontSize: 11, color: 'var(--最弱)' };
const 终局卡样式: CSSProperties = {
  margin: '0 16px 10px', padding: '13px 15px', borderRadius: 14, background: 'var(--浅灰底)',
  display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, lineHeight: 1.6,
  color: 'var(--正文)',
};
const 终局题样式: CSSProperties = {
  fontSize: 10.5, fontWeight: 700, color: 'var(--次要浅)', letterSpacing: '0.04em',
};
const 终局弱样式: CSSProperties = { fontSize: 11, color: 'var(--最弱)' };
const 移交行样式: CSSProperties = {
  margin: '0 16px 10px', padding: '12px 14px', borderRadius: 14, background: 'var(--意向底)',
  color: 'var(--意向)', fontSize: 13, fontWeight: 700, lineHeight: 1.6,
};

export function MatchCase详情(props: { role: P5角色 }) {
  const { role } = props;
  const { id: caseId = '' } = useParams<{ id: string }>();
  const { 数据源模式, 后端状态, 操作 } = use应用状态();
  const { 返回 } = use导航();
  const 是后端 = 数据源模式 === 'backend';

  const scope键 = P5范围键.detail(role, caseId);
  const 快照: P5详情快照 | undefined = 后端状态.P5详情?.[scope键];

  // 进屏 / 换 case：先注册可见范围再强制权威读（操作层栅栏靠注册的可见范围对上）；
  // 离开本屏或换 case 清回 null。Mock 模式本组件不挂载，操作层也恒早退。
  useEffect(() => {
    if (!是后端 || caseId === '') return;
    操作.设置P5范围(role, scope键);
    void 操作.读取详情(role, caseId, true).catch(() => undefined);
    return () => 操作.设置P5范围(role, null);
  }, [是后端, role, caseId, scope键, 操作]);

  const 视图 = 快照?.detail != null ? 映射P5详情(快照.detail) : null;
  const 正常 = 视图 !== null && 视图.kind === '正常' ? 视图 : null;
  const 契约错误 = 视图 !== null && 视图.kind === '契约错误';
  const 终局 = 正常 !== null && 正常.终局;

  // 可见 3 秒详情节拍（spec §10.3）：Backend + 会话/角色有效 + 详情在场 + 非终局；
  // 终局即停。每拍都走 读取详情(force=true) 的权威重读（成功快照不得短路节拍）。
  const 会话有效 = 后端状态.已登录 === true && 后端状态.主体?.last_used_role === role;
  useMatchCase轮询({
    开启: 是后端 && caseId !== '' && 会话有效 && !终局,
    列表: null,
    详情: { role, caseId },
    详情终局: 终局,
    刷新列表: async () => undefined,
    刷新详情: (范围) => 操作.读取详情(范围.role, 范围.caseId, true),
  });

  // 进入页面自动定位到当前阶段段（与两端 Mock 详情屏同构），不用手动划过整条流
  const 当前节点引用 = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const 定时 = window.setTimeout(() => {
      当前节点引用.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 120);
    return () => window.clearTimeout(定时);
  }, []);

  // Case 叮嘱：等服务器回话再清输入（仅成功清空），绝不造乐观气泡 —— 展示永远以
  // 下一次权威 detail 重读为准（Task 3 操作层在成功后已重读并刷新已载 scope）。
  const [叮嘱草稿, 设叮嘱草稿] = useState('');
  const 发送中 = useRef(false);
  const 发叮嘱 = () => {
    const 内容 = 叮嘱草稿.trim();
    if (内容 === '' || caseId === '' || 发送中.current) return;
    发送中.current = true;
    操作.新增叮嘱(role, caseId, 内容)
      .then(() => {
        设叮嘱草稿('');
      })
      .catch(() => {
        轻提示(叮嘱失败提示);
      })
      .finally(() => {
        发送中.current = false;
      });
  };
  const 可输入 = 正常 !== null && !终局 && caseId !== '';

  const 重读 = () => void 操作.读取详情(role, caseId, true).catch(() => undefined);

  return (
    <次级页外壳 白底>
      <返回栏
        返回={返回}
        标题={
          正常 === null
            ? undefined
            : role === 'candidate'
              ? 正常.职位.职位名
              : (正常.candidateAlias ?? undefined)
        }
        副标题={
          正常 === null
            ? undefined
            : role === 'candidate'
              ? `${正常.职位.城市} · ${正常.职位.薪资带}`
              : `${正常.职位.职位名} · ${正常.职位.城市} · ${正常.职位.薪资带}`
        }
        右侧={
          正常 === null ? undefined : (
            <span
              className={`${列表样式.徽标} ${正常.待办 ? 列表样式.徽标待办 : 列表样式.徽标代理}`}
            >
              {正常.待办 ? '需要你' : '代理处理中'}
            </span>
          )
        }
      />

      <滚动区>
        {契约错误 ? (
          // fail closed：契约错误视图动作表恒空，只给提示与重试，部分数据一概不渲染
          <div className={列表样式.契约错误行}>
            <div>{P5契约错误提示}</div>
            <button className={`${列表样式.重试键} 可点`} onClick={重读}>
              重试
            </button>
          </div>
        ) : 正常 === null ? (
          快照 !== undefined && 快照.阶段 === '失败' && 快照.detail === null ? (
            <div className={列表样式.空态}>
              <div className={列表样式.空态标题}>{失败标题}</div>
              <div className={列表样式.空态说明}>{快照.error}</div>
              <button className={`${列表样式.重试键} 可点`} onClick={重读}>
                重试
              </button>
            </div>
          ) : (
            <div className={列表样式.空态}>{读入中文案}</div>
          )
        ) : (
          <详情主体 视图={正常} role={role} 快照={快照} 当前节点引用={当前节点引用} 重读={重读} />
        )}
      </滚动区>

      {/* 底部 Case 叮嘱（双端同款）：终局/契约错误/未知详情一律不出现 */}
      {可输入 ? (
        <真输入条 占位={叮嘱占位} 值={叮嘱草稿} 改变={设叮嘱草稿} 发送={发叮嘱} />
      ) : null}
    </次级页外壳>
  );
}

// ── 正常详情主体：状态行 + 终局/移交 + 四阶段对话流 ─────────────────────────────

function 详情主体({
  视图,
  role,
  快照,
  当前节点引用,
  重读,
}: {
  视图: P5详情正常视图;
  role: P5角色;
  快照: P5详情快照 | undefined;
  当前节点引用: RefObject<HTMLDivElement | null>;
  重读: () => void;
}): ReactNode {
  // 分段态来自阶段区自身的 state（pending/active/passed/ended），不是从文本推的；
  // 顺序按 mapper 交付的 S0→S3 原样，本组件不重排。
  const 分段们: 分段项[] = 视图.阶段区块.map((区) => {
    const 态: 分段项['态'] =
      区.状态 === 'pending' ? '未到达' : 区.状态 === 'active' ? '当前' : '已完成';
    return {
      阶段: 阶段名表[区.stage],
      态,
      状态文: 态 === '未到达' ? null : 区.状态文案,
      小结: 态 === '未到达' || 区.摘要 === '' ? null : 区.摘要,
      核对清单: 区.清单.length > 0
        ? 区.清单.map((项) => ({ 项: 项.文本, 结果: 项.完成 ? ('通过' as const) : ('核对中' as const) }))
        : undefined,
      对话: 段内对话(区, role),
      // 未到达段的一行说明用服务端自己的阶段摘要（typed 块，不是时间线文本）
      待推进说明: 态 === '未到达' && 区.摘要 !== '' ? 区.摘要 : undefined,
      空说明: 态 === '当前' ? 视图.步骤说明 : undefined,
      // Task 6 缝：S0–S3 动作卡（视图.actions）与补充问题回答框挂「当前」段尾部 ——
      // 本任务刻意不渲染任何动作/PDF UI，此槽留给 Task 6。
      尾部: undefined,
    };
  });

  return (
    <>
      {/* 刷新/轮询失败：旧详情原样保留只读，错误单独一行交代 + 重试（§10.3） */}
      {快照?.error && !快照.刷新中 ? (
        <div className={列表样式.错误行}>
          {快照.error}
          <button className={`${列表样式.重试键} 可点`} onClick={重读}>
            重试
          </button>
        </div>
      ) : null}

      {/* 状态行：闭词状态文案 + 步骤说明 + 轮次（权威 state.*，无 next_step）。
          候选端另带自己的意向坐标（不透明 ID 原样，对端字段进不了视图） */}
      <div style={状态行样式}>
        <span className={列表样式.阶段标}>{视图.状态文案}</span>
        <span style={步骤说明样式}>{视图.步骤说明}</span>
        {role === 'candidate' && 视图.intentionId !== null ? (
          <span className="等宽数字" style={意向样式}>
            意向 {视图.intentionId}
          </span>
        ) : null}
        <span className="等宽数字" style={轮次样式}>
          轮次 {视图.轮次.当前}/{视图.轮次.预算}
        </span>
      </div>

      {/* 终局摘要（wire outcome/reason 原样，不翻译不改写） */}
      {视图.终局摘要 !== null ? (
        <div style={终局卡样式}>
          <div style={终局题样式}>终局</div>
          <div>{视图.终局摘要.结束语}</div>
          <div>{视图.终局摘要.原因}</div>
          <div style={终局弱样式}>{视图.终局摘要.定格于}</div>
        </div>
      ) : null}

      {/* 移交只有 completed + handoff_pending 一种：只文案、不可聊、零动作（§7） */}
      {视图.handoff !== null ? <div style={移交行样式}>{视图.handoff.copy}</div> : null}

      {/* 四阶段对话流：类型化分段的渲染器（时间线/回执只是展示文本）。
          Task 6 缝：动作卡与 PDF 预览在 分段项.尾部 与 附件 槽接入，数据从
          视图.actions / 快照.detail.currentCoordination / intentConfirmations / 补充问题 取。 */}
      <阶段对话流 分段们={分段们} 当前段引用={当前节点引用} />
    </>
  );
}
