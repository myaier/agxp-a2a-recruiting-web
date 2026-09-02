// D11·A 匿名在线简历 —— 独立屏，人才页点推荐卡进入。版式按 mockup 一比一：
//
// 居中标题「匿名在线简历」+ 星标/… → 大代号 + 匿名标签 + 灰人像占位 →
// 职位行 → 经验/学历/年龄 →
// 「AI代理读完简历后的判断」淡绿卡（右上适配分 + 判断正文 + 内嵌白色风险条）→
// 自述段 → ● 求职期望（标题加粗 + 带宽行 + 一致性淡绿条）→ ● 工作经历 →
// 底部双按钮：直接聊（白描边）+ 让AI代理去谈（荧光绿）+ 尾注小字。
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
import { 匹配对齐卡 } from '../组件/匹配对齐卡';
import { 招聘侧对齐行, type 对齐行 } from '../数据/匹配对齐';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { use应用状态 } from '../状态/应用状态';
import { 匿名简历表, 推荐列表, type 匿名简历档 } from '../数据/企业端模拟数据';
import { 薪资初筛, 薪资初筛文案 } from '../数据/薪资初筛';
import { 从P4招聘候选, 映射P4委托展示 } from '../数据/发现推荐映射';
import { 轻提示 } from '../组件/轻提示';
import { P4错误文案, P4范围键 } from '../状态/后端/发现推荐操作';
import { P4委托进度未知文案, use发现推荐委托轮询 } from '../状态/后端/use发现推荐委托轮询';

// (原 带粗体 助手随「AI代理读完简历后的判断」散文卡一起退役,2026-08-26)

/**
 * D11·A 简历正文（头区 → 技能 → 页尾注），独立屏与候选详情的「在线简历」Tab 共用。
 * 已确认 = 双方意向确认（S3）：在线简历脱敏段（公司实名 / 教育实名行）才还原；S1 原件递交
 * 时真名即向招聘方显示（看简历原件弹层），但在线简历仍是 S0 匿名投影，不随 S1 提前去匿名。
 */
