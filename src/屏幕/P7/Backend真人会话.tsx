// P7 Backend 真人会话（双角色共用）：只读 后端状态 的 P7 详情/消息快照与真人会话
// 操作，绝不 import Mock 联系人、Mock 消息 fixture 或写死会话剧情。
// 铁律（spec §5.3/§8.3 与已准入 P7 冻结契约）：
//   · 直达刷新：参数路由进屏先注册可见会话再并行读详情 + 最新消息页
//    （读取真人会话），卸载注销；绝不读收件箱记忆填上下文。
//   · 消息只按服务端时间序渲染：user_text 以 senderRole === 当前角色 定左右气泡；
//     conversation_started 是固定中性系统行，不计未读、不做 read target。
//   · read-through：只有真实渲染到的最新 decimal user_text ID 可提交
//    （提交真人已读 内部按 string 去重，绝不转 number）。
//   · 发送不乐观追加：POST 成功或对账确认后清草稿；unknown 分支显示
//     「重新确认发送结果 /（可放弃时）放弃本次发送」—— 放弃只清不可变待定正文
//     对应的意图键，保留当前编辑中的草稿；in_progress 只允许稍后同键重试。
//   · 上下文动作遵守后端事实边界：候选端「看职位」只在 context available 且
//     job_ref 在场时进入既有权威岗位详情路由（不猜岗位）；招聘端「看在线简历」
//     （Task 4，Spec §4）打开同 Case candidate_identity + candidate_resume 的纯展示
//     纸身（组件/真人在线简历正文），本入口零 PDF lease 请求，也不以 resume_ref
//     缺失判定结构化资料不可读；加载/失败/重试在本页管理（重试走 P5 定向重读）；
//     context 不可用只降级展示并保留「重新加载会话信息」，消息仍可读写。
//     Backend 不渲染电话/微信 —— P7 context 不提供这些字段，绝不显示 Mock 值。

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import 共用样式 from '../直聊会话.module.css';
import 真人会话样式 from '../真人会话.module.css';
import 真人会话操作栏 from '../真人会话操作栏';
import { 聊天正文, 聊天气泡 } from '../../组件/聊天气泡';
import { 匹配分析块 } from '../../组件/匹配分析块';
import { 职位资料 } from '../../组件/在谈详情/职位资料';
import { 真人在线简历正文 } from '../../组件/真人在线简历正文';
import type { 详情按钮 } from '../../组件/在谈详情/类型';
import 举报层 from '../../组件/举报层';
import { 次级页外壳, 返回栏, 滚动区, 真输入条 } from '../../组件/通用';
import { 公文包图标, 简历图标 } from '../../组件/图标';
import { 轻提示 } from '../../组件/轻提示';
import { use导航 } from '../../路由/导航钩子';
import { 路径 } from '../../路由/路径表';
import { use应用状态 } from '../../状态/应用状态';
import { P7范围键, 取P7错误文案 } from '../../状态/后端/真人会话操作';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import { use真人会话资料 } from './use真人会话资料';
import { 取姓名首字, 非空 } from '../消息列表展示/会话资料映射';
import type { P5详情 } from '../../数据/招聘数据源/MatchCase';
import type { P7角色, P7消息 } from '../../数据/招聘数据源/真人会话';
import type { P7发送结果, P7分页快照, P7详情快照 } from '../../状态/后端/类型';
import type { BFF招聘方档案 } from '../../数据/BFF契约';

/** conversation_started 的固定中性系统行文案（spec §5.3，不伪造用户或未读）。 */
const 系统行文案 = '双方已确认意向，现在可以直接沟通';
/** 快照缺席时的稳定空列表引用（useMemo 依赖 items 引用稳定，绝不原地修改快照）。 */
const 空消息列表: P7消息[] = [];
const 读入中文案 = '正在读入会话…';
const 超长提示 = '消息太长，请缩短后再发送';
/** 发送正文 trim 后的 Unicode code point 上限（与操作/数据源同一规则）。 */
const 正文码点上限 = 2000;

