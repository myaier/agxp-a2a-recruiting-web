// 已批准的 AI代理设置：保留角色水合、权威提案确认与原账号缓存边界。
import { useEffect, useRef, useState } from 'react';
import 样式 from './规则库.module.css';
import 可编辑规则行 from '../组件/可编辑规则行';
import 排除规则分区 from '../组件/排除规则分区';
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

type Mock候选提案 = {
  dto: BFFAgent规则提案;
  动作: { 型: '新增'; 文本: string } | { 型: '替换'; 编号: string; 文本: string };
};

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
  const 添加组合中 = useRef(false);
  // P6 范围选择：默认全局，可点名某条权威意向（Mock 无权威意向，不出这个选择器）
  const [选范围, 设选范围] = useState('');
  const [提交中, 设提交中] = useState(false);
  // 提案卡的忙：只圈住正在接受/放弃的那一张卡（failed 卡的关闭永远可用）
  const [卡忙编号, 设卡忙编号] = useState<string | null>(null);
  const [Mock提案们, 设Mock提案们] = useState<Mock候选提案[]>([]);
  const Mock提案序 = useRef(0);
  // failed 卡的本地关闭：提案表里仍是 failed，页面先收起，原草稿保留给用户再次明确提交
  const [已关失败卡, 设已关失败卡] = useState<string[]>([]);
  // §7.3：公开的 Proposal DTO 不带正文/范围 —— 创建成功后把原草稿寄存进 sessionStorage
  //（Agent规则草稿寄存），跨导航存活；提案翻 failed 且用户关闭失败卡时原样还原，
  // 提案收口（接受/放弃）时清掉寄存。

  // actionable 提案：Backend 按角色读 raw 字典；Mock 用同一确认卡模拟“理解后确认”。
  const 可见提案 = 提案展示序(
    是Backend
      ? (role === null ? [] : Object.values(role === 'candidate' ? 后端状态.候选规则提案 : 后端状态.招聘规则提案))
      : Mock提案们.map((条) => 条.dto),
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
    if (添加组合中.current) return;
    const 内容 = 新规则文本.trim();
    if (!内容) {
      轻提示('请先写下希望AI代理遵守的规则');
      return;
    }
    if (提交中 || 选范围 !== '') return;
    const 作用域: BFFAgent规则作用域 = 选范围 === ''
      ? { type: 'global' }
      : { type: 'intention', intention_id: 选范围 };
    设提交中(true);
    try {
      if (!是Backend) {
        Mock提案序.current += 1;
        const proposal_id = `mock-candidate-${Mock提案序.current}`;
        设Mock提案们((旧) => [...旧, {
          dto: { proposal_id, state: 'ready', normalized_text: 内容, consequence: 'advisory' },
          动作: { 型: '新增', 文本: 内容 },
        }]);
        设新规则文本('');
        设选范围('');
        设添加中(false);
        return;
      }
      const 回执编号 = await 操作.创建Agent规则提案({ 文本: 内容, 作用域 });
      if (!回执编号) throw new Error('规则尚未提交，请重试');
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

  // 修改仍走权威替换提案，确认前不替换旧规则。
  const 保存编辑 = async (条: 规则, 内容: string) => {
    if (!是Backend) {
      Mock提案序.current += 1;
      const proposal_id = `mock-candidate-${Mock提案序.current}`;
      设Mock提案们(旧 => [...旧, {
        dto: { proposal_id, state: 'ready', normalized_text: 内容, consequence: 'advisory' },
        动作: { 型: '替换', 编号: 条.编号, 文本: 内容 },
      }]);
      return;
    }
    const 编号 = await 操作.创建Agent规则替换提案(条.编号, 内容);
    if (!编号) throw new Error('修改尚未提交，请重试');
  };

  // 接受/放弃：await 操作层，失败由 P6 文案收口；操作层负责恢复与权威刷新。
  // 收口成功即清寄存：不留跨提案的残留草稿
  const 处理接受 = async (编号: string) => {
    设卡忙编号(编号);
    try {
      if (!是Backend) {
        const 提案 = Mock提案们.find((条) => 条.dto.proposal_id === 编号);
        if (提案?.动作.型 === '新增') {
          派发({ 型: '新增规则', 内容: 提案.动作.文本, 来源: '你手动添加 · 刚刚' });
        } else if (提案?.动作.型 === '替换') {
          派发({ 型: '改规则', 编号: 提案.动作.编号, 内容: 提案.动作.文本 });
        }
        设Mock提案们((旧) => 旧.filter((条) => 条.dto.proposal_id !== 编号));
        return;
      }
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
      if (!是Backend) {
        设Mock提案们((旧) => 旧.filter((条) => 条.dto.proposal_id !== 编号));
        return;
      }
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
        标题="AI代理设置"
      />

      {/* ── 哪些事先问你(2026-08-31 定稿):页面只放真选项,铁律不渲染成设置。
            Backend 角色不符时随安全壳一起收起 ── */}

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
              <排除规则分区 />
              <section className={样式.分区} aria-label="你教它的规则">
              <h2 className={样式.分组标}>你教它的规则</h2>
              <div className={样式.卡}>
                {状态.全局规则.map(条 => <可编辑规则行 key={条.编号} 条={条} 可编辑={显示控件}
                  保存={内容 => 保存编辑(条, 内容)}
                  删除={async () => { if (!是Backend) 派发({ 型: '删规则', 编号: 条.编号 }); else await 操作.删除Agent规则(条.编号); }}
                  切换={async () => { if (!是Backend) 派发({ 型: '切规则开关', 编号: 条.编号 }); else await 操作.切换Agent规则(条.编号, 条.生效 ? 'pause' : 'resume'); }} />)}
              </div>

              {添加中 ? (
                <div className={样式.添加输入行}>
                  {选范围 !== '' ? <p className={样式.边界说明}>这是历史意向规则草稿，此页不再提交意向规则。请取消后重新添加全局规则。</p> : null}
                  <input
                    className={样式.添加输入框}
                    placeholder="例：不接受大小周的岗位直接过滤"
                    value={新规则文本}
                    disabled={提交中}
                    onCompositionStart={() => { 添加组合中.current = true; }}
                    onCompositionEnd={() => { 添加组合中.current = false; }}
                    onChange={(事件) => 设新规则文本(事件.target.value)}
                    onKeyDown={(事件) => {
                      // 中文输入法组合期（拼音候选词上屏那一下回车）不算提交，与企业代理设置屏一致
                      if (事件.key === 'Enter' && !添加组合中.current && !事件.nativeEvent.isComposing && 事件.keyCode !== 229) void 提交新规则();
                      if (事件.key === 'Escape' && !事件.nativeEvent.isComposing) { 设添加中(false); 设新规则文本(''); 设选范围(''); }
                    }}
                    enterKeyHint="done"
                    autoFocus
                  />
                  <button
                    className={`${样式.取消添加} 可点`}
                    disabled={提交中}
                    onClick={() => {
                      设新规则文本('');
                      设选范围('');
                      设添加中(false);
                    }}
                  >
                    取消
                  </button>
                  <button className={`${样式.确认添加} 可点`} disabled={提交中 || 选范围 !== '' || 新规则文本.trim() === ''} onClick={() => { void 提交新规则(); }}>
                    提交给AI代理理解
                  </button>
                </div>
              ) : 显示控件 ? (
                <button className={`${样式.手动添加} 可点`} onClick={() => 设添加中(true)}>
                  <span className={样式.添加圆}>＋</span>
                  <span className={样式.添加文字}>添加规则</span>
                </button>
              ) : null}

              </section>

            </>
          ) : null}
      {!是Backend || role !== null ? (
        <div className={样式.授权组}>
          <div className={样式.分组标}>哪些事先问你</div>
          <div className={样式.授权卡}>
            {是Backend && Agent设置快照?.阶段 !== '成功' ? (
              Agent设置快照?.阶段 === '失败'
                ? <button className={`${样式.重试键} 可点`} onClick={() => { void 操作.加载Agent设置(true); }}>设置加载失败，重试</button>
                : <div className={样式.加载壳} role="status">AI代理设置加载中</div>
            ) : null}
            <先问选择行
              末行
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

          </div>
        </div>
      ) : null}

        </div>
      </滚动区>
    </次级页外壳>
  );
}
