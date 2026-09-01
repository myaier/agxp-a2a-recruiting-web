// D16 授权与规则 · 企业代理设置（P6 接权威规则域）
//
// 同构镜像：求职端 规则库.tsx（A10·B 清单版）。版式、字号、间距、圆角与同构源一致。
// Mock：规则读全局状态的 企业规则（单组「全局规则 · 所有岗位生效」，无意向级分组），
// 开关与手动添加经 操作 的 Mock 分支派发既有同步动作（企业切规则开关 / 企业新增规则）。
//
// 企业侧增量（D16 授权分层语义）：提示条上方多一块「授权范围」卡 ——
// 匿名初筛 / 递交简历 由 AI 代理自动执行，意向确认必须委托人拍板；右侧值只读。
//
// Backend（P6）：一切展示先过角色水合门控（expectedRole = 'recruiter'）——
// rules 成功前不显示规则行/计数；proposals 也成功后才给 手动添加/确认/放弃 控件与提案卡；
// 任一域 失败 出「规则加载失败，重试」；进行中出 role="status" 加载壳，已成功的域保持在屏。
// 开关 active→pause、paused→resume（If-Match 当前版本）；手动添加走提案流、永不携带范围。
// 本期不新增 recruiter 编辑/删除 UI（冻结契约只要求 pause/resume）。
// 所有动作 await 操作层，失败 轻提示(取Agent规则错误文案) 并保留本地草稿。
//
// 规则**不能**用本地 useState —— 必须读全局状态，开关状态才能被别的屏看到。

import { useState } from 'react';
import 样式 from './企业代理设置.module.css';
import { 次级页外壳, 返回栏, 滚动区, 开关 } from '../组件/通用';
import { 先问选择行 } from '../组件/先问选择行';
import Agent规则提案卡 from '../组件/Agent规则提案卡';
import { useAgent规则提案轮询 } from '../状态/后端/useAgent规则提案轮询';
import { 读Agent规则草稿, 写Agent规则草稿, 删Agent规则草稿 } from './Agent规则草稿寄存';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import { 轻提示 } from '../组件/轻提示';
import { 取Agent规则错误文案 } from '../状态/后端/Agent规则操作';
import type { BFFAgent规则提案, BFF角色 } from '../数据/BFF契约';
import type { Agent规则角色水合状态 } from '../状态/后端/类型';
import type { 规则 } from '../数据/类型';

const 未水合: Agent规则角色水合状态 = { rules: '未开始', proposals: '未开始' };

/** actionable 提案展示序：created_at 早的在前，缺席的排最后，同刻按 proposal_id 稳定排序。 */
function 提案展示序(提案们: BFFAgent规则提案[]): BFFAgent规则提案[] {
  return [...提案们].sort((甲, 乙) => {
    const 甲时 = 甲.created_at ?? null;
    const 乙时 = 乙.created_at ?? null;
    if (甲时 === null || 乙时 === null) {
      // interpreting 创建回执可能没有 created_at：缺席的一律排最后
      if (甲时 !== null) return -1;
      if (乙时 !== null) return 1;
    } else if (甲时 !== 乙时) {
      return 甲时 < 乙时 ? -1 : 1;
    }
    if (甲.proposal_id !== 乙.proposal_id) return 甲.proposal_id < 乙.proposal_id ? -1 : 1;
    return 0;
  });
}

