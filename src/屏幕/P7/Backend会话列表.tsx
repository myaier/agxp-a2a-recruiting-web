// P7 Backend 收件箱（双角色共用）：只读 后端状态.P7收件箱[role] 的内存快照与
// 真人会话操作，绝不 import Mock 消息 fixture。字段映射按角色反转（spec §8.2）：
// 候选端标题 = context.primary_label（职位名）、副标题 = secondary_label（地点）；
// 招聘端标题 = secondary_label（Case 候选代号）、副标题 = primary_label（职位名）。
// context 不可用只降级展示，标题统一「会话信息暂不可用」；unread_count=0 无红点，
// >0 数字胶囊；点行只走参数路由导航（Builder），已读由会话页 read-through 回执收敛 ——
// 绝不派发 读消息/企业读消息、绝不本地清零。「全部」和「仅会话」展示同一已加载
// 集合；「通知」是明确空态，不混入 Mock AI 动态。搜索只过滤已加载项，不声称搜全部。

import { useEffect, useMemo, useRef, useState } from 'react';
import 样式 from '../消息列表.module.css';
import { 主页外壳, 滚动区 } from '../../组件/通用';
import { 放大镜图标 } from '../../组件/图标';
import { use导航 } from '../../路由/导航钩子';
import { 路径 } from '../../路由/路径表';
import { use应用状态 } from '../../状态/应用状态';
import type { P7角色, P7会话项 } from '../../数据/招聘数据源/真人会话';

/** 三个筛选页签：与 Mock 消息列表同一视觉壳，别改顺序。 */
const 页签列表 = ['全部', '仅会话', '通知'] as const;
type 页签 = (typeof 页签列表)[number];

/** 角色专属字段映射：context 不可用时标题统一降级、副标题留空（消息仍可读写）。 */
function 行字段(条: P7会话项, role: P7角色): { 标题: string; 副标题: string } {
  if (条.contextStatus !== 'available' || 条.context === null) {
    return { 标题: '会话信息暂不可用', 副标题: '' };
  }
  return role === 'candidate'
    ? { 标题: 条.context.primaryLabel, 副标题: 条.context.secondaryLabel }
    : { 标题: 条.context.secondaryLabel, 副标题: 条.context.primaryLabel };
}

/** RFC3339 的确定性短显示（MM-DD）：只从字符串本身取段，不读本地时钟。 */
function 取会话时间(iso: string): string {
  const 月 = iso.slice(5, 7);
  const 日 = iso.slice(8, 10);
  return `${月}-${日}`;
}