export function 简历正文({
  档,
  真名 = null,
  已确认 = false,
  薪资结论 = '薪资带已进入初筛',
  对齐行们 = null,
}: {
  档: 匿名简历档;
  /** 匹配对齐行(岗位硬性条件 × 简历证据);调用方按所属岗位算好传入,null = 不渲染该区 */
  对齐行们?: 对齐行[] | null;
  /** 候选人真名（S1 原件递交后非空）。非空时按 spec §3.2 显示真名、还原公司实名；为空仍走代号匿名版 */
  真名?: string | null;
  /** 双方意向确认（S3）完成事实，只用于意向确认文案，不兼任身份披露权限（spec §3.2） */
  已确认?: boolean;
  薪资结论?: string;
}) {
  const 已披露 = 真名 !== null && 真名 !== undefined && 真名 !== '';
  return (
    <div className={样式.页体}>
      {/* ── 头区：大代号 + 匿名标签 + 灰人像占位 ── */}
      <div className={样式.头区}>
        <div className={样式.头文}>
          <div className={样式.代号行}>
            {/* 披露状态胶囊已删(用户 2026-09-01):真名/代号本身就携带披露状态,不再挂标签 */}
            <span className={样式.大代号}>{已披露 ? 真名 : 档.代号}</span>
          </div>
          <div className={样式.职位行}>{档.职位行}</div>
        </div>
        <span className={样式.人像占位} aria-hidden>
          <svg width="26" height="26" viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="11" r="5.5" stroke="#b9bdb2" strokeWidth="1.8" />
            <path d="M5 26c1.8-4.6 5.6-7 10-7s8.2 2.4 10 7" stroke="#b9bdb2" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
      </div>

      {/* 概览条(经验/学历/年龄)已删(用户 2026-09-01):经验与学历在匹配度分析里有证据行,不重复 */}

      {/* ── 匹配度分析(2026-08-26 定稿对齐表,两端同构):岗位硬性条件原文 ×
          候选简历原文,与求职端职位详情同一个共用卡。原「AI代理读完简历后的判断」
          散文卡随之退役——判断类小文案整类淘汰,证据自己说话。
          藏环:返回栏已带「匹配 N」,同屏不出现两个分数(2026-08-24 既定口径) ── */}
      {对齐行们?.length ? (
        <div className={样式.对齐卡容器}>
          <匹配对齐卡 分={档.适配分} 行们={对齐行们} 藏环 />
        </div>
      ) : null}

      {/* ── 个人优势段（2026-08-21：与注册采集页「分享一下自己的个人优势」统一命名）── */}
      <div className={样式.节标行}>
        <span className={样式.节标}>个人优势</span>
      </div>
      <p className={样式.自述}>{档.自述}</p>

      {/* ── 求职期望 ── */}
      <div className={样式.节标行}>
        <span className={样式.节标}>求职期望</span>
      </div>
      <div className={样式.期望标题行}>
        <span className={样式.期望标题}>{档.期望.标题}</span>
        <span className={样式.期望薪资}>{薪资结论}</span>
      </div>
      <div className={样式.期望副行}>
        {档.期望.带宽行}
        {档.期望.偏好 ? <span className={样式.期望偏好}>{档.期望.偏好}</span> : null}
      </div>
      <div className={样式.一致条}>
        <span className={样式.一致符} aria-hidden>✓</span>
        <span>{档.期望.一致性}</span>
      </div>

      {/* ── 工作经历：每段可带 AI 逐段批注绿条；真名非空（S1）时还原公司实名 ── */}
      <div className={样式.节标行}>
        <span className={样式.节标}>工作经历</span>
      </div>
      {档.经历.map((段) => (
        <div key={段.起止} className={样式.经历段}>
          <div className={样式.经历头}>
            <span className={`${样式.经历公司} 单行`}>
              {已披露 && 段.公司实名 ? 段.公司实名 : 段.公司}
            </span>
            <span className={`${样式.经历起止} 等宽数字`}>{段.起止}</span>
          </div>
          <div className={样式.经历职位}>{段.职位}</div>
          <div className={样式.经历说明}>
            {段.说明.split('\n').map((行) => (
              <div key={行} className={样式.说明行}>
                {行}
              </div>
            ))}
          </div>
          {段.批注 ? (
            <div className={样式.一致条}>
              <span className={样式.一致符} aria-hidden>✓</span>
              <span>{段.批注}</span>
            </div>
          ) : null}
        </div>
      ))}

      {/* ── 项目经历 ── */}
      {档.项目.length > 0 ? (
        <>
          <div className={样式.节标行}>
            <span className={样式.节标}>项目经历</span>
          </div>
          {档.项目.map((项) => (
            <div key={项.名称} className={样式.经历段}>
              <div className={样式.经历头}>
                <span className={`${样式.经历公司} 单行`}>{项.名称}</span>
                <span className={`${样式.经历起止} 等宽数字`}>{项.起止}</span>
              </div>
              <div className={样式.经历职位}>{项.角色}</div>
              <div className={样式.经历说明}>{项.说明}</div>
              {项.批注 ? (
                <div className={样式.一致条}>
                  <span className={样式.一致符} aria-hidden>✓</span>
                  <span>{项.批注}</span>
                </div>
              ) : null}
            </div>
          ))}
        </>
      ) : null}

      {/* ── 教育经历：直接显示具体学校（用户定：学校不脱敏，onboarding 配置）── */}
      <div className={样式.节标行}>
        <span className={样式.节标}>教育经历</span>
      </div>
      <div className={样式.教育行}>
        <span className={样式.教育文}>{档.教育行}</span>
        <span className={`${样式.经历起止} 等宽数字`}>{档.教育起止}</span>
      </div>

      {/* ── 专业技能 ── */}
      <div className={样式.节标行}>
        <span className={样式.节标}>专业技能</span>
      </div>
      <div className={样式.技能行}>
        {档.技能.map((技) => (
          <span key={技} className={样式.技能片}>
            {技}
          </span>
        ))}
      </div>

      <div className={样式.页尾注}>
        {已确认
          ? '双方已确认意向，可进入真人沟通 · 内容不可转发'
          : 已披露
            ? '候选人身份已随 S1 原件披露 · 意向确认后进入真人沟通 · 内容不可转发'
            : '这份简历由候选人的AI代理生成 · 内容真实性经双向核验 · 不可转发'}
      </div>
    </div>
  );
}