/** 资料层内的加载/不可用提示行（Spec §11.3：不可用态给定向重试，不假装可用）。 */
function 资料提示行({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        padding: '48px 24px', color: 'var(--弱化)', fontSize: 13, textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
}

/** 层内定向重试键（与页面既有重试键同族样式）。 */
const 重试键样式: CSSProperties = {
  padding: '7px 16px', borderRadius: 999, border: '1px solid var(--描边)',
  background: 'var(--浅灰底)', color: 'var(--正文)', fontSize: 12.5,
};

/** 招聘方档案头像的展示地址：avatar_url 拼当前 revision 作缓存戳（与候选账号头像
 *  commit 时的 ?v= 同一机制）—— 替换头像后 revision 前进 → URL 变化 → 重新加载，
 *  不命中旧图缓存；缺 URL 恒 null（回退首字字标，不造图）。 */
function 招聘档案头像地址(档案: BFF招聘方档案 | null): string | null {
  if (档案 === null) return null;
  const 地址 = 非空(档案.avatar_url);
  return 地址 === null ? null : `${地址}?v=${档案.revision}`;
}

/** 年月展示：'YYYY-MM' → 'YYYY.MM'；空段按位置给占位（起 — / 止 至今）。 */
function 显示年月(值: string | null, 空文: string): string {
  return 值 === null ? 空文 : 值.replace('-', '.');
}

/** 起止展示串；两端全缺为 null（不渲染日期槽，不编造「至今」）。 */
function 组起止(起: string | null, 止: string | null): string | null {
  if (起 === null && 止 === null) return null;
  return `${显示年月(起, '—')} — ${显示年月(止, '至今')}`;
}

/** 纯映射（Task 4，Spec §4）：同 Case 冻结 candidate_resume + candidate_identity →
 *  在线简历纸身。只消费既有 wire 字段，不新增/不重算；candidate_resume = null（无
 *  冻结简历或授权拒绝）按各区段「暂未提供」打开纸身，绝不以附件坐标缺失判定不可读；
 *  联系方式不进纸身（组件恒「—」）；姓名 = disclosed 真名，否则回落 Case 代号
 *  （与页头同一授权展示口径），不拿代号冒充真名。 */
function 映射招聘在线简历(明细: Extract<P5详情, { role: 'recruiter' }>) {
  const 简历 = 明细.candidateResume;
  const 身份 = 明细.candidateIdentity;
  return {
    姓名: (身份.state === 'disclosed' ? 非空(身份.name) : null)
      ?? 非空(明细.context.candidateAlias)
      ?? '候选人',
    最近职位: 非空(简历?.summary?.latest_experience?.title ?? null)
      ?? 非空(简历?.experiences?.[0]?.title ?? null),
    经验年限: 简历?.summary?.experience_years != null
      ? `${简历.summary.experience_years} 年经验`
      : null,
    工作经历: 简历?.experiences == null ? null : 简历.experiences.map((段) => ({
      公司: 段.company,
      职位: 段.title,
      起止: 组起止(段.start_month, 段.end_month),
      描述: 段.description,
    })),
    教育经历: 简历?.educations == null ? null : 简历.educations.map((条) => ({
      学校: 条.institution,
      学历专业: [条.degree, 条.major]
        .filter((段): 段 is string => 段 !== null && 段.trim() !== '')
        .join(' · ') || null,
      起止: 组起止(条.start_month, 条.end_month),
    })),
    个人优势: 简历?.self_description ?? null,
  };
}

/** Backend 访问无参 Mock 路由时的 fail-closed 视图：不读默认 J-01/A-01。 */
export function 会话不可用() {
  const { 返回 } = use导航();
  return (
    <次级页外壳 白底>
      <返回栏 返回={返回} 标题="会话不可用" 居中标题 />
      <滚动区>
        <div style={{ padding: 24, color: 'var(--弱化)', fontSize: 13 }}>
          这段会话不存在或已不可访问。
        </div>
      </滚动区>
    </次级页外壳>
  );
}

export default function Backend真人会话({ 角色: role, conversationId }: { 角色: P7角色; conversationId: string }) {
  const { 返回, 跳转 } = use导航();
  const { 后端状态, 操作, 状态 } = use应用状态();
  // 我方头像（Spec §3）：只复用当前登录身份已有资料 —— 候选 = 账号头像（commit 时已带
  // ?v=revision 缓存戳；mount 水合与入口无关，直达会话同样可用），招聘 = 档案 avatar_url
  // 按当前 revision 组同样的缓存戳（替换头像后 revision 前进 → URL 变化 → 重新加载）。
  // 图片缺失/加载失败回退本人真实姓名首字（取姓名首字：trim 后首个 Unicode 码点，缺名
  // 「·」）—— 绝不用对方名字、占位文案或 Mock 演示人像（Spec §11.2 + §3）。
  const 招聘档案: BFF招聘方档案 | null = 状态?.招聘方档案 ?? null;
  const 我方头像URL = role === 'candidate'
    ? 状态?.求职头像 ?? null
    : 招聘档案头像地址(招聘档案);
  const 我首字 = 取姓名首字(
    (role === 'candidate' ? 状态?.基本信息?.真名 : 招聘档案?.public_name) ?? null,
  );
  const 详情键 = P7范围键.详情(role, conversationId);
  const 消息键 = P7范围键.消息(role, conversationId);
  const 详情快照: P7详情快照 | undefined = 后端状态.P7会话详情[详情键];
  const 消息快照: P7分页快照<P7消息> | undefined = 后端状态.P7消息页[消息键];
  const 详情 = 详情快照?.detail ?? null;
  const messages = 消息快照?.items ?? 空消息列表;

  // 进屏 / 换会话：先注册可见会话再并行读详情 + 最新消息页；离开本屏注销。
  useEffect(() => {
    操作.设置P7会话范围(role, conversationId);
    void 操作.读取真人会话(role, conversationId).catch(() => undefined);
    return () => 操作.设置P7会话范围(role, null);
  }, [role, conversationId, 操作]);

  // read-through：只认当前实际渲染的最后一个 user_text ID（system 行永不提交；
  // 操作层按上次成功 / 在飞 / 终局拒绝去重，重复渲染零请求）。
  const 最新文本ID = useMemo(() => {
    for (let 下标 = messages.length - 1; 下标 >= 0; 下标 -= 1) {
      const 行 = messages[下标];
      if (行.kind === 'user_text') return 行.messageId;
    }
    return null;
  }, [messages]);
  useEffect(() => {
    if (最新文本ID === null) return;
    void 操作.提交真人已读(role, conversationId, 最新文本ID).catch(() => undefined);
  }, [role, conversationId, 最新文本ID, 操作]);

  // 草稿与发送：发送前 trim；超长按 code point 拦截。POST 成功或对账确认后清草稿；
  // 结果未知保留不可变待定正文进提示区（草稿已清空，可继续编辑新内容）。
  const [草稿, 设草稿] = useState('');
  const [未知结果, 设未知结果] = useState<P7发送结果 | null>(null);
  // P8：右上「⋯」拉起的举报层（target 恒为该会话的路由坐标，不是展示名）
  const [举报层开, 设举报层开] = useState(false);
  // review-r2 R2-2 / review-r3：发送 scope 代际 —— 换会话/卸载作废在飞结算与在飞锁
  //（-1 = 空闲，≥0 = 该代际有在飞发送）。用 useLayoutEffect：代际推进发生在提交阶段
  //（先于绘制与任何后续微任务），换会话首帧绝不带旧会话的草稿/未知横幅，该窗口内
  // 落定的迟到结算也过不了旧代际检查；旧会话的结果/草稿绝不进新会话。
  const 发送代际 = useRef(0);
  const 发送在飞 = useRef(-1);
  useLayoutEffect(() => {
    设未知结果(null); // 换会话：旧会话的结果未知提示不进新会话（同步重渲染，先于绘制）
    设草稿(''); // 草稿按会话隔离：旧会话的在编草稿不带入新会话
    return () => {
      发送代际.current += 1;
    };
  }, [conversationId, role]);

  const 发送 = (内容参数?: string) => {
    const 原文 = 内容参数 ?? 草稿;
    const 内容 = 原文.trim();
    if (内容 === '' || 发送在飞.current === 发送代际.current) return;
    if (Array.from(内容).length > 正文码点上限) {
      轻提示(超长提示);
      return;
    }
    const 起始代际 = 发送代际.current;
    发送在飞.current = 起始代际;
    // review-r2 R2-3：只有发送草稿本身才清草稿；重试不可变待定正文不动在编草稿。
    if (内容参数 === undefined) 设草稿('');
    操作.发送真人消息(role, conversationId, 内容)
      .then((结果) => {
        if (发送代际.current !== 起始代际) return; // 迟到：会话已换/已卸载
        if (结果.status === 'confirmed') {
          设未知结果(null);
        } else {
          设未知结果(结果);
        }
      })
      .catch((错误) => {
        if (发送代际.current !== 起始代际) return; // 迟到：不提示、不回填
        轻提示(取P7错误文案(错误));
        // review-r1 F6：明确拒绝的消息没发出去 —— 恢复失败正文，不让草稿凭空丢失；
        // 用户若已在途中编辑新草稿则原样保留，绝不覆盖。confirmed/unknown 不走这里
        //（unknown 的不可变正文由提示区携带）。
        设草稿((现) => (现 === '' ? 内容 : 现));
      })
      .finally(() => {
        if (发送代际.current === 起始代际) 发送在飞.current = -1; // 只有属主代际释放锁
      });
  };

  /** 结果未知的同键重试：按不可变待定正文重发（不是当前编辑中的草稿）。 */
  const 重新确认 = () => {
    if (未知结果 === null || 未知结果.status !== 'unknown') return;
    const 待定正文 = 未知结果.pendingContent;
    设未知结果(null);
    发送(待定正文);
  };

  /** 显式放弃：只清该待定正文的意图键；当前编辑中的草稿原样保留。 */
  const 放弃 = () => {
    if (未知结果 === null || 未知结果.status !== 'unknown') return;
    操作.放弃真人消息意图(role, conversationId, 未知结果.pendingContent);
    设未知结果(null);
  };

  // review-r3：换会话/换角色时同步收掉旧会话的举报层（与提交同步，先于绘制）。
  // Task 4：简历纸身没有在飞取件与租约 —— 层的开/关与「失权/换会话关闭旧层」
  // 全部由操作栏的授权 key（role:会话:主项可用）重挂承担，本页不再持有 PDF 会话。
  useLayoutEffect(() => {
    设举报层开(false); // 旧会话的举报层同样不跨会话存活
  }, [conversationId, role]);

  // 页头与资料（Spec §11.2）：按已授权 caseId 读同一 Case —— 招聘看 candidateIdentity，
  // 候选看 jobDetail 发布人档案 + 发布方公司；补读失败只降级资料，不阻断消息。
  const 会话资料 = use真人会话资料(role, 详情);
  const 标题 = 会话资料.标题;
  const 副标题 = 会话资料.副标题;

  // 上下文在场（§8.3 口径）：资料操作的可执行前提；缺坐标 → 主项占位禁用。
  const 上下文在场 = 详情 !== null && 详情.contextStatus === 'available' && 详情.context !== null;
  // Task 4（Spec §4）：招聘端「看在线简历」来自同 Case 冻结 candidate_resume ——
  // 只要求授权在场，不再以 resume_ref（附件坐标）为打开前提；授权失权（context 变
  // unavailable）时操作栏按 key 重挂关层，旧纸身不跨授权残留。
  const 招聘可看简历 = role === 'recruiter' && 上下文在场;
  const 主项可用 = role === 'candidate' ? 上下文在场 : 招聘可看简历;

  // 招聘纸身数据：同一份 P5 详情快照（use真人会话资料 的授权读取门槛同样约束它 ——
  // 资料状态 available 才消费，见主项层正文）。纯映射，无请求、无缓存。
  const 招聘纸身 = (() => {
    if (role !== 'recruiter' || !上下文在场 || 详情 === null) return null;
    const 快照 = 后端状态.P5详情[P5范围键.detail('recruiter', 详情.caseId)];
    const 明细 = 快照 !== undefined ? 快照.detail : null;
    return 明细 !== null && 明细.role === 'recruiter' ? 映射招聘在线简历(明细) : null;
  })();

  // 主项全屏层正文（Spec §11.3）：候选 = Case 冻结职位资料（复用在谈详情同一组件，
  // 公司导航沿用可信组织坐标门控）；招聘 = 同 Case 在线简历纸身（Task 4：加载/失败/
  // 重试在消费页面管理，重试走 use真人会话资料 的 P5 定向重读）。
  const 公司入口 = (编号: string | null | undefined): 详情按钮 =>
    编号 != null && 编号 !== ''
      ? { 键: '公司详情', 文案: '公司详情', 外观: '次要', 禁用说明: null, 执行: () => 跳转(路径.企业详情(编号)) }
      : { 键: '公司详情', 文案: '公司详情', 外观: '次要', 禁用说明: '公司详情暂不可用', 执行: null };
  const 主项层正文 = role === 'candidate' ? (
    会话资料.资料状态 === 'available' && 会话资料.职位资料 !== null ? (
      // Task 6（Spec §3.4）：聊天「看职位」沿用 Case 职位资料版式；层内没有顶栏分，
      // 分析藏环=false 让 匹配分析块 画该层唯一总分环。
      <职位资料
        信息={会话资料.职位资料}
        公司详情={公司入口(会话资料.职位资料.公司.编号)}
        分析藏环={false}
      />
    ) : 会话资料.资料状态 === 'loading' ? (
      <资料提示行>正在读取职位资料…</资料提示行>
    ) : (
      <资料提示行>
        职位资料暂不可用
        <button
          className="可点"
          style={重试键样式}
          onClick={会话资料.重读资料}
        >
          重试
        </button>
      </资料提示行>
    )
  ) : 会话资料.资料状态 === 'available' && 招聘纸身 !== null ? (
    // Task 6（Spec §3.5）：完整纸身之后接同 Case 的独立分析区 —— 单独白色区块与纸身
    // 留出间距，块内标题 + 唯一总分环 + 六维行（会话资料.在线简历分析 与纸身同一 gated
    // 明细）；分析不进 个人优势/工作经历/PDF 正文。失权/换会话时层整体重挂，旧分析
    // 不残留。
    <>
      <真人在线简历正文 {...招聘纸身} />
      {会话资料.在线简历分析 !== null ? (
        <section className={真人会话样式.纸下分析区}>
          <匹配分析块 模型={会话资料.在线简历分析} />
        </section>
      ) : null}
    </>
  ) : 会话资料.资料状态 === 'unavailable' ? (
    <资料提示行>
      在线简历暂不可用
      <button
        className="可点"
        style={重试键样式}
        onClick={会话资料.重读资料}
      >
        重试
      </button>
    </资料提示行>
  ) : (
    <资料提示行>正在读取在线简历…</资料提示行>
  );

  const 详情失败 = 详情快照 !== undefined && 详情快照.阶段 === '失败' && 详情快照.detail === null;

  return (
    <次级页外壳 对话底 白底>
      <返回栏
        返回={返回}
        标题={标题}
        副标题={副标题}
        居中标题
        右侧={
          // P8：仍是那枚视觉 ⋯（span + 原类，不换成会改字体/边框/底色的原生按钮），
          // 补键盘可达（role=button + tabIndex + Enter/Space）打开会话举报层
          <span
            className={共用样式.更多}
            role="button"
            tabIndex={0}
            aria-label="举报"
            onClick={() => 设举报层开(true)}
            onKeyDown={(事件) => {
              if (事件.key === 'Enter' || 事件.key === ' ') {
                事件.preventDefault();
                设举报层开(true);
              }
            }}
          >
            ⋯
          </span>
        }
      />

      {/* 操作栏（Spec §11.3）：恢复 Mock 同款三项排列 —— 主项盖全屏层（候选 = Case
          冻结职位资料、招聘 = 同 Case 在线简历纸身），电话/微信诚实缺失占位（§11.4）。
          缺授权坐标时主项占位禁用；key 随会话/角色/授权态重挂：换会话、换角色或
          授权失权都会关闭层并复位展开，不把旧会话的层与纸身带进新状态。 */}
      {详情 !== null ? (
        <真人会话操作栏
          key={`${role}:${conversationId}:${主项可用 ? 'on' : 'off'}`}
          主项名={role === 'candidate' ? '看职位' : '看在线简历'}
          主项图标={
            role === 'candidate'
              ? <公文包图标 尺寸={18} 色="#3f7a1f" />
              : <简历图标 尺寸={18} 色="#3f7a1f" />
          }
          主项内容={主项层正文}
          主项禁用={!主项可用}
          联系方式占位
        />
      ) : null}
      {详情 !== null && !上下文在场 ? (
        <div style={{ padding: '10px 16px 0' }}>
          <button
            className="可点"
            style={{ padding: '7px 15px', borderRadius: 999, border: '1px solid var(--描边)', background: 'var(--浅灰底)', color: 'var(--正文)', fontSize: 12.5 }}
            onClick={() => void 操作.读取真人会话(role, conversationId, true).catch(() => undefined)}
          >
            重新加载会话信息
          </button>
        </div>
      ) : null}

      <滚动区>
        <div className={`${共用样式.消息流} ${共用样式.消息流上留白}`}>
          {/* 详情整页失败（404 等）：不显示上一次会话残留，只给重试 */}
          {详情失败 ? (
            <div className={共用样式.居中行}>
              <div style={{ padding: 16, color: 'var(--弱化)', fontSize: 13, textAlign: 'center' }}>
                {详情快照?.error}
                <br />
                <button
                  className="可点"
                  style={{ marginTop: 8, padding: '6px 14px', borderRadius: 999, border: '1px solid var(--描边)', background: 'var(--浅灰底)' }}
                  onClick={() => void 操作.读取真人会话(role, conversationId, true).catch(() => undefined)}
                >
                  重试
                </button>
              </div>
            </div>
          ) : null}

          {/* 消息刷新失败但保留旧成功内容：错误行交代 + 重试 */}
          {消息快照?.error && !消息快照.刷新中 ? (
            <div className={共用样式.居中行}>
              <div style={{ padding: '8px 16px', color: 'var(--弱化)', fontSize: 12 }}>
                {消息快照.error}
                <button
                  className="可点"
                  style={{ marginLeft: 8, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--描边)' }}
                  onClick={() => void 操作.读取真人会话(role, conversationId, true).catch(() => undefined)}
                >
                  重试
                </button>
              </div>
            </div>
          ) : null}

          {/* 更早消息分页入口：更早页 prepend 后视口保持由下方锚定 effect 兜底 */}
          {消息快照?.nextCursor != null ? (
            <div className={共用样式.居中行}>
              <button
                className="可点"
                style={{ padding: '5px 14px', borderRadius: 999, border: '1px solid var(--描边)', background: 'var(--浅灰底)', color: 'var(--正文)', fontSize: 12 }}
                onClick={() => void 操作.追加更早消息(role, conversationId).catch(() => undefined)}
              >
                加载更早
              </button>
            </div>
          ) : null}

          {消息快照 === undefined || (消息快照.阶段 !== '成功' && messages.length === 0 && 消息快照.error === null) ? (
            <div className={共用样式.居中行}>
              <span style={{ padding: 16, color: 'var(--弱化)', fontSize: 13 }}>{读入中文案}</span>
            </div>
          ) : null}

          {messages.map((行) => (
            <消息行
              key={行.messageId}
              行={行}
              role={role}
              对方头像URL={会话资料.对方头像URL}
              对方首字={会话资料.对方首字}
              我方头像URL={我方头像URL}
              我首字={我首字}
            />
          ))}

          {/* 结果未知提示区：重新确认按不可变待定正文同键重试；可放弃时才有放弃 */}
          {未知结果 !== null && 未知结果.status === 'unknown' ? (
            <div
              data-testid="unknown-result"
              style={{
                margin: '10px 16px', padding: '10px 12px', borderRadius: 12,
                background: 'var(--浅灰底)', display: 'flex', flexWrap: 'wrap',
                alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--正文)',
              }}
            >
              <span>
                {未知结果.reason === 'in_progress'
                  ? '消息仍在处理中，请稍后重试'
                  : '暂时无法确认是否发送成功'}
              </span>
              <button
                className="可点"
                style={{ padding: '5px 12px', borderRadius: 999, border: '1px solid var(--描边深)', background: '#fff' }}
                onClick={重新确认}
              >
                重新确认发送结果
              </button>
              {未知结果.canAbandon ? (
                <button
                  className="可点"
                  style={{ padding: '5px 12px', borderRadius: 999, border: '1px solid var(--描边)', background: 'transparent', color: 'var(--弱化)' }}
                  onClick={放弃}
                >
                  放弃本次发送
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </滚动区>

      <真输入条
        占位="输入消息"
        值={草稿}
        改变={设草稿}
        发送={() => 发送()}
        右侧图标={<span className={真人会话样式.代理符}>◈</span>}
      />

      {/* P8 会话举报层：target 是该会话的权威路由坐标；确认回执后强制重读该会话，
          目标失效（会话已不存在）同样强制重读 —— 详情快照会给出权威的不可用态 */}
      {举报层开 ? (
        <举报层
          对象名={标题}
          屏蔽名称={副标题}
          target={{ type: 'conversation', ref: conversationId }}
          已确认={() => 操作.读取真人会话(role, conversationId, true)}
          目标失效={() => 操作.读取真人会话(role, conversationId, true)}
          关闭={() => 设举报层开(false)}
        />
      ) : null}
    </次级页外壳>
  );
}

/** 单条消息行（Spec §11.5）：user_text 按 senderRole 对齐（本端右 / 对端左，
 *  data-侧 供回归断言），共用 聊天气泡（短气泡贴合内容、长文不撑破）+ 安全
 *  markdown 聊天正文；时间取该条 createdAt 本地时区格式化，两条消息各用各的时间。
 *  conversation_started 渲染固定中性系统胶囊。头像（Spec §3）：双方 32px 同一套
 *  真人头像类 —— 有授权图先渲染图（有图无名仍图），缺失/加载失败回退各自真实姓名
 *  首字；我方只复用当前登录身份已有资料，绝不从 Mock 姓名取首字。 */
function 消息行({
  行,
  role,
  对方头像URL,
  对方首字,
  我方头像URL,
  我首字,
}: {
  行: P7消息;
  role: P7角色;
  对方头像URL: string | null;
  对方首字: string;
  我方头像URL: string | null;
  我首字: string;
}) {
  if (行.kind === 'conversation_started') {
    return (
      <div className={共用样式.居中行}>
        <span className={共用样式.系统胶囊}>{系统行文案}</span>
      </div>
    );
  }
  const 我方 = 行.senderRole === role;
  return (
    <div data-侧={我方 ? '右' : '左'}>
      <聊天气泡
        方={我方 ? '我方' : '对方'}
        时间={行.createdAt}
        类名={我方 ? 真人会话样式.我方消息行 : 真人会话样式.对方消息行}
        气泡类名={真人会话样式.对侧留白}
        头像={
          我方 ? (
            <消息头像 key={我方头像URL ?? '我方'} URL={我方头像URL} 首字={我首字} 类名={共用样式.我头像} />
          ) : (
            <消息头像 key={对方头像URL ?? '对方'} URL={对方头像URL} 首字={对方首字} 类名={共用样式.对方头像} />
          )
        }
      >
        <聊天正文 内容={行.content} 格式="markdown" 类名={共用样式.气泡文字} />
      </聊天气泡>
    </div>
  );
}

/** 32px 会话消息头像（Spec §3）：URL 在场先渲染授权图（objectFit cover、继承圆形），
 *  加载失败回退真实姓名首字字标。调用方以 URL 为 key 挂载 —— 换图/删图/换账号/
 *  换会话即整点重挂：失败状态与旧图不跨身份残留，新 URL 必然重新尝试加载。 */
function 消息头像({ URL, 首字, 类名 }: { URL: string | null; 首字: string; 类名: string }) {
  const [加载失败, 设加载失败] = useState(false);
  if (URL === null || 加载失败) {
    return <span className={类名}>{首字}</span>;
  }
  return (
    <span className={类名}>
      <img
        src={URL}
        alt=""
        onError={() => 设加载失败(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
      />
    </span>
  );
}
