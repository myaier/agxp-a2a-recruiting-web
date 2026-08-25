// D11·A 匿名在线简历 —— 独立屏，人才页点推荐卡进入。版式按 mockup 一比一：
//
// 居中标题「匿名在线简历」+ 星标/… → 大代号 + 匿名标签 + 灰人像占位 →
// 职位行 → 经验/学历/年龄 →
// 「AI代理读完简历后的判断」淡绿卡（右上适配分 + 判断正文 + 内嵌白色风险条）→
// 自述段 → ● 求职期望（标题加粗 + 带宽行 + 一致性淡绿条）→ ● 工作经历 →
// 底部双按钮：直接聊（白描边）+ 让AI代理去谈（荧光绿）+ 尾注小字。
//
// 薪资只用于结构化初筛：企业侧只看「有无交集」，不展示候选期望数字，也不让 Agent 谈薪。

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import 样式 from './匿名在线简历.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { use应用状态 } from '../状态/应用状态';
import { 匿名简历表, 推荐列表, type 匿名简历档 } from '../数据/企业端模拟数据';
import { 薪资初筛, 薪资初筛文案 } from '../数据/薪资初筛';

/** 判断正文里 **加粗段** 的渲染：拆成普通/加粗交替段 */
function 带粗体(文本: string) {
  return 文本.split('**').map((段, 序) =>
    序 % 2 === 1 ? (
      <b key={段 + 序} className={样式.判断粗}>
        {段}
      </b>
    ) : (
      <span key={段 + 序}>{段}</span>
    )
  );
}

/**
 * D11·A 简历正文（头区 → 技能 → 页尾注），独立屏与候选详情的「在线简历」Tab 共用。
 * 已确认 = 双方意向确认（S3）：在线简历脱敏段（公司实名 / 教育实名行）才还原；S1 原件递交
 * 时真名即向招聘方显示（看简历原件弹层），但在线简历仍是 S0 匿名投影，不随 S1 提前去匿名。
 */
export function 简历正文({
  档,
  已确认 = false,
  薪资结论 = '薪资带已进入初筛',
}: {
  档: 匿名简历档;
  已确认?: boolean;
  薪资结论?: string;
}) {
  return (
    <div className={样式.页体}>
      {/* ── 头区：大代号 + 匿名标签 + 灰人像占位 ── */}
      <div className={样式.头区}>
        <div className={样式.头文}>
          <div className={样式.代号行}>
            <span className={样式.大代号}>{档.代号}</span>
            <span className={样式.匿名标}>{已确认 ? '已确认意向' : '匿名'}</span>
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

      {/* ── 概览条：经验 / 学历 / 年龄（标注 2026-08-19：状态行、活跃度都删）── */}
      <div className={样式.概览条}>
        {[档.经验, 档.学历, 档.年龄].filter(Boolean).map((项, 序) => (
          <span key={项} className={样式.概览项}>
            {序 > 0 ? <span className={样式.概览分}>·</span> : null}
            {项}
          </span>
        ))}
      </div>

      {/* ── AI 代理读完简历后的判断 ──
          标注 2026-08-24「简洁又高级一点，这个绿色的字体太大了」→ 二轮「把框去掉，
          绿色换成更亮的」，产品负责人选定 丁：淡绿卡拆成亮绿竖条引用，
          标题降为灰标签；右上适配分删除 —— 返回栏已有「匹配 94」，同屏出现两次 */}
      <div className={样式.判断卡}>
        <div className={样式.判断头}>
          <span className={样式.判断标题}>AI代理读完简历后的判断</span>
        </div>
        <div className={样式.判断正文}>{带粗体(档.判断)}</div>
        {档.风险 ? (
          <div className={样式.风险条}>
            <span className={样式.风险符} aria-hidden>◆</span>
            <span className={样式.风险文}>
              风险：{档.风险.includes('薪资') || 档.风险.includes('期望')
                ? `${薪资结论}；如未通过，可调整岗位筛选范围后重新核对。`
                : 档.风险}
            </span>
          </div>
        ) : null}
      </div>

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

      {/* ── 工作经历：每段可带 AI 逐段批注绿条；确认意向后脱敏公司还原实名 ── */}
      <div className={样式.节标行}>
        <span className={样式.节标}>工作经历</span>
      </div>
      {档.经历.map((段) => (
        <div key={段.起止} className={样式.经历段}>
          <div className={样式.经历头}>
            <span className={`${样式.经历公司} 单行`}>
              {已确认 && 段.公司实名 ? 段.公司实名 : 段.公司}
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
          : '这份简历由候选人的AI代理按其披露偏好生成 · 内容真实性经双向核验 · 不可转发'}
      </div>
    </div>
  );
}

export default function 匿名在线简历() {
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
        <简历正文 档={档} 薪资结论={薪资结论} />
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