export default function 匿名在线简历() {
  const { 数据源模式 } = use应用状态();
  return 数据源模式 === 'backend' ? <Backend匿名简历 /> : <Mock匿名简历 />;
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
                设提示(已收藏 ? '已取消收藏' : '已收藏 · 可在筛选里「只看收藏」');
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
        <简历正文 档={档} 薪资结论={薪资结论} 对齐行们={招聘侧对齐行(状态.岗位列表.find((岗) => 岗.编号 === 岗位编号)?.硬性条件 ?? [], 档)} />
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
 *  每次进屏都强制重读（screens always force）：权威卡可能在上一次停留后被收藏/淘汰/
 *  委托过，缓存不可信。404 已由操作层收口成不可用标记（不抛），其余错误给文案与重试。 */
function Backend匿名简历() {
  const { id: 推荐编号 = '' } = useParams<{ id: string }>();
  const { 数据源模式, 状态, 后端状态, 操作 } = use应用状态();
  const { 返回, 跳转 } = use导航();
  // 详情读取的非 404 错误文案（404 走统一不可用页，不进这里）
  const [读取错误, 设读取错误] = useState<string | null>(null);
  // 反馈/委托写进行中：并发写会被操作层单飞丢弃，动作键统一禁用防静默丢点击
  const [反馈中, 设反馈中] = useState(false);

  const 是后端 = 数据源模式 === 'backend';
  const 当前岗位编号 = 状态.当前岗位编号;

  // 进屏先注册可见范围（操作层栅栏要靠它对上）再强制重读，离开即清，别让别的屏背上旧范围
  useEffect(() => {
    if (!是后端 || !当前岗位编号 || !推荐编号) return;
    设读取错误(null);
    操作.设置发现推荐范围('recruiter', P4范围键.招聘详情(当前岗位编号, 推荐编号));
    void 操作.读取招聘候选详情(当前岗位编号, 推荐编号, true)
      .catch((错误: unknown) => 设读取错误(P4错误文案(错误)));
    return () => 操作.设置发现推荐范围('recruiter', null);
  }, [是后端, 当前岗位编号, 推荐编号, 操作]);

  // 权威卡与不可用标记都来自操作层提交的缓存；不可用永远赢过缓存卡（fail closed）：
  // 重读 404 已经删缓存，这里再兜一层，绝不让旧画像带着收藏/委托键继续活着
  const 不可用 = 推荐编号 !== '' && (后端状态.招聘候选不可用 ?? []).includes(推荐编号);
  const 卡 = 推荐编号 && !不可用 ? 后端状态.招聘候选详情?.[推荐编号] ?? null : null;
  const 视图 = useMemo(() => (卡 === null ? null : 从P4招聘候选(卡)), [卡]);

  const 重试读取 = () => {
    if (!当前岗位编号 || !推荐编号) return;
    设读取错误(null);
    void 操作.读取招聘候选详情(当前岗位编号, 推荐编号, true)
      .catch((错误: unknown) => 设读取错误(P4错误文案(错误)));
  };

  // 收藏：服务端先行，成功后权威快照回改；失败原地提示不翻转
  const 切收藏 = async () => {
    if (反馈中 || !当前岗位编号 || !推荐编号) return;
    设反馈中(true);
    try {
      await 操作.设置候选收藏(当前岗位编号, 推荐编号, !(视图?.收藏 ?? false));
    } catch (错误) {
      轻提示(P4错误文案(错误));
    } finally {
      设反馈中(false);
    }
  };

  // 委托：无确认层（招聘侧没有披露确认动作），点了就发起；终态/拒绝回执由操作层抛成
  // 带文案的错误，catch 呈现即可。提交后不导航 —— 原地切成闭合六态的权威状态条。
  const 委托候选 = async () => {
    if (反馈中 || !当前岗位编号 || !推荐编号) return;
    设反馈中(true);
    try {
      await 操作.委托招聘候选(当前岗位编号, 推荐编号);
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
  // 已开案且回执带非空服务端 case_id 才有「查看进展」；job_id / recommendation_id /
  // delegation_id / 别名 一律不作 Case 凭据，也绝不拿 P4真实Case引用 兜底
  const 进展Case编号 = 委托展示?.state === 'case_started' ? 委托展示.caseId : null;

  // 本页唯一可见的进行中委托（accepted/evaluating，即 inProgress === true 的那两个状态）
  const 进行中委托 = useMemo(() => (委托展示?.inProgress === true && 委托摘要 !== null
    ? [{
      role: 'recruiter' as const,
      delegationId: 委托摘要.delegation_id,
      // inProgress === true 已闭合出 accepted/evaluating 两员
      state: 委托展示.state === 'accepted' ? ('accepted' as const) : ('evaluating' as const),
    }]
    : []), [委托展示, 委托摘要]);
  const 进度未知 = use发现推荐委托轮询({
    开启: 是后端,
    委托: 进行中委托,
    刷新: 操作.刷新委托,
    // scope 变化即结束本轮询周期：换岗位/换推荐不带走上一条的连续失败计数（§8.3）
    范围键: 当前岗位编号 && 推荐编号 ? P4范围键.招聘详情(当前岗位编号, 推荐编号) : null,
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
  const 概览项们 = [视图.经验, 教育头?.学历, 视图.薪资关系].filter(Boolean);
  const 已委托 = 委托摘要 !== null;
  // 权威文案 = 闭合六态 copy（refused 附服务端拒绝原因）；轮询连败被中性「进度未知」覆盖，
  // 绝不伪造终态回执
  const 委托文字 = 委托展示 === null
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
          {/* ── 头区：大别名 + 匿名标 + 灰人像占位（双盲：wire 只给别名）── */}
          <div className={样式.头区}>
            <div className={样式.头文}>
              <div className={样式.代号行}>
                <span className={样式.大代号}>{视图.代号}</span>
                <span className={样式.匿名标}>匿名</span>
              </div>
              {/* 求职状态：wire open string，原样透传，不猜中文标签 */}
              <div className={样式.职位行}>{视图.求职状态}</div>
            </div>
            <span className={样式.人像占位} aria-hidden>
              <svg width="26" height="26" viewBox="0 0 30 30" fill="none">
                <circle cx="15" cy="11" r="5.5" stroke="#b9bdb2" strokeWidth="1.8" />
                <path d="M5 26c1.8-4.6 5.6-7 10-7s8.2 2.4 10 7" stroke="#b9bdb2" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
          </div>

          {/* ── 概览条：经验 / 学历 / 薪资关系 —— 无年龄（双盲不披露出生数据）── */}
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

          {/* ── 亮点：推荐亮点行，与推荐卡标签同一批 wire 事实 ── */}
          {视图.亮点.length > 0 ? (
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
          ) : null}

          <div className={样式.页尾注}>
            这份简历由候选人的AI代理生成 · 内容真实性经双向核验 · 不可转发
          </div>
        </div>
      </滚动区>

      {/* ── 底部：委托（无直聊：P4 没有直聊许可/会话坐标）+ 尾注 ── */}
      <div className={样式.底栏}>
        <div className={样式.键行}>
          {已委托 ? (
            // 已开案且回执带服务端 case_id：状态槽换成「查看进展」（唯一导航凭据就是它）；
            // 其余委托态都是不可点的状态条（不需要再点第二次）
            进展Case编号 !== null ? (
              <button
                className={`${样式.去谈键} 可点`}
                onClick={() => 跳转(路径.候选详情(进展Case编号))}
              >
                <span className={样式.去谈图} aria-hidden>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M13 7.5c0 2.9-2.5 5.2-5.5 5.2-.8 0-1.6-.2-2.3-.5L2 13l.9-2.8A5 5 0 0 1 2 7.5C2 4.6 4.5 2.3 7.5 2.3S13 4.6 13 7.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
                </span>
                查看进展
              </button>
            ) : (
              <span className={样式.已谈条}>{委托文字}</span>
            )
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
