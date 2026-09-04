// 谁接触过我 —— 求职端「设置 › 隐私与可见性 › 谁接触过我」（/visitors）。
//
// 这一屏是双盲机制的透明面：你看不见对方的人，但你有权知道「哪家公司、在什么时候、
// 做了什么动作」。所以列的是企业 + 动作 + 时间，绝不出现 HR 姓名、职务、头像 ——
// 招聘方实名指的是「公司与对接人对候选人可见」这一层，不等于把每一次浏览都挂上人名，
// 那会把浏览这个动作变成社交压力。同理也不显示对方看了多久、看了哪几段。
//
// Backend：只渲染当前 candidate 主体 成功 快照的 items（空页复用下方空态容器）；
// 未开始/进行中/owner 不匹配复用空态容器显示中性加载态，首载失败显示安全错误与
// 重试，刷新失败在底部版本槽位提示且不降级旧成功列表 —— 绝不混入 Mock 公司。
// 挂载触发一次 加载接触记录；接口失败不回退 Mock。Mock：继续读 接触记录列表，
// 零 contact 请求。

import { useEffect } from 'react';
import 样式 from './我的功能页.module.css';
import 本屏样式 from './接触记录.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 接触记录列表 } from '../数据/模拟数据';
import type { 接触记录 as 接触记录条 } from '../数据/类型';
import type { 接触事件, 接触事件动作 } from '../数据/招聘数据源/接触记录';

/** 动作 → 小标配色。三档：只是看画像 / 真的发起接触 / 递简历后回看 */
function 取动作类名(动作: 接触记录条['动作']): string {
  if (动作 === '发起接触') return 本屏样式.动作发起接触;
  if (动作 === '递交简历后查看') return 本屏样式.动作看简历;
  return 本屏样式.动作看画像;
}

/** 本地化绝对日期时间：不引入相对时间计时器与推断。 */
export function 格式化接触时间(occurredAt: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(occurredAt));
}

/** wire 事件 → 既有页面行：动作映射为三个既有字面值，公司首字取 display_name 首个 Unicode 字符。 */
export function 接触事件到展示(event: 接触事件): 接触记录条 {
  const 动作文案: Record<接触事件动作, 接触记录条['动作']> = {
    anonymous_profile_viewed: '匿名画像被查看',
    contact_started: '发起接触',
    submitted_resume_viewed: '递交简历后查看',
  };
  return {
    编号: event.eventId,
    公司: event.organization.displayName,
    公司首字: Array.from(event.organization.displayName)[0] ?? '',
    动作: 动作文案[event.action],
    时间: 格式化接触时间(event.occurredAt),
  };
}

export default function 接触记录() {
  const { 返回 } = use导航();
  const { 数据源模式, 后端状态, 操作 } = use应用状态();

  const 是后端 = 数据源模式 === 'backend';
  const subjectId = 后端状态.主体?.last_used_role === 'candidate'
    ? 后端状态.主体.subject_id
    : null;
  // 渲染 gate：只有当前 owner 的成功快照可见；未开始/进行中/owner 不匹配走中性
  // 加载态，首载失败走安全错误加重试 —— 未知不是权威零（spec §B 中性状态）
  const 当前Owner = subjectId !== null &&
    后端状态.接触记录.ownerSubjectId === subjectId;
  const 权威成功 = 是后端 && 当前Owner && 后端状态.接触记录.阶段 === '成功';
  const 首载中 = 是后端 && subjectId !== null &&
    (!当前Owner || 后端状态.接触记录.阶段 === '未开始' ||
     后端状态.接触记录.阶段 === '进行中');
  const 首载失败 = 是后端 && 当前Owner && 后端状态.接触记录.阶段 === '失败';
  const 错误 = 当前Owner ? 后端状态.接触记录.error : null;
  const 页面记录 = !是后端
    ? 接触记录列表
    : 权威成功 ? 后端状态.接触记录.items.map(接触事件到展示) : [];
  // 空态文案只属于「当前 owner 的成功空快照」（或 Mock 的既有空列表）
  const 显示空态 = 页面记录.length === 0 &&
    (!是后端 || 权威成功);

  useEffect(() => {
    if (!是后端 || subjectId === null) return;
    void 操作.加载接触记录().catch(() => undefined);
  }, [是后端, subjectId, 操作]);

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="谁接触过我" 副标题="只显示企业与动作" />

      <滚动区 样式覆盖={{ padding: '14px 18px 24px' }}>
        <div className={样式.说明条}>
          这里
          <span className={样式.说明强调}>不显示任何真人身份</span>
          ——不出现 HR 姓名、职务或头像，也不显示对方看了多久、看了哪几段。
          你只需要知道是哪家公司、在什么时候做了什么。
        </div>

        {首载中 ? (
          <div className={样式.空态} role="status">
            <div className={样式.空态图}>◎</div>
            <div className={样式.空态标题}>正在读取接触记录</div>
            <div className={样式.空态说明}>
              代理替你盯着企业的接触动作，稍等片刻。
            </div>
          </div>
        ) : 首载失败 ? (
          <div className={样式.空态} role="alert">
            <div className={样式.空态图}>◎</div>
            <div className={样式.空态标题}>接触记录暂时加载不了</div>
            <div className={样式.空态说明}>{错误}</div>
            <button
              type="button"
              className={`${样式.次要键} 可点`}
              onClick={() => { void 操作.加载接触记录(true).catch(() => undefined); }}
            >
              重试
            </button>
          </div>
        ) : 显示空态 ? (
          <div className={样式.空态}>
            <div className={样式.空态图}>◎</div>
            <div className={样式.空态标题}>最近还没有企业接触过你</div>
            <div className={样式.空态说明}>
              代理会持续替你寻访；有人来看时，这里会记下企业与动作。
            </div>
          </div>
        ) : 页面记录.length === 0 ? null : (
          <div className={样式.卡}>
            {页面记录.map((条) => (
              <div className={样式.行} key={条.编号}>
                <span className={样式.字标}>{条.公司首字}</span>
                <span className={样式.行文字组}>
                  <span className={本屏样式.头行}>
                    <span className={`${本屏样式.公司} 单行`}>{条.公司}</span>
                    <span className={`${本屏样式.动作标} ${取动作类名(条.动作)}`}>
                      {条.动作}
                    </span>
                  </span>
                  <span className={本屏样式.时间}>{条.时间}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className={样式.版本}>
          {权威成功 && 错误 !== null ? (
            <>
              <span role="alert">{错误}</span>
              <button
                type="button"
                className={`${样式.次要键} 可点`}
                onClick={() => { void 操作.加载接触记录(true).catch(() => undefined); }}
              >
                重试
              </button>
              <br />
            </>
          ) : null}
          屏蔽名单里的公司不会出现在这里，它们也看不到你。
          <br />
          记录保留 90 天。
        </div>
      </滚动区>
    </次级页外壳>
  );
}
