// P5 Task 5：双端四阶段详情（Backend 专用共享组件；Mock 屏不渲染本组件）。
// P5 Task 6：S0–S3 动作卡与授权原始 PDF 接入 Task 5 留下的 尾部/附件 缝。
// P5 Task 7：completed 移交行补恒禁用的「开始私聊」键（在场不可点、零导航、零会话标识）。
//
// 模式边界（spec §5/§6/§8/§10.3 与 P5 冻结契约）：
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
//   · 动作卡只从 视图.actions（Task 2 交集：行侧白名单 ∩ available_actions）渲染，本组件
//     绝不加卡、绝不从时间线文本/对方状态 infer。每个动作的控件再按 typed 坐标栅栏：
//     respond_fact 要唯一匹配的补充问题（零/多条整页契约错误，映射层已挡）；S2 要
//     currentCoordination 且本端必需且未决；S3 要本端意向词为空；S1 重试要阶段区 typed
//     附件（已绑定 file/version 对）；缺坐标一律零控件零请求（fail closed）。
//   · 动作词 → 操作层路线（与 wire 唯一准许路线一一对应）：respond_fact→回答事实；
//     end_screening（候选）/decline_resume_invitation→决定S0(continue|end)；accept_resume_
//     invitation/retry_resume_readiness/replace_resume→提交简历(file,version,字面 true)
//     （resume-submission 路线）；decide_resume_screening→决定S1(continue|not_fit)；
//     decide_coordination→决定S2(issueId,accept|reject)；confirm_intent/decline_intent→
//     决定S3(confirm|decline)。已知后端缺口：投影器会给招聘端 needs_user 属主发
//     end_screening，但冻结 wire 的 decisions 路线只有候选端 /me 臂 —— 招聘端结束卡
//     fail closed（零控件零请求），待后端补 recruiter 臂。
//   · S1 每次提交/更换/重试都当场重跑显式单选（准备候选委托简历 的权威库；null
//     = 会话/角色换代，静默返回，绝不当空库）+ 一次 Case 专属披露确认（点名所选 PDF
//     与冻结职位名，说清递交即披露）；确认/取消都即刻清层，下一次绝不复用；
//     disclosure_confirmed 只由这一次确认传字面 true。委托准备读有代际栅栏：换 case/
//     卸载后迟到成败整包作废（StrictMode 安全）。
//   · 招聘端 PDF 入口只由阶段区 typed 附件（后端披露后才下发）授权；点击只调
//     读取简历PDF(role, caseId)（Case 专属 role 路径），拿回的 Plan 1 租约只活在弹层
//     生命周期：关闭/卸载即 revoke，不缓存不持久化，绝不读 blob 文本/字节提身份。
//     弹层正文用 <iframe src=租约地址> 直接呈现真实 PDF（选 iframe 而非 <object>：
//     无插件回退怪癖、字节留在嵌套浏览上下文、title 即无障碍名）；顶栏只有 PDF 徽标
//     + 文件名 + 关闭，无任何解释文字，弹层里不存在姓名/联系方式渲染路径。候选端
//     本任务不建 PDF 入口。
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
import { 从附件行取选择值, type 附件简历选择值 } from '../../组件/附件简历选择层';
import 弹层框架 from '../../组件/弹层框架';
import 确认层 from '../../组件/确认层';
// P5 专属弹层只借两份既有 module 的壳（抽屉顶栏 / 单选面板的类），文案由本文件给：
// Plan 1 的 简历原件层 渲染的是 Mock 仿真纸身（无 blob/url 通道），附件简历选择层 的
// 确认键文案是「委托」口径 —— 评审 R1 裁定：这两处 P5 各建最小 UI，不硬套错口径的层。
import 选择样式 from '../../组件/附件简历选择层.module.css';
import 原始PDF层 from '../../组件/原始PDF层';
import { 次级页外壳, 返回栏, 滚动区, 真输入条 } from '../../组件/通用';
import { 轻提示 } from '../../组件/轻提示';
import { use应用状态 } from '../../状态/应用状态';
import { use导航 } from '../../路由/导航钩子';
import { 路径 } from '../../路由/路径表';
import { 映射P5详情, P5契约错误提示 } from '../../数据/MatchCase展示映射';
import type { P5角色, P5阶段, P5动作, P5动作卡, P5详情正常视图, P5阶段区块视图 } from '../../数据/MatchCase展示映射';
import { 取后端错误文案 } from '../../数据/HTTP客户端';
import type { BFF附件简历 } from '../../数据/BFF契约';
import type { PDF对象租约 } from '../../数据/PDF对象租约';
import type { P5详情, P5简历附件 } from '../../数据/招聘数据源/MatchCase';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import { useMatchCase轮询 } from '../../状态/后端/useMatchCase轮询';
import type { P5详情快照, 应用操作 } from '../../状态/后端/类型';
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
const 移交区样式: CSSProperties = {
  margin: '0 16px 10px', display: 'flex', flexDirection: 'column', gap: 10,
};
const 移交行样式: CSSProperties = {
  padding: '12px 14px', borderRadius: 14, background: 'var(--意向底)',
  color: 'var(--意向)', fontSize: 13, fontWeight: 700, lineHeight: 1.6,
};
/** 移交态的「开始私聊」：在场但恒禁用（准备中，会话标识属 P7）——弱化到不可点的观感。 */
const 移交键样式: CSSProperties = {
  alignSelf: 'flex-start', padding: '7px 15px', borderRadius: 999,
  border: '1px solid var(--描边)', background: 'var(--浅灰底)', color: 'var(--最弱)',
  fontSize: 12.5, fontWeight: 700,
};