export default function Backend会话列表({ role }: { role: P7角色 }) {
  const { 跳转 } = use导航();
  const { 后端状态, 操作 } = use应用状态();
  const 快照 = 后端状态.P7收件箱[role];
  const [当前页签, 设当前页签] = useState<页签>('全部');
  const [搜索词, 设搜索词] = useState('');
  const 搜索框引用 = useRef<HTMLInputElement>(null);

  // 进入消息 Tab：登记收件箱可见范围 + force 权威刷新（操作层单飞防重复）；
  // 卸载注销可见范围。事件层据此决定失效重拉的范围。
  useEffect(() => {
    操作.设置P7收件箱范围(role, true);
    void 操作.加载会话列表(role, true);
    return () => 操作.设置P7收件箱范围(role, false);
  }, [role, 操作]);

  // 本地搜索只过滤已加载项；「全部」与「仅会话」是同一已加载集合（P7 只有真人会话）。
  const 过滤后 = useMemo(() => {
    if (当前页签 === '通知') return [];
    const 关键词 = 搜索词.trim();
    if (!关键词) return 快照.items;
    return 快照.items.filter((条) => {
      const { 标题, 副标题 } = 行字段(条, role);
      const 摘要 = 条.lastMessage?.preview ?? '已建立真人会话';
      return `${标题} ${副标题} ${摘要}`.includes(关键词);
    });
  }, [快照.items, 当前页签, 搜索词, role]);

  /** 点行只导航到参数路由；已读由会话页 read-through 回执权威收敛，不本地清零。 */
  const 打开会话 = (条: P7会话项) => {
    跳转(role === 'candidate'
      ? 路径.真人会话路径(条.conversationId)
      : 路径.企业真人会话路径(条.conversationId));
  };

  return (
    <主页外壳>
      <div className={样式.标题行}>
        <div className={样式.大标题}>消息</div>
        <button
          className={`${样式.放大镜键} 可点`}
          onClick={() => 搜索框引用.current?.focus()}
          aria-label="搜索"
        >
          <放大镜图标 />
        </button>
      </div>

      <div className={样式.页签行}>
        {页签列表.map((签) => (
          <button
            key={签}
            className={`${签 === 当前页签 ? 样式.页签选中 : 样式.页签未选} 可点`}
            onClick={() => 设当前页签(签)}
          >
            {签}
          </button>
        ))}
      </div>

      <滚动区 样式覆盖={{ paddingTop: 2, paddingBottom: 130 }}>
        <div className={样式.搜索条}>
          <放大镜图标 尺寸={15} 色="var(--灰白)" 线宽={2} />
          <input
            ref={搜索框引用}
            className={样式.搜索输入}
            placeholder={role === 'candidate' ? '搜索会话 / 公司 / 职位' : '搜索会话 / 候选 / 岗位'}
            value={搜索词}
            onChange={(事件) => 设搜索词(事件.target.value)}
          />
        </div>

        {当前页签 === '通知' ? (
          // 「通知」明确空态：P7 首版只有真人会话，不把 Mock AI 动态混进来。
          <div className={样式.空态}>还没有通知</div>
        ) : (
          <>
            {快照.error !== null ? (
              <div className={样式.空态}>
                {快照.error}
                <br />
                <button className="可点" onClick={() => void 操作.加载会话列表(role, true)}>重试</button>
              </div>
            ) : null}
            {快照.阶段 !== '成功' && 快照.items.length === 0 && 快照.error === null ? (
              <div className={样式.空态}>正在读入会话…</div>
            ) : null}
            {快照.阶段 === '成功' && 快照.items.length === 0 && 搜索词.trim() === '' ? (
              <div className={样式.空态}>还没有真人会话</div>
            ) : null}
            {过滤后.map((条) => (
              <会话行 key={条.conversationId} 条={条} role={role} 按下={() => 打开会话(条)} />
            ))}
            {过滤后.length === 0 && 搜索词.trim() !== '' && 快照.items.length > 0 ? (
              <div className={样式.空态}>
                没有匹配的会话。
                <br />
                换个关键词，或者切到「全部」看看。
              </div>
            ) : null}
            {快照.nextCursor !== null ? (
              <button className="可点" onClick={() => void 操作.追加会话列表(role)}>加载更多</button>
            ) : null}
          </>
        )}
      </滚动区>
    </主页外壳>
  );
}

/**
 * 单条会话行：与 Mock 消息列表同一视觉壳。头像是中性占位字符，不从 Mock 姓名
 * 派生首字；unreadCount=0 不渲染任何红点，>0 渲染数字胶囊（data-testid 供回归）。
 */
function 会话行({ 条, role, 按下 }: { 条: P7会话项; role: P7角色; 按下: () => void }) {
  const { 标题, 副标题 } = 行字段(条, role);
  return (
    <button className={`${样式.会话行} 可点`} onClick={按下}>
      <span className={样式.头像} style={{ background: 'var(--最弱)' }}>会</span>
      <span className={样式.正文区}>
        <span className={样式.会话头行}>
          <span className={样式.会话标题}>{标题}</span>
          <span className={`${样式.会话副标题} 单行`}>{副标题}</span>
          <span className={`${样式.会话时间} 等宽数字`}>{取会话时间(条.lastActivityAt)}</span>
        </span>
        <span className={样式.会话摘要行}>
          <span className={`${样式.会话摘要} 单行`}>
            {条.lastMessage?.preview ?? '已建立真人会话'}
          </span>
          {条.unreadCount > 0 ? (
            <span
              className={`${样式.未读徽标} 等宽数字`}
              data-testid={`unread-${条.conversationId}`}
            >
              {条.unreadCount}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}