// A10·B AI代理规则库 · 清单版（P6 接权威规则域）
//
// 产品含义（P6 定稿）：规则不再由叮嘱自动沉淀 —— 用户在提案确认卡上明确「确认规则」后，
// 才会成为长期规则约束 AI 代理。提示条与数据流都改成显式确认口径。
//
// 数据流分两条：
// · Mock：读全局状态里的 全局规则 / 意向级规则（不能本地 useState，「往来记录 → 记成规则」
//   新增的那条要真的出现在这里）；手动添加经 操作 的 Mock 分支派发既有同步动作，保存即关闭。
// · Backend（P6）：一切展示先过角色水合门控 ——
//   rules 成功前不显示任何规则行/计数；proposals 也成功后才给 创建/编辑/确认/放弃 控件与提案卡；
//   任一域 失败 出「规则加载失败，重试」（重试跑完整 刷新Agent规则 水合）；
//   进行中出 role="status" 加载壳，已成功的域保持在屏（刷新不得降级，行不闪退）。
//   编辑=替换提案（旧 Rule 在确认前保留），删除=当前版本 If-Match；
//   所有动作 await 操作层，失败 轻提示(取Agent规则错误文案) 并保留本地草稿/范围。
//
// 结构：提示条 →（加载壳/重试）→ 提案卡组 → 全局规则分组卡 → 意向分组卡 → 手动添加 → 尾注。

import { Fragment, useEffect, useState } from 'react';
import 样式 from './规则库.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { 先问选择行 } from '../组件/先问选择行';
import Agent规则提案卡 from '../组件/Agent规则提案卡';
import { useAgent规则提案轮询 } from '../状态/后端/useAgent规则提案轮询';
import { 读Agent规则草稿, 写Agent规则草稿, 删Agent规则草稿 } from './Agent规则草稿寄存';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import { 轻提示 } from '../组件/轻提示';
import { 取Agent规则错误文案 } from '../状态/后端/Agent规则操作';
import type { BFFAgent规则提案, BFFAgent规则作用域, BFF角色 } from '../数据/BFF契约';
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

