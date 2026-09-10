// D11·A 匿名在线简历 —— 独立屏，人才页点推荐卡进入。版式按 mockup 一比一：
//
// 居中标题「匿名在线简历」+ 星标/… → 头区（与列表卡同一套头行：性别图标 + 年限｜学历｜状态
// + 职位行；原 大代号 + 匿名标签 + 灰人像占位 已于 2026-09-09 第二批去名删除）→
// 「AI代理读完简历后的判断」淡绿卡（右上适配分 + 判断正文 + 内嵌白色风险条）→
// 自述段 → ● 求职期望（标题加粗 + 带宽行 + 一致性淡绿条）→ ● 工作经历 →
// 底部双按钮：直接聊（白描边）+ 让AI代理去谈（荧光绿）+ 尾注小字。
//
// 详情统一（Task 4）：简历正文 JSX 收进 组件/在谈详情/在线简历正文（唯一出处），
// 本屏的 简历正文 导出退化为兼容包装；旧默认（不传 完整布局）不变。
//
// 薪资只用于结构化初筛：企业侧只看「有无交集」，不展示候选期望数字，也不让 Agent 谈薪。
//
// P4 模式边界：Backend 路由只吃 P4 权威详情 —— 每次进屏都强制重读这条推荐
// （注册 招聘详情 可见范围 → force GET，离开即清），只渲染映射后的匿名 allowlist
// 画像：别名 / 匹配分 / 经验 / 求职状态 / 小结 / 技能 / 教育 / 薪资关系。
// 年龄、性别、工作经历段、候选薪资数字、直聊许可与 Mock 简历兜底一概不出现；
// 收藏与委托走 P4 操作，成功后原地停留，进行中回执交给轮询钩子；委托状态槽只认
// 映射P4委托展示 的闭合六态 —— 已开案且回执带非空服务端 case_id 才给「查看进展」
// （招聘侧跳 路径.候选详情(case_id)）。Mock 分支原样保留。

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import 样式 from './匿名在线简历.module.css';
import { 在线简历正文 } from '../组件/在谈详情/在线简历正文';
import type { 在线简历正文属性 } from '../组件/在谈详情/类型';
import { 招聘侧对齐行 } from '../数据/匹配对齐';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import 候选头行 from '../组件/候选头行';
import { 求职状态文案 } from './候选推荐';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { use应用状态 } from '../状态/应用状态';
import { 匿名简历表, 推荐列表 } from '../数据/企业端模拟数据';
import { 薪资初筛, 薪资初筛文案 } from '../数据/薪资初筛';
import { 从P4招聘候选, P4已开案, 映射P4委托展示 } from '../数据/发现推荐映射';
import { 轻提示 } from '../组件/轻提示';
import { P4错误文案, P4范围键 } from '../状态/后端/发现推荐操作';
import { P4委托进度未知文案, use发现推荐委托轮询 } from '../状态/后端/use发现推荐委托轮询';

// (原 带粗体 助手随「AI代理读完简历后的判断」散文卡一起退役,2026-08-26)

/**
 * D11·A 简历正文（头区 → 技能 → 页尾注）—— 兼容包装（详情统一 Task 4）。
 * 正文 JSX 已收进 组件/在谈详情/在线简历正文（唯一出处，招聘端详情第二 Tab 与独立屏
 * 共用同一份）；这里只保留旧导出名，独立屏与既有测试不必改调用方式，本包装不放
 * 第二份正文。默认（不传 完整布局）走旧版式 —— 空项目整区不出、无缺失占位。
 */
export function 简历正文(props: 在线简历正文属性) {
  return <在线简历正文 {...props} />;
}

export default function 匿名在线简历() {
  const { 数据源模式 } = use应用状态();
  return 数据源模式 === 'backend' ? <Backend路由分流 /> : <Mock匿名简历 />;
}