// ── Task 6：动作卡与回答框的行内版式（沿用设计令牌，不另建 CSS 文件）──────────

const 动作区样式: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10 };
const 动作卡样式: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 7,
  padding: '12px 14px', borderRadius: 14, background: 'var(--浅灰底)',
};
const 动作卡题样式: CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--正文)' };
const 动作卡说明样式: CSSProperties = { fontSize: 11.5, color: 'var(--最弱)', lineHeight: 1.5 };
const 键行样式: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 };
const 动作主键样式: CSSProperties = {
  flex: 'none', padding: '7px 15px', borderRadius: 999, border: 0,
  background: 'var(--荧光绿)', color: 'var(--墨)', fontSize: 12.5, fontWeight: 700,
};
const 动作次键样式: CSSProperties = {
  flex: 'none', padding: '7px 15px', borderRadius: 999,
  background: 'transparent', border: '1px solid var(--描边深)', color: 'var(--正文)', fontSize: 12.5,
};
const 回答框样式: CSSProperties = {
  width: '100%', boxSizing: 'border-box', minHeight: 64, padding: '9px 11px', resize: 'vertical',
  borderRadius: 10, border: '1px solid var(--描边深)', background: '#fff',
  fontSize: 13, lineHeight: 1.6, color: 'var(--正文)',
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
          // 终局（ended/completed）只读：不挂「需要你/代理处理中」徽标 —— 那是进行中的语义。
          正常 === null || 终局 ? undefined : (
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
          <详情主体
            视图={正常}
            role={role}
            caseId={caseId}
            操作={操作}
            快照={快照}
            当前节点引用={当前节点引用}
            重读={重读}
          />
        )}
      </滚动区>

      {/* 底部 Case 叮嘱（双端同款）：终局/契约错误/未知详情一律不出现 */}
      {可输入 ? (
        <真输入条 占位={叮嘱占位} 值={叮嘱草稿} 改变={设叮嘱草稿} 发送={发叮嘱} />
      ) : null}
    </次级页外壳>
  );
}

// ── 正常详情主体：状态行 + 终局/移交 + 四阶段对话流（尾部动作卡 + 授权 PDF）──────