export default function 规则库() {
  const { 状态, 派发, 数据源模式, 后端状态, 操作 } = use应用状态();
  const { 返回 } = use导航();

  // ── P6 角色水合门控（企业代理设置 同构，仅 expectedRole 不同）──
  const expectedRole: BFF角色 = 'candidate';
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
  const Agent设置快照 = role === null ? null : 后端状态.Agent设置?.[role] ?? null;
  const Agent设置已就绪 = !是Backend || Agent设置快照?.阶段 === '成功';
  const [Agent设置保存中, 设Agent设置保存中] = useState(false);

  useEffect(() => {
    if (是Backend && role === 'candidate') void 操作.加载Agent设置();
  }, [是Backend, role, 操作]);

  const 保存候选Agent设置 = async (
    patch: { material_submission?: 'ask_first' | 'auto_send'; out_of_authority_concession?: 'ask_first' | 'reject' },
  ) => {
    if (!是Backend) return;
    设Agent设置保存中(true);
    try {
      await 操作.保存Agent设置(patch);
      轻提示('设置已保存');
    } catch {
      轻提示('设置没有保存成功，请重试');
    } finally {
      设Agent设置保存中(false);
    }
  };

  // 手动添加：折叠态是一条虚线按钮，点开后原地变成输入行（不另开弹层，减少一次跳转）
  const [添加中, 设添加中] = useState(false);
  const [新规则文本, 设新规则文本] = useState('');
  // P6 范围选择：默认全局，可点名某条权威意向（Mock 无权威意向，不出这个选择器）
  const [选范围, 设选范围] = useState('');
  const [提交中, 设提交中] = useState(false);
  // 编辑制（标注 10:16）：点行进入编辑，改完 提交修改（Backend=替换提案）或删除
  const [编辑中编号, 设编辑中编号] = useState<string | null>(null);
  const [编辑草稿, 设编辑草稿] = useState('');
  const [提交编辑中, 设提交编辑中] = useState(false);
  const [删除中, 设删除中] = useState(false);
  // 提案卡的忙：只圈住正在接受/放弃的那一张卡（failed 卡的关闭永远可用）
  const [卡忙编号, 设卡忙编号] = useState<string | null>(null);
  // failed 卡的本地关闭：提案表里仍是 failed，页面先收起，原草稿保留给用户再次明确提交
  const [已关失败卡, 设已关失败卡] = useState<string[]>([]);
  // §7.3：公开的 Proposal DTO 不带正文/范围 —— 创建成功后把原草稿寄存进 sessionStorage
  //（Agent规则草稿寄存），跨导航存活；提案翻 failed 且用户关闭失败卡时原样还原，
  // 提案收口（接受/放弃）时清掉寄存。

  // 权威意向候选 = 求职意向表 ∩ 后端意向快照（archived 排除）；孤儿意向规则由映射层整条省略，
  // 绝不并入全局，也不出现在范围选择里
  const 范围选项 = 状态.求职意向表.filter((条) => {
    const dto = 后端状态.意向快照[条.编号];
    return dto !== undefined && dto.status !== 'archived';
  });
  const 意向分组 = 范围选项
    .map((条) => ({
      编号: 条.编号,
      标题: 条.标题,
      规则: 状态.意向级规则.filter(
        (规) => 规.作用域?.类型 === '意向' && 规.作用域.意向编号 === 条.编号,
      ),
    }))
    .filter((组) => 组.规则.length > 0);

  // 行数据源：Mock 用既有数组；Backend 等 rules 成功后同一数组已被权威投影整组替换
  const 全部规则 = [...状态.全局规则, ...状态.意向级规则];
  const 条数 = 全部规则.filter((条) => 条.生效).length;

  // actionable 提案：Backend 按角色读 raw 字典；Mock 没有提案卡
  const 可见提案 = 提案展示序(
    role === null ? [] : Object.values(role === 'candidate' ? 后端状态.候选规则提案 : 后端状态.招聘规则提案),
  ).filter((提案) => !(提案.state === 'failed' && 已关失败卡.includes(提案.proposal_id)));

  // 页面挂载且提案水合就绪才轮询 interpreting（节拍/单飞/卸载清理都归钩子）
  useAgent规则提案轮询({
    开启: role !== null && proposalsReady,
    提案: 可见提案,
    刷新: (编号) => 操作.刷新Agent规则提案(编号),
  });

  // Backend 未就绪不给清单/计数；创建/编辑/确认/放弃 控件还要等 proposals 也成功
  const 显示清单 = !是Backend || rulesReady;
  const 显示控件 = !是Backend || (rulesReady && proposalsReady);

  // 提交手动添加：candidate 必须点名范围（默认 global）；失败保留草稿与范围供再次明确提交
  const 提交新规则 = async () => {
    const 内容 = 新规则文本.trim();
    if (!内容) {
      轻提示('请先写下希望AI代理遵守的规则');
      return;
    }
    if (提交中) return;
    const 作用域: BFFAgent规则作用域 = 选范围 === ''
      ? { type: 'global' }
      : { type: 'intention', intention_id: 选范围 };
    设提交中(true);
    try {
      const 回执编号 = await 操作.创建Agent规则提案({ 文本: 内容, 作用域 });
      // 成功才寄存草稿并收起输入行；idempotency_conflict 等失败一律保留现场，不伪造成功
      if (回执编号) {
        写Agent规则草稿(回执编号, {
          subjectId: 后端状态.主体?.subject_id ?? '',
          文本: 内容,
          作用域,
        });
      }
      设新规则文本('');
      设选范围('');
      设添加中(false);
    } catch (错误) {
      轻提示(取Agent规则错误文案(错误));
    } finally {
      设提交中(false);
    }
  };

  // failed 卡的关闭：提案 DTO 没有正文，按寄存把原草稿（含范围）还原进输入行供再次明确提交；
  // subject 不匹配（换账号后的失败卡）时不还原，键也一并删掉，杜绝跨账号草稿回流
  const 关闭失败卡 = (编号: string) => {
    const 寄存 = 读Agent规则草稿(编号);
    if (寄存 && 寄存.subjectId === (后端状态.主体?.subject_id ?? '')) {
      设新规则文本(寄存.文本);
      设选范围(寄存.作用域?.type === 'intention' ? 寄存.作用域.intention_id : '');
      设添加中(true);
    }
    删Agent规则草稿(编号);
    设已关失败卡((旧) => [...旧, 编号]);
  };

  // 编辑保存 = 替换提案：旧 Rule 在用户「确认规则」前继续显示
  const 保存编辑 = async () => {
    if (编辑中编号 === null || 提交编辑中) return;
    const 内容 = 编辑草稿.trim();
    if (!内容) return;
    设提交编辑中(true);
    try {
      await 操作.创建Agent规则替换提案(编辑中编号, 内容);
      设编辑中编号(null);
    } catch (错误) {
      // 保留编辑草稿，不伪造成功
      轻提示(取Agent规则错误文案(错误));
    } finally {
      设提交编辑中(false);
    }
  };

  // 删除 = 当前版本 If-Match；失败保留编辑态；删除在飞时按钮禁用，杜绝双击打出 not_found
  const 删除规则 = async () => {
    if (编辑中编号 === null || 删除中) return;
    设删除中(true);
    try {
      await 操作.删除Agent规则(编辑中编号);
      设编辑中编号(null);
    } catch (错误) {
      轻提示(取Agent规则错误文案(错误));
    } finally {
      设删除中(false);
    }
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
    <次级页外壳 白底>
      <返回栏
        返回={返回}
        标题="AI代理规则库"
        右侧={显示清单 ? <span className={`${样式.生效数} 等宽数字`}>{条数} 条</span> : null}
      />

      {/* ── 哪些事先问你(2026-08-31 定稿):页面只放真选项,铁律不渲染成设置。
            Backend 角色不符时随安全壳一起收起 ── */}
      {!是Backend || role !== null ? (
        <div className={样式.授权组}>
          <div className={样式.分组标}>哪 些 事 先 问 你</div>
          <div className={样式.授权卡}>
            {是Backend && Agent设置快照?.阶段 !== '成功' ? (
              Agent设置快照?.阶段 === '失败'
                ? <button className={`${样式.重试键} 可点`} onClick={() => { void 操作.加载Agent设置(true); }}>设置加载失败，重试</button>
                : <div className={样式.加载壳} role="status">AI代理设置加载中</div>
            ) : null}
            <先问选择行
              标题="发送正式简历"
              注="带姓名与联系方式的 PDF 原件"
              值={状态.求职先问偏好.递交材料}
              选项={['先问我', '自动发送'] as const}
              选择={(值) => {
                if (!是Backend) 派发({ 型: '设先问偏好', 端: '求职', 偏好: { 递交材料: 值 } });
                else void 保存候选Agent设置({ material_submission: 值 === '先问我' ? 'ask_first' : 'auto_send' });
              }}
              禁用={!Agent设置已就绪 || Agent设置保存中}
            />
            <先问选择行
              标题="对方要的让步超出授权"
              注="比如作息折中、提前到岗"
              值={状态.求职先问偏好.超授权让步}
              选项={['先问我', '直接回绝'] as const}
              选择={(值) => {
                if (!是Backend) 派发({ 型: '设先问偏好', 端: '求职', 偏好: { 超授权让步: 值 } });
                else void 保存候选Agent设置({ out_of_authority_concession: 值 === '先问我' ? 'ask_first' : 'reject' });
              }}
              禁用={!Agent设置已就绪 || Agent设置保存中}
              末行
            />
          </div>
        </div>
      ) : null}

      {是Backend ? (
        <div className={样式.提示条}>
          <div className={样式.提示文字}>
            {/* P6 定稿：不再说「叮嘱自动沉淀」—— 规则由你在确认卡上明确「确认规则」后才生效 */}
            你确认过的规则才会沉淀到这里，长期约束你的AI代理。
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
                {状态.全局规则.map((条, 序) => (
                  <规则行
                    key={条.编号}
                    条={条}
                    可编辑={显示控件}
                    编辑中={编辑中编号 === 条.编号}
                    草稿={编辑草稿}
                    改草稿={设编辑草稿}
                    开始编辑={() => {
                      设编辑中编号(条.编号);
                      设编辑草稿(条.内容);
                    }}
                    保存={保存编辑}
                    删除={删除规则}
                    编辑提交中={提交编辑中}
                    编辑删除中={删除中}
                    末条={序 === 状态.全局规则.length - 1}
                  />
                ))}
              </div>

              {是Backend ? (
                // Backend：按真实 intention_id 分组，标题用权威求职意向名（Mock 分组保持原型）
                意向分组.map((组) => (
                  <Fragment key={组.编号}>
                    <div className={样式.分组标}>意向规则 · {组.标题}</div>
                    <div className={样式.卡}>
                      {组.规则.map((条, 序) => (
                        <规则行
                          key={条.编号}
                          条={条}
                          可编辑={显示控件}
                          编辑中={编辑中编号 === 条.编号}
                          草稿={编辑草稿}
                          改草稿={设编辑草稿}
                          开始编辑={() => {
                            设编辑中编号(条.编号);
                            设编辑草稿(条.内容);
                          }}
                          保存={保存编辑}
                          删除={删除规则}
                          编辑提交中={提交编辑中}
                          编辑删除中={删除中}
                          末条={序 === 组.规则.length - 1}
                        />
                      ))}
                    </div>
                  </Fragment>
                ))
              ) : (
                <>
                  <div className={样式.分组标}>意向级 · 仅「AI 产品经理」</div>
                  <div className={样式.卡}>
                    {状态.意向级规则.map((条, 序) => (
                      <规则行
                        key={条.编号}
                        条={条}
                        可编辑={显示控件}
                        编辑中={编辑中编号 === 条.编号}
                        草稿={编辑草稿}
                        改草稿={设编辑草稿}
                        开始编辑={() => {
                          设编辑中编号(条.编号);
                          设编辑草稿(条.内容);
                        }}
                        保存={保存编辑}
                        删除={删除规则}
                        编辑提交中={提交编辑中}
                        编辑删除中={删除中}
                        末条={序 === 状态.意向级规则.length - 1}
                      />
                    ))}
                  </div>
                </>
              )}

              {添加中 ? (
                <div className={样式.添加输入行}>
                  {是Backend && 范围选项.length > 0 ? (
                    <select
                      className={样式.范围选择}
                      aria-label="规则范围"
                      value={选范围}
                      onChange={(事件) => 设选范围(事件.target.value)}
                    >
                      <option value="">全局 · 所有谈判生效</option>
                      {范围选项.map((条) => (
                        <option key={条.编号} value={条.编号}>{条.标题}</option>
                      ))}
                    </select>
                  ) : null}
                  <input
                    className={样式.添加输入框}
                    placeholder="例：不接受大小周的岗位直接过滤"
                    value={新规则文本}
                    onChange={(事件) => 设新规则文本(事件.target.value)}
                    onKeyDown={(事件) => {
                      // 中文输入法组合期（拼音候选词上屏那一下回车）不算提交，与企业代理设置屏一致
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
                      设选范围('');
                      设添加中(false);
                    }}
                  >
                    取消
                  </button>
                  <button className={`${样式.确认添加} 可点`} disabled={提交中 || 新规则文本.trim() === ''} onClick={() => { void 提交新规则(); }}>
                    提交给AI代理理解
                  </button>
                </div>
              ) : 显示控件 ? (
                <button className={`${样式.手动添加} 可点`} onClick={() => 设添加中(true)}>
                  <span className={样式.添加圆}>＋</span>
                  <span className={样式.添加文字}>手动添加规则</span>
                </button>
              ) : null}

              {显示控件 ? (
                <div className={样式.尾注}>
                  {是Backend
                    ? '点任意规则可提交修改或删除；修改要经你确认后才会替换原规则。'
                    : '点任意规则可编辑或删除。'}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </滚动区>
    </次级页外壳>
  );
}

// ── 单条规则：点行进入编辑（输入框 + 提交修改/删除）；未就绪时是纯展示行 ──
function 规则行({
  条,
  可编辑,
  编辑中,
  草稿,
  改草稿,
  开始编辑,
  保存,
  删除,
  编辑提交中,
  编辑删除中,
  末条,
}: {
  条: 规则;
  /** proposals 未就绪时没有编辑/删除控件：行退化为纯展示（P6 门控） */
  可编辑: boolean;
  编辑中: boolean;
  草稿: string;
  改草稿: (值: string) => void;
  开始编辑: () => void;
  保存: () => void;
  删除: () => void;
  /** 替换提案在飞：提交修改 禁用 */
  编辑提交中: boolean;
  /** 删除在飞：删除 禁用（双击会打出 agent_rule_not_found） */
  编辑删除中: boolean;
  末条: boolean;
}) {
  if (编辑中) {
    return (
      <div className={`${样式.规则行} ${末条 ? 样式.末条 : ''}`}>
        <div className={样式.规则主体}>
          <div className={样式.规则头}>
            <input
              className={样式.规则编辑框}
              value={草稿}
              autoFocus
              onChange={(事件) => 改草稿(事件.target.value)}
              onKeyDown={(事件) => {
                if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) 保存();
              }}
              enterKeyHint="done"
            />
          </div>
          <div className={样式.编辑键行}>
            <button className={`${样式.删除键} 可点`} disabled={编辑删除中} onClick={删除}>
              删除
            </button>
            <button className={`${样式.保存键} 可点`} disabled={编辑提交中} onClick={保存}>
              提交修改
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!可编辑) {
    return (
      <div className={`${样式.规则行} ${末条 ? 样式.末条 : ''}`}>
        <div className={样式.规则主体}>
          <div className={样式.规则头}>
            <span className={样式.规则内容}>{条.内容}</span>
          </div>
          <div className={样式.规则来源}>{条.来源}</div>
        </div>
      </div>
    );
  }

  return (
    <button className={`${样式.规则行} ${末条 ? 样式.末条 : ''} 可点`} onClick={开始编辑}>
      <div className={样式.规则主体}>
        <div className={样式.规则头}>
          <span className={样式.规则内容}>{条.内容}</span>
        </div>
        <div className={样式.规则来源}>{条.来源}</div>
      </div>
      <span className={样式.规则改}>✎</span>
    </button>
  );
}