export default function 企业代理设置() {
  const { 状态, 派发, 数据源模式, 后端状态, 操作 } = use应用状态();
  const { 返回 } = use导航();

  // ── P6 角色水合门控（规则库.tsx 同构，仅 expectedRole 不同）──
  const expectedRole: BFF角色 = 'recruiter';
  const activeRole = 数据源模式 === 'backend' ? (后端状态.主体?.last_used_role ?? null) : null;
  const role = activeRole === expectedRole ? expectedRole : null;
  const roleHydration: Agent规则角色水合状态 = role === null ? 未水合 : 后端状态.Agent规则水合[role];
  const rulesReady = roleHydration.rules === '成功';
  const proposalsReady = roleHydration.proposals === '成功';
  const showRetry = role !== null &&
    (roleHydration.rules === '失败' || roleHydration.proposals === '失败');
  const showLoading = role !== null && !showRetry && (
    roleHydration.rules === '未开始' || roleHydration.rules === '进行中' ||
    roleHydration.proposals === '未开始' || roleHydration.proposals === '进行中'
  );
  const 是Backend = 数据源模式 === 'backend';

  // 手动添加：折叠态是一条按钮，点开后原地变成输入行（不另开弹层，减少一次跳转）
  const [添加中, 设添加中] = useState(false);
  const [新规则文本, 设新规则文本] = useState('');
  const [提交中, 设提交中] = useState(false);
  // 提案卡的忙：只圈住正在接受/放弃的那一张卡（failed 卡的关闭永远可用）
  const [卡忙编号, 设卡忙编号] = useState<string | null>(null);
  // failed 卡的本地关闭：提案表里仍是 failed，页面先收起，原草稿保留给用户再次明确提交
  const [已关失败卡, 设已关失败卡] = useState<string[]>([]);
  // §7.3：公开的 Proposal DTO 不带正文 —— 创建成功后把原草稿寄存进 sessionStorage
  //（Agent规则草稿寄存），跨导航存活；提案翻 failed 且用户关闭失败卡时原样还原，
  // 提案收口（接受/放弃）时清掉寄存。

  // 返回栏右侧的「N 条生效」= 企业规则里 生效 为 true 的条数（开关联动；
  // Backend 只在 rules 水合成功后显示，首次成功前不出 Mock 计数）
  const 生效数 = 状态.企业规则.filter((条) => 条.生效).length;

  // actionable 提案：Backend 读招聘方 raw 字典；Mock 没有提案卡
  const 可见提案 = 提案展示序(
    role === null ? [] : Object.values(后端状态.招聘规则提案),
  ).filter((提案) => !(提案.state === 'failed' && 已关失败卡.includes(提案.proposal_id)));

  // 页面挂载且提案水合就绪才轮询 interpreting（节拍/单飞/卸载清理都归钩子）
  useAgent规则提案轮询({
    开启: role !== null && proposalsReady,
    提案: 可见提案,
    刷新: (编号) => 操作.刷新Agent规则提案(编号),
  });

  // Backend 未就绪不给清单/计数；手动添加/确认/放弃 控件还要等 proposals 也成功
  const 显示清单 = !是Backend || rulesReady;
  const 显示控件 = !是Backend || (rulesReady && proposalsReady);

  // 开关：active→pause、paused→resume；失败原样保留当前状态并提示，不自动重发
  const 切换规则 = async (条: 规则) => {
    try {
      await 操作.切换Agent规则(条.编号, 条.生效 ? 'pause' : 'resume');
    } catch (错误) {
      轻提示(取Agent规则错误文案(错误));
    }
  };

  // 提交手动添加：招聘方提案永不携带范围；失败保留草稿供再次明确提交
  const 提交新规则 = async () => {
    const 内容 = 新规则文本.trim();
    if (!内容 || 提交中) return;
    设提交中(true);
    try {
      const 回执编号 = await 操作.创建Agent规则提案({ 文本: 内容 });
      // 成功才寄存草稿并收起输入行；失败一律保留现场，不伪造成功
      if (回执编号) {
        写Agent规则草稿(回执编号, {
          subjectId: 后端状态.主体?.subject_id ?? '',
          文本: 内容,
        });
      }
      设新规则文本('');
      设添加中(false);
    } catch (错误) {
      轻提示(取Agent规则错误文案(错误));
    } finally {
      设提交中(false);
    }
  };

  // failed 卡的关闭：提案 DTO 没有正文，按寄存把原草稿还原进输入行供再次明确提交；
  // subject 不匹配（换账号后的失败卡）时不还原，键也一并删掉，杜绝跨账号草稿回流
  const 关闭失败卡 = (编号: string) => {
    const 寄存 = 读Agent规则草稿(编号);
    if (寄存 && 寄存.subjectId === (后端状态.主体?.subject_id ?? '')) {
      设新规则文本(寄存.文本);
      设添加中(true);
    }
    删Agent规则草稿(编号);
    设已关失败卡((旧) => [...旧, 编号]);
  };

  // 接受/放弃：await 操作层，失败由 P6 文案收口；操作层负责恢复与权威刷新。
  // 收口成功即清寄存：不留跨提案的残留草稿
  const 处理接受 = async (编号: string) => {
    设卡忙编号(编号);
    try {
      await 操作.接受Agent规则提案(编号);
      删Agent规则草稿(编号);
    } catch (错误) {
      轻提示(取Agent规则错误文案(错误));
    } finally {
      设卡忙编号(null);
    }
  };
  const 处理放弃 = async (编号: string) => {
    设卡忙编号(编号);
    try {
      await 操作.放弃Agent规则提案(编号);
      删Agent规则草稿(编号);
    } catch (错误) {
      轻提示(取Agent规则错误文案(错误));
    } finally {
      设卡忙编号(null);
    }
  };

  return (
    // 2026-08-24 全站选择风格统一（C1 定稿）：页底改白底
    <次级页外壳 白底>
      <返回栏
        返回={返回}
        标题="AI代理设置"
        右侧={显示清单 ? <span className={`${样式.生效数} 等宽数字`}>{生效数} 条生效</span> : null}
      />

      {/* ── 哪些事先问你(2026-08-31 定稿):页面只放真选项。「匿名初筛/递交简历自动执行」
            「意向确认必须拍板」这类铁律不再渲染成设置 —— 不可改的设置是噪音。
            Backend 角色不符时随安全壳一起收起 ── */}
      {!是Backend || role !== null ? (
        <div className={样式.授权组}>
          <div className={样式.分组标}>哪 些 事 先 问 你</div>
          <div className={样式.授权卡}>
            <先问选择行
              标题="发送内部版 JD"
              注="含只发给对方代理的内部信息"
              值={状态.企业先问偏好.递交材料}
              选项={['先问我', '自动发送'] as const}
              选择={(值) => 派发({ 型: '设先问偏好', 端: '企业', 偏好: { 递交材料: 值 } })}
            />
            <先问选择行
              标题="对方要的让步超出授权"
              注="比如涨薪上限、多要的远程天数"
              值={状态.企业先问偏好.超授权让步}
              选项={['先问我', '直接回绝'] as const}
              选择={(值) => 派发({ 型: '设先问偏好', 端: '企业', 偏好: { 超授权让步: 值 } })}
              末行
            />
          </div>
        </div>
      ) : null}

      {是Backend ? (
        <div className={样式.提示条}>
          <div className={样式.提示文字}>
            {/* P6 定稿：不再说「叮嘱都会沉淀」—— 规则由你在确认卡上明确「确认规则」后才生效 */}
            你确认过的规则才会沉淀到这里，长期约束你的招聘AI代理。
          </div>
        </div>
      ) : null}

      <滚动区>
        <div className={样式.列表}>
          {showLoading ? (
            <div className={样式.加载壳} role="status" aria-label="规则加载中">
              <span className={样式.加载圈} aria-hidden />
              规则加载中
            </div>
          ) : null}

          {showRetry ? (
            <button
              className={`${样式.重试键} 可点`}
              onClick={() => { void 操作.刷新Agent规则(); }}
            >
              规则加载失败，重试
            </button>
          ) : null}

          {显示控件 && 可见提案.length > 0 ? (
            <div className={样式.提案组}>
              {可见提案.map((提案) => (
                <Agent规则提案卡
                  key={提案.proposal_id}
                  提案={提案}
                  忙={卡忙编号 === 提案.proposal_id}
                  接受={() => { void 处理接受(提案.proposal_id); }}
                  放弃={() => { void 处理放弃(提案.proposal_id); }}
                  关闭失败={() => 关闭失败卡(提案.proposal_id)}
                />
              ))}
            </div>
          ) : null}

          {显示清单 ? (
            <>
              <div className={样式.分组标}>你 教 它 的 规 则</div>
              <div className={样式.卡}>
                {状态.企业规则.map((条, 序) => (
                  <规则行
                    key={条.编号}
                    条={条}
                    切换={() => { void 切换规则(条); }}
                    带开关={是Backend}
                    末条={序 === 状态.企业规则.length - 1}
                  />
                ))}
              </div>

              {添加中 ? (
                <div className={样式.添加输入行}>
                  <input
                    className={样式.添加输入框}
                    placeholder="例：到岗超过 60 天的候选先不推进"
                    value={新规则文本}
                    onChange={(事件) => 设新规则文本(事件.target.value)}
                    onKeyDown={(事件) => {
                      // 中文输入法组合期按 Enter 是选字，不是提交
                      if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) void 提交新规则();
                      if (事件.key === 'Escape') 设添加中(false);
                    }}
                    enterKeyHint="done"
                    autoFocus
                  />
                  <button
                    className={`${样式.取消添加} 可点`}
                    onClick={() => {
                      设新规则文本('');
                      设添加中(false);
                    }}
                  >
                    取消
                  </button>
                  <button className={`${样式.确认添加} 可点`} disabled={提交中} onClick={() => { void 提交新规则(); }}>
                    提交给AI代理理解
                  </button>
                </div>
              ) : 显示控件 ? (
                <button className={`${样式.手动添加} 可点`} onClick={() => 设添加中(true)}>
                  <span className={样式.添加圆}>＋</span>
                  <span className={样式.添加文字}>手动添加规则</span>
                </button>
              ) : null}

              <div className={样式.尾注}>
                {是Backend
                  ? '关闭的规则立即停用但保留记录。'
                  : '要调整或不再用，直接告诉AI代理。'}
              </div>
            </>
          ) : null}
        </div>
      </滚动区>
    </次级页外壳>
  );
}

// ── 单条规则：左侧「内容 + 来源」，右侧开关。停用后内容字色转灰但记录保留 ──
// 本期无编辑/删除 UI：招聘方冻结契约只要求 pause/resume（P6）
function 规则行({
  条,
  切换,
  带开关,
  末条,
}: {
  条: 规则;
  切换: () => void;
  /** Backend 冻结契约(P6)要求 pause/resume 开关;Mock 定稿(2026-08-31)不带开关 ——
      规则来自你的叮嘱和选择,要调整直接告诉代理,不是要维护的配置 */
  带开关: boolean;
  末条: boolean;
}) {
  return (
    <div className={`${样式.规则行} ${末条 ? 样式.末条 : ''}`}>
      <div className={样式.规则主体}>
        <div className={样式.规则头}>
          <span className={`${样式.规则内容} ${条.生效 ? '' : 样式.已停用}`}>{条.内容}</span>
        </div>
        <div className={样式.规则来源}>{条.来源}</div>
      </div>
      {带开关 ? <开关 标签={`规则：${条.内容}`} 开={条.生效} 切换={切换} /> : null}
    </div>
  );
}