/**
 * J（Task 8）：Backend 路由分流 —— canonical 双坐标在 URL，缺失（旧 /hr/resume/:id
 * 深链）时直接渲染失效页，不挂载 Backend匿名简历（effect、scope 与 action 均零调用）。
 */
function Backend路由分流() {
  const { 返回 } = use导航();
  const { jobId, recommendationId } = useParams<{ jobId?: string; recommendationId?: string }>();
  if (!jobId || !recommendationId) {
    return (
      <次级页外壳>
        <返回栏 返回={返回} />
        <滚动区>
          <div className={样式.缺档}>
            <div>链接已失效，请从对应岗位推荐列表重新打开</div>
          </div>
        </滚动区>
      </次级页外壳>
    );
  }
  return <Backend匿名简历 key={`${jobId}:${recommendationId}`} 岗位编号={jobId} 推荐编号={recommendationId} />;
}

/** Mock 原型分支：静态简历表 + 全局归约，行为与接线前逐字一致。 */
function Mock匿名简历() {
  const { id: 编号 = '' } = useParams<{ id: string }>();
  const { 返回, 替换跳转 } = use导航();
  const { 状态, 派发 } = use应用状态();
  const [提示, 设提示] = useState<string | null>(null);

  useEffect(() => {
    if (!提示) return;
    const 定时 = window.setTimeout(() => 设提示(null), 1700);
    return () => window.clearTimeout(定时);
  }, [提示]);

  // 起步推荐克隆（编号带 @岗位编号 后缀）回落到模板人的简历档
  const 档 = 匿名简历表[编号] ?? 匿名简历表[编号.split('@')[0]];
  const 推 = 推荐列表.find((条) => 条.编号 === 编号);
  const 在谈候选 = 状态.企业候选列表.find((条) => 条.编号 === 编号);
  const 岗位编号 = 推?.岗位编号 ?? 在谈候选?.岗位编号;
  const 岗位薪资带 = 状态.岗位列表.find((岗) => 岗.编号 === 岗位编号)?.薪资带;
  const 薪资结论 = 薪资初筛文案(薪资初筛(档?.期望.薪资, 岗位薪资带));
  const 已接触 = 状态.已接触推荐.includes(编号);
  const 已收藏 = 状态.收藏候选.includes(编号);

  if (!档) {
    return (
      <次级页外壳>
        <返回栏 返回={返回} />
        <div className={样式.缺档}>这位候选的简历还没同步过来。</div>
      </次级页外壳>
    );
  }

  return (
    <次级页外壳>
      <返回栏
        返回={返回}
        右侧={
          <span className={样式.栏右组}>
            {/* 匹配分：判断头里的分随方案丁删掉后，这一屏唯一的分数显示位。
                与 候选详情 返回栏同款（企业侧不显示薪资，薪资只属于岗位的带） */}
            <span className={样式.栏匹配组}>
              <span className={样式.栏匹配标}>匹配</span>
              <span className={`${样式.栏匹配分} 等宽数字`}>{档.适配分}</span>
            </span>
            {/* ★ 收藏：与推荐卡上的星同一份状态，两处点哪个都一样 */}
            <button
              className={`${样式.栏键} ${已收藏 ? 样式.栏键已收藏 : ''} 可点`}
              onClick={() => {
                派发({ 型: '切收藏候选', 编号 });
                // 「可在筛选里『只看收藏』」这半句随 候选筛选抽屉 在 2026-09-09 删除：入口没了，不再承诺
                设提示(已收藏 ? '已取消收藏' : '已收藏');
              }}
              aria-label={已收藏 ? '取消收藏' : '收藏'}
              aria-pressed={已收藏}
            >
              {已收藏 ? '★' : '☆'}
            </button>
            <button
              className={`${样式.栏键} 可点`}
              onClick={() => 设提示('更多操作待接后端')}
              aria-label="更多"
            >
              …
            </button>
          </span>
        }
      />

      <滚动区 样式覆盖={{ paddingBottom: 8 }}>
        <简历正文
          档={档}
          薪资结论={薪资结论}
          对齐行们={招聘侧对齐行(状态.岗位列表.find((岗) => 岗.编号 === 岗位编号)?.硬性条件 ?? [], 档)}
          // 头行求职状态：在谈单取 在找 后半段；推荐候选按推荐卡同一口径中文化（2026-09-09）
          求职状态={在谈候选?.在找?.split(' · ')[1] ?? (推 ? 求职状态文案(推.求职状态) : null)}
        />
      </滚动区>

      {/* ── 底部双按钮 + 尾注 ── */}
      <div className={样式.底栏}>
        <div className={样式.键行}>
          <button
            className={`${样式.直聊键} ${档.允许直聊 ? '' : 样式.直聊禁} 可点`}
            onClick={() =>
              档.允许直聊
                ? 设提示('直聊会互相看到身份 · 原型暂未接直聊会话')
                : 设提示('对方未开放直接联系，请让AI代理去谈')
            }
          >
            <span className={样式.直聊图} aria-hidden>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="5" r="3" stroke="currentColor" strokeWidth="1.4"/><path d="M2 13.5c1.1-2.8 3.1-4.2 5.5-4.2s4.4 1.4 5.5 4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </span>
            直接聊
          </button>
          {已接触 ? (
            <span className={样式.已谈条}>AI代理已接手</span>
          ) : (
            <button
              className={`${样式.去谈键} 可点`}
              onClick={() => {
                if (推) 派发({ 型: '接触推荐候选', 编号: 推.编号 });
                // reducer 已把这位候选写进在谈列表并切子视图，回人才页直接看到
                替换跳转(路径.企业主壳);
              }}
            >
              <span className={样式.去谈图} aria-hidden>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M13 7.5c0 2.9-2.5 5.2-5.5 5.2-.8 0-1.6-.2-2.3-.5L2 13l.9-2.8A5 5 0 0 1 2 7.5C2 4.6 4.5 2.3 7.5 2.3S13 4.6 13 7.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
              </span>
              让AI代理去谈
            </button>
          )}
        </div>
        <div className={样式.尾注}>
          {档.允许直聊
            ? '对方允许直接联系；直接聊会互相看到身份，AI代理转为旁听'
            : '对方未开放直接联系；由AI代理匿名接触'}
        </div>
      </div>

      {提示 ? <div className={样式.浮层提示}>{提示}</div> : null}
    </次级页外壳>
  );
}