function 详情主体({
  视图,
  role,
  caseId,
  操作,
  快照,
  当前节点引用,
  重读,
}: {
  视图: P5详情正常视图;
  role: P5角色;
  caseId: string;
  操作: 应用操作;
  快照: P5详情快照 | undefined;
  当前节点引用: RefObject<HTMLDivElement | null>;
  重读: () => void;
}): ReactNode {
  // 归一化 DTO（协同块/意向词不在展示视图里，typed 判定从这里取；正常视图必然由它映射）
  const 详情 = 快照?.detail ?? null;
  const 当前阶段 = 详情?.state.stage ?? null;
  const 有动作 = 视图.actions.length > 0;

  // 授权原始 PDF（招聘端）：租约只活在弹层生命周期 —— 关闭/卸载即 revoke，
  // 绝不缓存；在飞单发防连点双租约。弹层正文直接以租约地址呈现真实 PDF 字节。
  const [PDF预览, 设PDF预览] = useState<{ 文件名: string; 地址: string } | null>(null);
  const PDF租约引用 = useRef<PDF对象租约 | null>(null);
  const PDF在飞 = useRef(false);
  const 回收租约 = () => {
    PDF租约引用.current?.revoke();
    PDF租约引用.current = null;
  };
  useEffect(() => 回收租约, []);
  const 开PDF = async (文件名: string) => {
    if (PDF在飞.current || PDF预览 !== null || caseId === '') return;
    PDF在飞.current = true;
    try {
      // 只走 Case 专属 role 路径；操作层已建租约并在会话边界登记回收
      const 租约 = await 操作.读取简历PDF(role, caseId);
      回收租约(); // 防御：上一张（理论上不存在）先回收再挂新的
      PDF租约引用.current = 租约;
      设PDF预览({ 文件名, 地址: 租约.url });
    } catch (错误) {
      轻提示(取后端错误文案(错误));
    } finally {
      PDF在飞.current = false;
    }
  };

  // 分段态来自阶段区自身的 state（pending/active/passed/ended），不是从文本推的；
  // 顺序按 mapper 交付的 S0→S3 原样，本组件不重排。动作区挂「Case 当前阶段」那一段的
  // 尾部（S0 passed 行该段已 passed：默认展开钉住，卡不随分节条折没）；招聘端的
  // typed 附件（后端披露后才下发）是该段唯一的 PDF 入口。
  const 分段们: 分段项[] = 视图.阶段区块.map((区) => {
    const 态: 分段项['态'] =
      区.状态 === 'pending' ? '未到达' : 区.状态 === 'active' ? '当前' : '已完成';
    const 是动作段 = 有动作 && 区.stage === 当前阶段 && 详情 !== null;
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
      // 招聘端才有 PDF 入口（候选端本任务不建）；附件行只是入口，点击才发请求。
      // 附件常驻（评审终审修复）：入口独立于段内对话 —— 叮嘱回执/时间线文本落进
      // S1 段也绝不压掉这个唯一 PDF 入口（Mock 屏不传该旗，行为不变）。
      附件: role === 'recruiter' && 区.附件 !== null ? { 文件名: 区.附件.displayName } : null,
      附件常驻: role === 'recruiter' && 区.附件 !== null ? true : undefined,
      // 有动作卡的段保持展开（passed 段也能一眼看到等你的决定）
      默认展开: 是动作段 ? true : undefined,
      尾部: 是动作段
        ? <阶段动作区 role={role} caseId={caseId} 视图={视图} 详情={详情} 操作={操作} />
        : undefined,
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

      {/* 状态行：闭词状态文案 + 步骤说明 + 轮次（权威 state.*，无服务端下一步字段）。
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

      {/* 移交只有 completed + handoff_pending 一种（§7）：准备文案 + 恒禁用的「开始私聊」，
          点击零导航（canChat 恒 false）；P5 视图里不存在任何会话标识 —— 不生成、不缓存、
          不推断，会话路由与标识属 P7。 */}
      {视图.handoff !== null ? (
        <div style={移交区样式}>
          <div style={移交行样式}>{视图.handoff.copy}</div>
          <button type="button" style={移交键样式} disabled>
            开始私聊
          </button>
        </div>
      ) : null}

      {/* 四阶段对话流：类型化分段的渲染器（时间线/回执只是展示文本）。
          动作卡在 分段项.尾部、招聘端 PDF 入口在 附件 槽（点附件 只走 Case 专属 role 路径）。 */}
      <阶段对话流
        分段们={分段们}
        当前段引用={当前节点引用}
        点附件={role === 'recruiter' ? (文件名) => void 开PDF(文件名) : undefined}
      />

      {/* 原始 PDF 弹层：顶栏只有 PDF 徽标 + 文件名 + 关闭（无解释文字）；正文以
          租约地址呈现真实字节；关闭即回收租约。弹层里不存在姓名/联系方式渲染路径。 */}
      {PDF预览 !== null ? (
        <原始PDF层
          文件名={PDF预览.文件名}
          地址={PDF预览.地址}
          关闭={() => {
            回收租约();
            设PDF预览(null);
          }}
        />
      ) : null}
    </>
  );
}

// ── P5 专属弹层（评审 R1）：真实 PDF 抽屉与 S1 递交单选，借既有壳、P5 文案 ──────

/**
 * S1 递交的单选层：面板类复用 附件简历选择层.module.css（单选清单同一版式），
 * 文案是 P5 递交口径（评审 R1：Plan 1 层的「确认并委托」是委托话术，不表达
 * S1 简历递交）。单选草稿只在层开着时存在，取消/确认/卸载即消失，绝不记默认。
 */
function S1简历选择层({
  文件们,
  职位名,
  取消,
  确认,
}: {
  文件们: readonly BFF附件简历[];
  职位名: string;
  取消: () => void;
  确认: (选择: 附件简历选择值) => void;
}) {
  const [选中编号, 设选中编号] = useState<string | null>(null);
  const 选中文件 = 文件们.find((条) => 条.file_id === 选中编号) ?? null;
  return (
    <弹层框架 标签="选择递交简历" 遮罩类名={选择样式.遮罩} 面板类名={选择样式.面板} 关闭={取消}>
      <div className={选择样式.标题}>选择这次递交的简历</div>
      <div className={选择样式.说明}>
        本次 Case 是「{职位名}」；所选 PDF 与披露授权仅对这一次递交生效，不会记住为默认。
      </div>
      <div className={`${选择样式.清单} 滚动区`} role="radiogroup" aria-label="选择简历">
        {文件们.map((条) => (
          <label key={条.file_id} className={选择样式.行}>
            <input
              type="radio"
              name="递交简历"
              className={选择样式.单选钮}
              checked={选中编号 === 条.file_id}
              onChange={() => 设选中编号(条.file_id)}
            />
            <span className={`${选择样式.文件名} 单行`}>{条.display_name}</span>
          </label>
        ))}
      </div>
      <div className={选择样式.键行}>
        <button type="button" className={`${选择样式.取消键} 可点`} onClick={取消}>
          暂不递交
        </button>
        <button
          type="button"
          className={`${选择样式.确认键} 可点`}
          disabled={选中文件 === null}
          onClick={() => {
            if (选中文件 !== null) 确认(从附件行取选择值(选中文件));
          }}
        >
          选定这份
        </button>
      </div>
    </弹层框架>
  );
}

// ── S0–S3 动作区：只渲染映射交集里的卡，控件再过 typed 坐标栅栏 ────────────────

/** 动作区会调用的操作面（测试桩同形）。 */
type 动作操作 = Pick<应用操作,
  '回答事实' | '决定S0' | '决定S1' | '决定S2' | '决定S3' | '提交简历' | '准备候选委托简历'>;

/** 终结类动作（结束初筛/婉拒邀请/判不合适）的二次确认载荷。 */
interface 终结确认 {
  标题: string;
  正文: string;
  执行文: string;
  取消文: string;
  执行: () => void;
}

function 阶段动作区({
  role,
  caseId,
  视图,
  详情,
  操作,
}: {
  role: P5角色;
  caseId: string;
  视图: P5详情正常视图;
  详情: P5详情;
  操作: 动作操作;
}): ReactNode {
  const { 跳转 } = use导航();

  const [回答草稿, 设回答草稿] = useState('');
  const 回答在飞 = useRef(false);
  // S1 提交三态：权威库单选 → Case 专属披露确认 → POST（字面 true）；任一结束即清
  const [待选择, 设待选择] = useState<{ 文件们: readonly BFF附件简历[] } | null>(null);
  const [待披露, 设待披露] = useState<{ 选择: 附件简历选择值 } | null>(null);
  const [待确认终局, 设待确认终局] = useState<终结确认 | null>(null);
  const [写中, 设写中] = useState(false);

  // 委托准备栅栏（与 P4 委托同款）：代际 token，卸载与换 case 都递增；迟到的
  // 权威库结果（含拒绝）对不上代际就整包静默作废，绝不跨 case 弹层/提示/跳转。
  const 准备代际 = useRef(0);
  useEffect(() => () => {
    准备代际.current += 1;
  }, []);
  useEffect(() => {
    准备代际.current += 1;
    设待选择(null);
    设待披露(null);
    设待确认终局(null);
    设回答草稿('');
  }, [caseId]);

  const 报错 = (错误: unknown) => 轻提示(取后端错误文案(错误));

  /** 命令包装：服务端先行，失败原地提示；权威重读归操作层（本组件绝不本地重建）。 */
  const 发命令 = async (运行: () => Promise<void>) => {
    if (写中 || caseId === '') return;
    设写中(true);
    try {
      await 运行();
    } catch (错误) {
      报错(错误);
    } finally {
      设写中(false);
    }
  };

  // respond_fact：typed promptId 来自映射层的唯一匹配（零/多条整页契约错误，到不了这里）
  const 发回答 = () => {
    const 内容 = 回答草稿.trim();
    const 问题 = 视图.补充问题;
    if (内容 === '' || 问题 === null || caseId === '' || 回答在飞.current) return;
    回答在飞.current = true;
    操作.回答事实(role, caseId, 问题.promptId, 内容)
      .then(() => {
        设回答草稿(''); // 仅成功清空；卡随操作层重读消失
      })
      .catch(报错)
      .finally(() => {
        回答在飞.current = false;
      });
  };

  // S1 接受/更换：先拿权威附件库（每次尝试都重跑），再多份单选、单份直达披露确认
  const 开始选择 = async () => {
    if (写中 || caseId === '') return;
    const 起始代际 = 准备代际.current;
    try {
      const 库 = await 操作.准备候选委托简历();
      if (准备代际.current !== 起始代际) return; // 迟到：scope 已变/已卸载，整包作废
      if (库 === null) return; // 会话/角色换代：静默返回，null 不是空库
      if (库.items.length === 0) {
        轻提示('请先上传一份 PDF 简历');
        跳转(路径.我的简历);
        return;
      }
      if (库.items.length === 1) {
        const 唯一 = 库.items[0];
        if (唯一 !== undefined) 设待披露({ 选择: 从附件行取选择值(唯一) });
        return;
      }
      设待选择({ 文件们: 库.items });
    } catch (错误) {
      if (准备代际.current !== 起始代际) return; // 拒绝路径同样过栅栏
      报错(错误);
    }
  };

  // S1 重试：坐标只取阶段区 typed 附件（Case 当前绑定的 file/version 对），绝不猜
  let 绑定附件: P5简历附件 | null = null;
  for (const 区 of 视图.阶段区块) {
    if (区.附件 !== null) {
      绑定附件 = 区.附件;
      break;
    }
  }
  const 开始重试 = () => {
    if (绑定附件 === null || 写中) return; // 无 typed 坐标：零控件（渲染层已挡）
    设待披露({
      选择: {
        fileId: 绑定附件.fileId,
        fileVersionId: 绑定附件.fileVersionId,
        displayName: 绑定附件.displayName,
      },
    });
  };

  /** 披露确认的唯一出口：先收层再发，字面 true 只由这一次确认传入；失败要求重新确认。 */
  const 执行披露提交 = (选择: 附件简历选择值) => {
    设待披露(null);
    void 发命令(() => 操作.提交简历(caseId, 选择.fileId, 选择.fileVersionId, true));
  };

  // 终结类确认（不可逆）：正文把后果讲清，确认才发命令
  const 确认结束初筛 = () =>
    设待确认终局({
      标题: '结束本次匿名初筛？',
      正文: '结束后这一单立即终止，无法恢复。',
      执行文: '结束初筛',
      取消文: '暂不结束',
      执行: () => {
        设待确认终局(null);
        void 发命令(() => 操作.决定S0(caseId, 'end'));
      },
    });
  // 婉拒简历邀请 = decisions 路线的 end（wire 无 decline 专臂；e2e J2 同款语义）
  const 确认婉拒邀请 = () =>
    设待确认终局({
      标题: '婉拒这次简历邀请？',
      正文: '婉拒后这一单将结束，不会向该招聘方披露你的简历。',
      执行文: '婉拒邀请',
      取消文: '暂不婉拒',
      执行: () => {
        设待确认终局(null);
        void 发命令(() => 操作.决定S0(caseId, 'end'));
      },
    });
  const 确认不合适 = () =>
    设待确认终局({
      标题: '判定简历不合适？',
      正文: '判定后这一单将结束，无法恢复。',
      执行文: '确认不合适',
      取消文: '再想想',
      执行: () => {
        设待确认终局(null);
        void 发命令(() => 操作.决定S1(caseId, 'not_fit'));
      },
    });

  // S2/S3 typed 栅栏：必需且未决 / 本端意向词为空（与后端 projector 同判据，防御性收口）
  const 协同块 = 详情.currentCoordination;
  const 本端协同未决 = 协同块 !== null && 协同块.requiredRoles.includes(role) &&
    (role === 'candidate' ? !协同块.candidateDecided : !协同块.recruiterDecided);
  const 本端意向未决 = 详情.intentConfirmations[role] === '';

  if (视图.actions.length === 0) return null;

  /** 每个动作词的控件；无 typed 坐标/无本端准许路线 → null（零控件零请求）。 */
  const 控件 = (动作: P5动作): ReactNode => {
    switch (动作) {
      case 'respond_fact':
        // 零/多条匹配已在映射层 fail closed；这里再挡一层（缺问题即无提交控件）
        return 视图.补充问题 === null ? null : (
          <>
            <textarea
              aria-label="回答问题"
              style={回答框样式}
              value={回答草稿}
              onChange={(事件) => 设回答草稿(事件.target.value)}
            />
            <div style={键行样式}>
              <button type="button" className="可点" style={动作主键样式} onClick={发回答}>
                提交回答
              </button>
            </div>
          </>
        );
      case 'end_screening':
        // decisions 路线只有候选端 /me 臂：招聘端结束卡无本端准许路线，零控件
        return role !== 'candidate' ? null : (
          <div style={键行样式}>
            <button
              type="button" className="可点" style={动作主键样式} disabled={写中}
              onClick={() => void 发命令(() => 操作.决定S0(caseId, 'continue'))}
            >
              继续初筛
            </button>
            <button
              type="button" className="可点" style={动作次键样式} disabled={写中}
              onClick={确认结束初筛}
            >
              结束初筛
            </button>
          </div>
        );
      case 'accept_resume_invitation':
        return (
          <div style={键行样式}>
            <button
              type="button" className="可点" style={动作主键样式} disabled={写中}
              onClick={() => void 开始选择()}
            >
              接受邀请
            </button>
          </div>
        );
      case 'decline_resume_invitation':
        return (
          <div style={键行样式}>
            <button
              type="button" className="可点" style={动作次键样式} disabled={写中}
              onClick={确认婉拒邀请}
            >
              婉拒邀请
            </button>
          </div>
        );
      case 'retry_resume_readiness':
        return 绑定附件 === null ? null : (
          <div style={键行样式}>
            <button type="button" className="可点" style={动作主键样式} disabled={写中} onClick={开始重试}>
              重试校验
            </button>
          </div>
        );
      case 'replace_resume':
        return (
          <div style={键行样式}>
            <button
              type="button" className="可点" style={动作主键样式} disabled={写中}
              onClick={() => void 开始选择()}
            >
              更换简历
            </button>
          </div>
        );
      case 'decide_resume_screening':
        return (
          <div style={键行样式}>
            <button
              type="button" className="可点" style={动作主键样式} disabled={写中}
              onClick={() => void 发命令(() => 操作.决定S1(caseId, 'continue'))}
            >
              通过初筛
            </button>
            <button
              type="button" className="可点" style={动作次键样式} disabled={写中}
              onClick={确认不合适}
            >
              不合适
            </button>
          </div>
        );
      case 'decide_coordination':
        return 本端协同未决 && 协同块 !== null ? (
          <div style={键行样式}>
            <button
              type="button" className="可点" style={动作主键样式} disabled={写中}
              onClick={() => void 发命令(() => 操作.决定S2(role, caseId, 协同块.issueId, 'accept'))}
            >
              接受
            </button>
            <button
              type="button" className="可点" style={动作次键样式} disabled={写中}
              onClick={() => void 发命令(() => 操作.决定S2(role, caseId, 协同块.issueId, 'reject'))}
            >
              拒绝
            </button>
          </div>
        ) : null;
      case 'confirm_intent':
        return 本端意向未决 ? (
          <div style={键行样式}>
            <button
              type="button" className="可点" style={动作主键样式} disabled={写中}
              onClick={() => void 发命令(() => 操作.决定S3(role, caseId, 'confirm'))}
            >
              确认意向
            </button>
          </div>
        ) : null;
      case 'decline_intent':
        return 本端意向未决 ? (
          <div style={键行样式}>
            <button
              type="button" className="可点" style={动作次键样式} disabled={写中}
              onClick={() => void 发命令(() => 操作.决定S3(role, caseId, 'decline'))}
            >
              婉拒意向
            </button>
          </div>
        ) : null;
    }
  };

  return (
    <>
      <div style={动作区样式}>
        {视图.actions.map((卡: P5动作卡) => (
          <div key={卡.action} style={动作卡样式}>
            <div style={动作卡题样式}>{卡.标题}</div>
            <div style={动作卡说明样式}>{卡.说明}</div>
            {控件(卡.action)}
          </div>
        ))}
      </div>

      {待选择 !== null ? (
        // 多份附件：当场单选一份（P5 递交口径的单选层）；取消/遮罩/Esc 零请求，
        // 确认进披露确认
        <S1简历选择层
          文件们={待选择.文件们}
          职位名={视图.职位.职位名}
          取消={() => 设待选择(null)}
          确认={(选择) => {
            设待选择(null);
            设待披露({ 选择 });
          }}
        />
      ) : null}

      {待披露 !== null ? (
        // Case 专属披露确认：正文点名冻结职位（Case 上下文，无别名）与这次递交
        // 哪份 PDF，说清递交即披露；仅对这一次递交生效。确认/取消都即刻清层 ——
        // 上一次的授权绝不复用（spec §8.1）。
        <确认层
          标题="确认递交这份简历？"
          正文={`本次将向「${视图.职位.职位名}」这一 Case 递交「${待披露.选择.displayName}」，递交后本份简历与你的姓名、联系方式即向该招聘方披露。授权仅对这一次递交生效。`}
          执行文="确认递交"
          取消文="暂不递交"
          取消={() => 设待披露(null)}
          执行={() => 执行披露提交(待披露.选择)}
        />
      ) : null}

      {待确认终局 !== null ? (
        <确认层
          标题={待确认终局.标题}
          正文={待确认终局.正文}
          执行文={待确认终局.执行文}
          取消文={待确认终局.取消文}
          取消={() => 设待确认终局(null)}
          执行={待确认终局.执行}
        />
      ) : null}
    </>
  );
}
