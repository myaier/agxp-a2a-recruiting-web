// P5 Task 5：双端四阶段详情（Backend 专用共享组件；Mock 屏不渲染本组件）。
// P5 Task 6：S0–S3 动作卡与授权原始 PDF 接入 Task 5 留下的 尾部/附件 缝。
// P5 Task 7：completed 移交行补恒禁用的「开始私聊」键（在场不可点、零导航、零会话标识）。
//
// 详情统一（2026-09-10 Task 1）：正常详情渲染共用外壳（组件/在谈详情/详情外壳，双端同版式），
// 顶栏由 数据/详情展示映射 的 从P5到详情顶栏 投影 —— 招聘端 alias 不进顶栏（去名裁定），
// 冻结职位 · 城市 · 薪资带改走 岗位上下文 行；viewer 待办徽标从顶栏右侧移进 进度 槽的状态行。
// 错误路径（契约错误 / 首载失败 / 读入中）保持原样：不进外壳、不调 mapper、不摆 Tab。
//
// 详情统一（2026-09-10 Task 5）：S0 动作（respond_fact / end_screening）的控制与展示分离 ——
// 控制在 屏幕/详情控制/use后端详情动作（阶段动作区 无条件调用，Task 9 迁 后端正常详情），
// 展示在 组件/在谈详情 的 详情动作卡 + 事实问题卡。
// 详情统一（2026-09-10 Task 6）：S1 五动作（accept/decline/retry/replace/
// decide_resume_screening，含单选 + 披露确认 + 终结确认）同样迁入 use后端详情动作，
// 展示走共用的 简历选择层 + 确认层；S2/S3 暂留本文件旧控制（Task 8 迁）。
// 详情统一（2026-09-10 Task 7）：授权原始 PDF 的租约/在飞/代际控制迁
// 屏幕/详情控制/useCasePDF预览（详情主体 无条件调用，Task 9 迁 后端正常详情），
// 弹层仍用本文件的 原始PDF层 呈现（Mock 仿真预览控制不在此通道）。
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
//     end_screening（候选）→决定S0(end)（卡上无 continue：继续不是前端授权动作）；
//     decline_resume_invitation→决定S0(end)；accept_resume_
//     invitation/retry_resume_readiness/replace_resume→提交简历(file,version,字面 true)
//     （resume-submission 路线）；decide_resume_screening→决定S1(continue|not_fit)；
//     decide_coordination→决定S2(issueId,accept|reject)；confirm_intent/decline_intent→
//     决定S3(confirm|decline)。已知后端缺口：投影器会给招聘端 needs_user 属主发
//     end_screening，但冻结 wire 的 decisions 路线只有候选端 /me 臂 —— 招聘端结束卡
//     fail closed（零控件零请求），待后端补 recruiter 臂。
//     S0+S1 的控制/展示都在 屏幕/详情控制/use后端详情动作 + 组件/在谈详情（Task 5/6 迁）；
//     S1 每次提交/更换/重试都当场重跑显式单选（准备候选委托简历 的权威库；null
//     = 会话/角色换代，静默返回，绝不当空库）+ 一次 Case 专属披露确认（点名所选 PDF
//     与冻结职位名，说清递交即披露）；确认/取消都即刻清层，下一次绝不复用；
//     disclosure_confirmed 只由这一次确认传字面 true。委托准备读有代际栅栏：换 case/
//     卸载后迟到成败整包作废（StrictMode 安全）。
//   · PDF 入口只由阶段区 typed 附件（后端披露后才下发）授权，两端同口径：候选端看的
//     是本 Case 已下发的本人简历，招聘端行为不变。角色可见性由服务端投影 + decoder 的
//     S1 披露栅栏（招聘端匿名初筛区永不带附件）决定，组件不再额外按角色过滤。
//     点击只调 读取简历PDF(role, caseId)（Case 专属 role 路径），拿回的 Plan 1 租约
//     只活在弹层生命周期：关闭/换 Case/换角色/卸载即 revoke，不缓存不持久化，绝不读
//     blob 文本/字节提身份；局部读代际保证迟到的成功租约立即回收、不开旧 Case 的弹层。
//     弹层正文用 <iframe src=租约地址> 直接呈现真实 PDF（选 iframe 而非 <object>：
//     无插件回退怪癖、字节留在嵌套浏览上下文、title 即无障碍名）；顶栏只有 PDF 徽标
//     + 文件名 + 关闭，无任何解释文字，弹层里不存在姓名/联系方式渲染路径。
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
import 阶段对话流 from '../../组件/阶段对话流';
import 确认层 from '../../组件/确认层';
// 原始 PDF 弹层只借既有 module 的壳，文案由本文件给：Plan 1 的 简历原件层 渲染的是
// Mock 仿真纸身（无 blob/url 通道）—— 评审 R1 裁定 P5 自建最小 UI，不硬套错口径的层。
// S1 递交单选（Task 6）改走共用 组件/在谈详情/简历选择层（复用 附件简历选择层 的面板类）。
import 原始PDF层 from '../../组件/原始PDF层';
import { 次级页外壳, 返回栏, 滚动区, 真输入条 } from '../../组件/通用';
import { 详情外壳 } from '../../组件/在谈详情/详情外壳';
import { 详情状态区 } from '../../组件/在谈详情/详情状态区';
import { 详情动作卡 } from '../../组件/在谈详情/详情动作卡';
import { 事实问题卡 } from '../../组件/在谈详情/事实问题卡';
import { 职位资料 } from '../../组件/在谈详情/职位资料';
import { 在线简历正文 } from '../../组件/在谈详情/在线简历正文';
import { 简历选择层 } from '../../组件/在谈详情/简历选择层';
import type { 详情Tab } from '../../组件/在谈详情/类型';
import { use后端详情动作 } from '../详情控制/use后端详情动作';
import { useCasePDF预览 } from '../详情控制/useCasePDF预览';
// 详情自己的样式：状态区/徽标/空态/错误/契约错误都已迁入共用外壳的 CSS（列表文件不回写）
import 样式 from '../../组件/在谈详情/详情外壳.module.css';
import { 从P5到详情分段, 从P5到详情状态, 从P5到详情顶栏, 从P5到职位资料 } from '../../数据/详情展示映射';
import { 轻提示 } from '../../组件/轻提示';
import { use应用状态 } from '../../状态/应用状态';
import { use导航 } from '../../路由/导航钩子';
import { 路径 } from '../../路由/路径表';
import { 映射P5详情, P5契约错误提示 } from '../../数据/MatchCase展示映射';
import type { P5角色, P5动作, P5动作卡, P5详情正常视图 } from '../../数据/MatchCase展示映射';
import { 取后端错误文案 } from '../../数据/HTTP客户端';
import type { P5详情 } from '../../数据/招聘数据源/MatchCase';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import { useMatchCase轮询 } from '../../状态/后端/useMatchCase轮询';
import type { P5详情快照, 应用操作 } from '../../状态/后端/类型';
import type { RefObject } from 'react';