/** Backend 分支（P4）：只吃这条推荐的权威详情，渲染匿名 allowlist 画像。
 *  J（Task 8）：资源坐标只来自 canonical URL props —— effect、重试、收藏、委托与
 *  P4范围键 全部只用 props，状态.当前岗位编号 只服务列表/Mock 原型，不再进入详情坐标。
 *  每次进屏都强制重读（screens always force）：权威卡可能在上一次停留后被收藏/淘汰/
 *  委托过，缓存不可信。404 已由操作层收口成不可用标记（不抛），其余错误给文案与重试。 */
function Backend匿名简历({ 岗位编号, 推荐编号 }: { 岗位编号: string; 推荐编号: string }) {
  const { 后端状态, 操作 } = use应用状态();
  const { 返回 } = use导航();
  // 详情读取的非 404 错误文案（404 走统一不可用页，不进这里）
  const [读取错误, 设读取错误] = useState<string | null>(null);
  // 反馈/委托写进行中：并发写会被操作层单飞丢弃，动作键统一禁用防静默丢点击
  const [反馈中, 设反馈中] = useState(false);

  // 进屏先注册可见范围（操作层栅栏要靠它对上）再强制重读，离开即清，别让别的屏背上旧范围
  useEffect(() => {
    if (!岗位编号 || !推荐编号) return;
    设读取错误(null);
    操作.设置发现推荐范围('recruiter', P4范围键.招聘详情(岗位编号, 推荐编号));
    void 操作.读取招聘候选详情(岗位编号, 推荐编号, true)
      .catch((错误: unknown) => 设读取错误(P4错误文案(错误)));
    return () => 操作.设置发现推荐范围('recruiter', null);
  }, [岗位编号, 推荐编号, 操作]);

  // 权威卡与不可用标记都来自操作层提交的缓存；不可用永远赢过缓存卡（fail closed）：
  // 重读 404 已经删缓存，这里再兜一层，绝不让旧画像带着收藏/委托键继续活着。
  // review-r1：缓存键只有推荐 ID —— 跨岗位坐标下其它岗位的缓存不得顶上，
  // job_id 对不上就当无卡，等权威读取裁决（期间零画像零控件）
  const 不可用 = 推荐编号 !== '' && (后端状态.招聘候选不可用 ?? []).includes(推荐编号);
  const 缓存卡 = 推荐编号 && !不可用 ? 后端状态.招聘候选详情?.[推荐编号] ?? null : null;
  const 卡 = 缓存卡 !== null && 缓存卡.job_id === 岗位编号 ? 缓存卡 : null;
  const 视图 = useMemo(() => (卡 === null ? null : 从P4招聘候选(卡)), [卡]);

  const 重试读取 = () => {
    if (!岗位编号 || !推荐编号) return;
    设读取错误(null);
    void 操作.读取招聘候选详情(岗位编号, 推荐编号, true)
      .catch((错误: unknown) => 设读取错误(P4错误文案(错误)));
  };

  // 收藏：服务端先行，成功后权威快照回改；失败原地提示不翻转
  const 切收藏 = async () => {
    if (反馈中 || !岗位编号 || !推荐编号) return;
    设反馈中(true);
    try {
      await 操作.设置候选收藏(岗位编号, 推荐编号, !(视图?.收藏 ?? false));
    } catch (错误) {
      轻提示(P4错误文案(错误));
    } finally {
      设反馈中(false);
    }
  };

  // 委托：无确认层（招聘侧没有披露确认动作），点了就发起；终态/拒绝回执由操作层抛成
  // 带文案的错误，catch 呈现即可。提交后不导航 —— 原地切成闭合六态的权威状态条。
  const 委托候选 = async () => {
    if (反馈中 || !岗位编号 || !推荐编号) return;
    设反馈中(true);
    try {
      await 操作.委托招聘候选(岗位编号, 推荐编号);
    } catch (错误) {
      轻提示(P4错误文案(错误));
    } finally {
      设反馈中(false);
    }
  };

  // 委托状态只认 映射P4委托展示 的闭合六态投影：摘要 + 权威回执（按 delegation_id 对上）
  const 委托摘要 = 视图?.委托 ?? null;
  const 委托回执 = 委托摘要 === null
    ? null
    : 后端状态.P4委托回执?.[委托摘要.delegation_id] ?? null;
  const 委托展示 = 映射P4委托展示(委托摘要, 委托回执);

  // 本页唯一可见的进行中委托（accepted/evaluating，即 inProgress === true 的那两个状态）
  const 进行中委托 = useMemo(() => (委托展示?.inProgress === true && 委托摘要 !== null
    ? [{
      role: 'recruiter' as const,
      delegationId: 委托摘要.delegation_id,
      // inProgress === true 已闭合出 accepted/evaluating 两员
      state: 委托展示.state === 'accepted' ? ('accepted' as const) : ('evaluating' as const),
    }]
    : []), [委托展示, 委托摘要]);
  // terminal summary 单次权威补读：摘要已 refused/failed 而权威回执表缺这条 ID 时，
  // 钩子立即补读一次拿回拒绝/失败码 —— 页面摘要永远不给原因，回执来了才解释
  const 待恢复终态 = useMemo(() => {
    if (委托摘要 === null || 委托摘要.delegation_id === '') return [];
    if (委托摘要.state !== 'refused' && 委托摘要.state !== 'failed') return [];
    if (委托回执 !== null) return [];
    return [{
      role: 'recruiter' as const,
      delegationId: 委托摘要.delegation_id,
      state: 委托摘要.state,
    }];
  }, [委托摘要, 委托回执]);
  const 进度未知 = use发现推荐委托轮询({
    // Backend路由分流 只在本分支挂载，轮询恒开启
    开启: true,
    委托: 进行中委托,
    待恢复终态,
    刷新: 操作.刷新委托,
    // scope 变化即结束本轮询周期：换岗位/换推荐不带走上一条的连续失败计数（§8.3）
    范围键: P4范围键.招聘详情(岗位编号, 推荐编号),
  });
  // 轮询连败的委托：状态文案覆盖成中性「进度未知」，绝不伪造终态回执
  const 委托进度未知 = 委托展示?.inProgress === true && 委托摘要 !== null
    && 进度未知.has(委托摘要.delegation_id);

  // ── 加载 / 错误 / 安全不可用页：权威卡到手前不给任何 Mock 内容 ──
  if (视图 === null) {
    return (
      <次级页外壳>
        <返回栏 返回={返回} />
        <滚动区>
          <div className={样式.缺档}>
            {不可用
              ? <>
                  <div>这位候选暂时看不了</div>
                  <div>该推荐可能已不可用，或已不在当前岗位的推荐范围内。</div>
                </>
              : 读取错误 !== null
                ? <>
                    <div>候选简历暂时加载不了</div>
                    <div>{读取错误}</div>
                    <button className={`${样式.重试键} 可点`} onClick={重试读取}>
                      重试
                    </button>
                  </>
                : <div>正在加载候选简历…</div>}
          </div>
        </滚动区>
      </次级页外壳>
    );
  }

  const 教育头 = 视图.教育[0] ?? null;
  // 经验 / 学历 已上头行（2026-09-09 第二批），概览条只剩薪资关系，不重复
  const 概览项们 = [视图.薪资关系].filter(Boolean);
  const 已委托 = 委托摘要 !== null;
  // 权威文案 = 闭合六态 copy（refused 附服务端拒绝原因）；轮询连败被中性「进度未知」覆盖，
  // 绝不伪造终态回执
  // 开案成功（case_started + 非空 case_id）用 Mock 已有的成功文案，不再显示
  // 「已创建真实在谈」，也不给 Case 导航（Spec §7.1）
  const 委托文字 = P4已开案(委托展示)
    ? 'AI代理已接手'
    : 委托展示 === null
      ? '让AI代理去谈'
      : 委托进度未知
        ? P4委托进度未知文案
        : `${委托展示.copy}${委托展示.reason === null ? '' : `：${委托展示.reason}`}`;

  return (
    <次级页外壳>
      <返回栏
        返回={返回}
        右侧={
          <span className={样式.栏右组}>
            {/* 匹配分：与 Mock 分支同一落位（企业侧不显示薪资，薪资只属于岗位的带） */}
            <span className={样式.栏匹配组}>
              <span className={样式.栏匹配标}>匹配</span>
              <span className={`${样式.栏匹配分} 等宽数字`}>{视图.匹配分}</span>
            </span>
            {/* ★ 收藏：与推荐卡上的星同一份操作，服务端先行 */}
            <button
              className={`${样式.栏键} ${视图.收藏 ? 样式.栏键已收藏 : ''} 可点`}
              disabled={反馈中}
              onClick={() => void 切收藏()}
              aria-label={视图.收藏 ? '取消收藏' : '收藏'}
              aria-pressed={视图.收藏}
            >
              {视图.收藏 ? '★' : '☆'}
            </button>
          </span>
        }
      />

      <滚动区 样式覆盖={{ paddingBottom: 8 }}>
        <div className={样式.页体}>
          {/* ── 头区：与列表卡同一套头行 —— 经验｜学历｜求职状态（求职状态是映射后的闭合表中文，
              原样透传不猜标签）；BFF 合同没给性别 → 不出图标。
              2026-09-09 产品负责人（第二批）：原 大别名 + 匿名标 + 灰人像占位整体删除，别名不再上屏 ── */}
          <div className={样式.头区}>
            <候选头行 年限={视图.经验} 学历={教育头?.学历} 求职状态={视图.求职状态} />
          </div>

          {/* ── 概览条：薪资关系（经验 / 学历 已上头行）—— 无年龄（双盲不披露出生数据）── */}
          <div className={样式.概览条}>
            {概览项们.map((项, 序) => (
              <span key={项} className={样式.概览项}>
                {序 > 0 ? <span className={样式.概览分}>·</span> : null}
                {项}
              </span>
            ))}
          </div>

          {/* ── 代理小结 ── */}
          {视图.摘要 ? (
            <>
              <div className={样式.节标行}>
                <span className={样式.节标}>个人优势</span>
              </div>
              <p className={样式.自述}>{视图.摘要}</p>
            </>
          ) : null}

          {/* ── 教育经历（wire 教育段；缺员给「未披露」，不编造）── */}
          <div className={样式.节标行}>
            <span className={样式.节标}>教育经历</span>
          </div>
          {视图.教育.length === 0 ? (
            <div className={样式.教育行}>
              <span className={样式.教育文}>未披露</span>
            </div>
          ) : (
            视图.教育.map((段) => (
              <div key={`${段.学校}-${段.起止}`} className={样式.教育行}>
                <span className={样式.教育文}>{`${段.学校} · ${段.专业} · ${段.学历}`}</span>
                <span className={`${样式.经历起止} 等宽数字`}>{段.起止}</span>
              </div>
            ))
          )}

          {/* ── 专业技能 ── */}
          <div className={样式.节标行}>
            <span className={样式.节标}>专业技能</span>
          </div>
          <div className={样式.技能行}>
            {视图.技能.map((技) => (
              <span key={技} className={样式.技能片}>
                {技}
              </span>
            ))}
          </div>

          {/* ── 亮点：推荐亮点行，与推荐卡标签同一批 wire 事实。
              卡顶层 basis 未确认 = 这批亮点没核对过，整组收起、改显中性句，
              绝不按亮点文字做选择性过滤 ── */}
          {视图.匹配依据已确认 ? (
            视图.亮点.length > 0 ? (
              <>
                <div className={样式.节标行}>
                  <span className={样式.节标}>推荐亮点</span>
                </div>
                <div className={样式.技能行}>
                  {视图.亮点.map((亮点) => (
                    <span key={亮点} className={样式.技能片}>
                      {亮点}
                    </span>
                  ))}
                </div>
              </>
            ) : null
          ) : (
            <p className={样式.自述}>经验与学历尚未核对</p>
          )}

          <div className={样式.页尾注}>
            这份简历由候选人的AI代理生成 · 内容真实性经双向核验 · 不可转发
          </div>
        </div>
      </滚动区>

      {/* ── 底部：委托（无直聊：P4 没有直聊许可/会话坐标）+ 尾注 ── */}
      <div className={样式.底栏}>
        <div className={样式.键行}>
          {已委托 ? (
            // 一切委托态（含开案成功）都是不可点的状态条 —— 成功槽不再是「查看进展」，
            // 也不绑定任何 Case 导航（Spec §7.1）
            <span className={样式.已谈条}>{委托文字}</span>
          ) : (
            <button
              className={`${样式.去谈键} 可点`}
              disabled={反馈中}
              onClick={() => void 委托候选()}
            >
              <span className={样式.去谈图} aria-hidden>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M13 7.5c0 2.9-2.5 5.2-5.5 5.2-.8 0-1.6-.2-2.3-.5L2 13l.9-2.8A5 5 0 0 1 2 7.5C2 4.6 4.5 2.3 7.5 2.3S13 4.6 13 7.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
              </span>
              让AI代理去谈
            </button>
          )}
        </div>
        <div className={样式.尾注}>由AI代理匿名接触 · 意向确认前双方保持匿名 · 不可转发</div>
      </div>
    </次级页外壳>
  );
}