const 叮嘱占位 = '有想法就告诉你的AI代理';
const 读入中文案 = '正在读入这一单…';
const 失败标题 = '这一单暂时打不开';
const 叮嘱失败提示 = '叮嘱没有发出去，请重试';

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
/** P7 Task 6：已发布移交的主键观感（与各动作卡主键同一设计令牌）。 */
const 移交就绪键样式: CSSProperties = {
  ...移交键样式,
  border: 0, background: 'var(--荧光绿)', color: 'var(--墨)',
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
  // P7 Task 6：详情轮询停止口径 = ended 或已发布会话；pending（含 same-party 长期
  // pending）保持 3 秒权威重读，绝不加前端超时终态。
  const 详情终局 = 正常 !== null && 正常.详情终局;

  // Tab 由连接层持有（切 Tab 不改 URL）：换 Case / 换角色回到 进度，不沿用上一单的视图
  const [当前Tab, 设当前Tab] = useState<详情Tab>('进度');
  useEffect(() => {
    设当前Tab('进度');
  }, [role, caseId]);

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

  // 进入页面（以及换 Case、从资料 Tab 切回进度）自动定位到当前阶段段（与两端 Mock 详情屏
  // 同构），不用手动划过整条流。两个 Tab 的内容互斥挂载，切走即卸载 —— 依赖里带上当前 Tab
  // 才能在切回进度时重新定位当前段，不因条件挂载丢失节点定位。
  const 当前节点引用 = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const 定时 = window.setTimeout(() => {
      当前节点引用.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 120);
    return () => window.clearTimeout(定时);
  }, [当前Tab, caseId]);

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

  // 回答在飞锁表（review-r2）：归本页所有 —— 阶段动作区会随「当前单无动作/动作在别段」
  // 整体卸载，锁表若随动作区丢，回原单时重挂载的是空表，会错误放行第二段草稿。
  const 回答在飞表 = useRef<Map<string, Promise<void>>>(new Map());

  const 重读 = () => void 操作.读取详情(role, caseId, true).catch(() => undefined);

  // 错误路径（契约错误 / 首载失败 / 读入中）保持原样：不进共用外壳、不调顶栏 mapper ——
  // 没有可渲染的正常详情就不摆 Tab，更不给虚假详情。
  if (正常 === null) {
    return (
      <次级页外壳 白底>
        <返回栏 返回={返回} />
        <滚动区>
          {契约错误 ? (
            // fail closed：契约错误视图动作表恒空，只给提示与重试，部分数据一概不渲染
            <div className={样式.契约错误行}>
              <div>{P5契约错误提示}</div>
              <button className={`${样式.重试键} 可点`} onClick={重读}>
                重试
              </button>
            </div>
          ) : (
            快照 !== undefined && 快照.阶段 === '失败' && 快照.detail === null ? (
              <div className={样式.空态}>
                <div className={样式.空态标题}>{失败标题}</div>
                <div className={样式.空态说明}>{快照.error}</div>
                <button className={`${样式.重试键} 可点`} onClick={重读}>
                  重试
                </button>
              </div>
            ) : (
              <div className={样式.空态}>{读入中文案}</div>
            )
          )}
        </滚动区>
      </次级页外壳>
    );
  }

  return (
    <详情外壳
      信息={从P5到详情顶栏(正常)}
      返回={返回}
      当前Tab={当前Tab}
      切Tab={设当前Tab}
      进度={
        // 正常详情主体（状态行 / 终局 / 四阶段对话流 / 动作卡 / PDF）原样搬进 进度 槽
        <详情主体
          视图={正常}
          role={role}
          caseId={caseId}
          操作={操作}
          快照={快照}
          当前节点引用={当前节点引用}
          重读={重读}
          回答在飞表={回答在飞表}
        />
      }
      资料={
        // 第二 Tab（详情统一 Task 3/4）：求职端 = 职位资料（spec §3.3 全部区块），招聘端 =
        // 在线简历正文（spec §3.4 九个信息区）。Backend 两端都只吃 Case 冻结详情，不用
        // 公司/岗位/推荐查询补值，也不发任何新请求。
        //
        // 招聘端（Task 4）：P5 detail 不提供结构化在线简历 —— 档 恒 null，不构造空假简历；
        // 完整缺失布局由共用正文逐区显示缺失（缺口说明与求职端资料区同一句约定文案），
        // 不以一句「简历尚未同步」替代整页，也不因 S1 授权 PDF 可读就推断结构化简历已提供。
        // 求职端摘要来自 Case 冻结的职位四事实，其余字段一律按约定缺失显示（投影见
        // 从P5到职位资料）；无合法公司导航坐标：入口位置保留、真实禁用并就地解释，
        // 不从公司文本推 opaque ID。
        role === 'recruiter' ? (
          <在线简历正文 档={null} 完整布局 缺失说明="当前在谈详情数据未提供" />
        ) : (
          <职位资料
            信息={从P5到职位资料(正常)}
            公司详情={{
              键: '公司详情',
              文案: '公司详情',
              外观: '次要',
              禁用说明: '公司详情暂不可用',
              执行: null,
            }}
          />
        )
      }
      底栏={
        // 底部 Case 叮嘱（双端同款）：终局不出现
        可输入 ? (
          <真输入条 占位={叮嘱占位} 值={叮嘱草稿} 改变={设叮嘱草稿} 发送={发叮嘱} />
        ) : null
      }
    />
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
  回答在飞表,
}: {
  视图: P5详情正常视图;
  role: P5角色;
  caseId: string;
  操作: 应用操作;
  快照: P5详情快照 | undefined;
  当前节点引用: RefObject<HTMLDivElement | null>;
  重读: () => void;
  回答在飞表: RefObject<Map<string, Promise<void>>>;
}): ReactNode {
  const { 跳转 } = use导航();
  // P7 Task 6：narrowing 到局部 const —— ready 分支的 conversationId 才能进回调
  const 移交 = 视图.handoff;
  // 归一化 DTO（协同块/意向词不在展示视图里，typed 判定从这里取；正常视图必然由它映射）
  const 详情 = 快照?.detail ?? null;

  // 授权原始 PDF（两端）：控制已搬 屏幕/详情控制/useCasePDF预览（详情统一 Task 7），
  // 本组件无条件调用（Task 9 迁 后端正常详情）—— 租约只活在弹层生命周期（关闭/换 Case/
  // 换角色/卸载即 revoke，绝不缓存），在飞单发防连点，迟到成败过代际栅栏。弹层正文直接以
  // 租约地址呈现真实 PDF 字节。
  const { 预览: PDF预览, 打开: 开PDF, 关闭: 关PDF } = useCasePDF预览({
    role,
    caseId,
    读取: 操作.读取简历PDF,
  });

  // 所有 hook 之后才收窄详情：正常视图只能来自快照里已 decode 的详情（见上：detail 为空
  // 不映射），这里收窄一次让分段投影拿到 raw stage、动作区拿到 typed 块，绝不从展示文案反推。
  if (详情 === null) return null;
  const 当前阶段 = 详情.state.stage;

  // 分段投影（详情统一 Task 2）：段态/顺序/标题/清单/对话/附件全由 数据/详情展示映射 的
  // 纯 mapper 交付，本组件不再各画各的。mapper 已把「有动作的合法当前段」标成 默认展开
  // （S0 passed 行该段已 passed：钉住展开，卡不随分节条折没）；控制端只把动作卡挂到那一段
  // —— 纯投影不含命令，PDF 回调也只在 点附件 这一条缝上接。
  const 分段们 = 从P5到详情分段(视图, 当前阶段).map((段) =>
    段.默认展开 === true
      ? {
          ...段,
          尾部: <阶段动作区 role={role} caseId={caseId} 视图={视图} 详情={详情} 操作={操作} 回答在飞表={回答在飞表} />,
        }
      : 段,
  );

  return (
    <>
      {/* 刷新/轮询失败：旧详情原样保留只读，错误单独一行交代 + 重试（§10.3） */}
      {快照?.error && !快照.刷新中 ? (
        <div className={样式.错误行}>
          {快照.error}
          <button className={`${样式.重试键} 可点`} onClick={重读}>
            重试
          </button>
        </div>
      ) : null}

      {/* 状态区（详情统一 Task 2 收进共用展示）：viewer 待办徽标 + 闭词状态文案 +
          步骤说明 + 轮次 + 注意说明，全部由 从P5到详情状态 投影（权威 state.*）。
          徽标原在顶栏右侧；共用外壳的顶栏右侧只放分数/薪资，徽标归 进度 状态区
          （spec §3.1：不占用或替代匹配分位置），终局（ended/completed）只读态不挂
          —— 那是进行中的语义；attention 行非待办时给「需注意」（owner-safe），
          绝不显示「代理处理中」。
          Task 4：内部 intentionId 不再进可见内容 —— 它仍留在详情模型里供路由/归属/动作
          使用，业务上下文由冻结职位名、城市与薪资带承载。 */}
      <详情状态区 信息={从P5到详情状态(视图)} />

      {/* 终局摘要（wire outcome/reason 原样，不翻译不改写） */}
      {视图.终局摘要 !== null ? (
        <div style={终局卡样式}>
          <div style={终局题样式}>终局</div>
          <div>{视图.终局摘要.结束语}</div>
          <div>{视图.终局摘要.原因}</div>
          <div style={终局弱样式}>{视图.终局摘要.定格于}</div>
        </div>
      ) : null}

      {/* P7 Task 6：completed 两步移交 —— pending（handoff_pending）恒禁用零导航；
          ready（complete + conversation_ref）启用「开始私聊」并按角色进入 P7 参数路由。
          会话坐标唯一来自权威 conversation_ref —— 不生成、不缓存、不推断。 */}
      {移交 !== null ? (
        <div style={移交区样式}>
          <div style={移交行样式}>{移交.copy}</div>
          {移交.state === 'ready' ? (
            <button
              type="button"
              className="可点"
              style={移交就绪键样式}
              onClick={() =>
                跳转(role === 'candidate'
                  ? 路径.真人会话路径(移交.conversationId)
                  : 路径.企业真人会话路径(移交.conversationId))}
            >
              开始私聊
            </button>
          ) : (
            <button type="button" style={移交键样式} disabled>
              开始私聊
            </button>
          )}
        </div>
      ) : null}

      {/* 四阶段对话流：类型化分段的渲染器（时间线/回执只是展示文本），三详情共用同一条渲染链。
          动作卡在 分段项.尾部、两端 PDF 入口在 附件 槽（点附件 只走 Case 专属 role 路径）。
          key = caseId：同路由换单不重挂整页，但折叠/展开的本地 UI 状态不沿用上一单（spec §3.1）。 */}
      <阶段对话流
        key={caseId}
        分段们={分段们}
        当前段引用={当前节点引用}
        点附件={(文件名) => void 开PDF(文件名)}
      />

      {/* 原始 PDF 弹层：顶栏只有 PDF 徽标 + 文件名 + 关闭（无解释文字）；正文以
          租约地址呈现真实字节；关闭（hook 交付）即回收租约。弹层里不存在姓名/联系方式
          渲染路径。 */}
      {PDF预览 !== null ? (
        <原始PDF层 文件名={PDF预览.文件名} 地址={PDF预览.地址} 关闭={关PDF} />
      ) : null}
    </>
  );
}

// ── S2/S3 动作区：只渲染映射交集里的卡，控件再过 typed 坐标栅栏 ────────────────
//
// 详情统一（2026-09-10 Task 5/6）：S0 两卡（respond_fact 补充事实 / end_screening 结束
// 初筛）与 S1 五动作（邀请二卡 / 重试 / 更换 / 初筛结论，含单选 + 披露确认 + 终结确认）
// 的控制已搬入 屏幕/详情控制/use后端详情动作，展示走共用的 详情动作卡 / 事实问题卡 /
// 简历选择层 / 确认层；本组件无条件调用该 hook（Task 9 迁入 后端正常详情），返回合同
// 恒定 —— S2/S3 仍由下方旧控制暂留（Task 8 迁入），同一 action 绝不双挂载。

/** 动作区会调用的操作面（测试桩同形）。 */
type 动作操作 = Pick<应用操作,
  '回答事实' | '决定S0' | '决定S1' | '决定S2' | '决定S3' | '提交简历' | '准备候选委托简历'>;

function 阶段动作区({
  role,
  caseId,
  视图,
  详情,
  操作,
  回答在飞表,
}: {
  role: P5角色;
  caseId: string;
  视图: P5详情正常视图;
  详情: P5详情;
  操作: 动作操作;
  回答在飞表: RefObject<Map<string, Promise<void>>>;
}): ReactNode {
  // S0+S1 动作控制：卡片、回答区、单选/披露/终结确认的 props 全由 hook 交付；
  // 回答在飞表仍由页面级 MatchCase详情 持有并传入（动作区卸载不丢锁）。
  const { 卡片们, 事实问题, 简历选择, 披露确认, 终结确认 } = use后端详情动作({
    role, caseId, 视图, 详情, 操作, 回答在飞表,
  });

  // S2/S3 的写中锁（原 阶段动作区 的 写中 收缩为只服务未迁移动作；Task 8 随迁删除）
  const [写中, 设写中] = useState(false);

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

  // S2/S3 typed 栅栏：必需且未决 / 本端意向词为空（与后端 projector 同判据，防御性收口）
  const 协同块 = 详情.currentCoordination;
  const 本端协同未决 = 协同块 !== null && 协同块.requiredRoles.includes(role) &&
    (role === 'candidate' ? !协同块.candidateDecided : !协同块.recruiterDecided);
  const 本端意向未决 = 详情.intentConfirmations[role] === '';

  if (视图.actions.length === 0) return null;

  /** 未迁移动作词（S2/S3）的控件；无 typed 坐标/无本端准许路线 → null（零控件零请求）。
   *  respond_fact / end_screening / S1 五词已迁 use后端详情动作，渲染层不会把它们送到这里。 */
  const 控件 = (动作: P5动作): ReactNode => {
    switch (动作) {
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

  // 已迁卡（S0+S1，键 = 动作词）只经 hook 输出渲染，其余动作（S2/S3）仍走本组件旧渲染
  // —— 按映射交集给定的顺序遍历，同一 action 只有一个来源，绝不双挂载。
  const 迁卡 = new Map(卡片们.map((卡) => [卡.键, 卡]));

  return (
    <>
      <div style={动作区样式}>
        {视图.actions.map((卡: P5动作卡) => {
          const 迁 = 迁卡.get(卡.action);
          if (迁 !== undefined) {
            return (
              <详情动作卡
                key={迁.键}
                信息={迁.键 === 'respond_fact' && 事实问题 !== null
                  ? { ...迁, 正文: <事实问题卡 {...事实问题} /> }
                  : 迁}
              />
            );
          }
          return (
            <div key={卡.action} style={动作卡样式}>
              <div style={动作卡题样式}>{卡.标题}</div>
              <div style={动作卡说明样式}>{卡.说明}</div>
              {控件(卡.action)}
            </div>
          );
        })}
      </div>

      {/* S1 多份附件的当场单选（use后端详情动作 交付的 简历选择属性）；取消/遮罩/Esc
          只走 取消（零请求），确认进披露确认 —— 展示归共用 简历选择层 */}
      {简历选择 !== null ? <简历选择层 {...简历选择} /> : null}

      {/* S1 Case 专属披露确认（hook 交付的 确认属性，逐字段透传）：正文点名冻结职位
          与这次递交哪份 PDF；确认/取消都即刻清层，上一次的授权绝不复用 */}
      {披露确认 !== null ? <确认层 {...披露确认} /> : null}

      {/* 终结类二次确认（结束初筛/婉拒邀请/判不合适，hook 交付，逐字段透传） */}
      {终结确认 !== null ? <确认层 {...终结确认} /> : null}
    </>
  );
}
