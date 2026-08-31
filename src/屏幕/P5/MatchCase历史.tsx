// P5 Task 7：双端终局历史（Backend 专用的共享组件；Mock 归档屏不渲染本组件）。
//
// 模式边界（spec §10.2/§10.3 与 P5 冻结契约）：
//   · completed 与 ended 是两个独立架子：各自的 scope 键（P5范围键.history）、各自的
//     快照、各自的不透明游标 —— 请求分开发、行分开渲染，绝不合并成一个列表，绝不把
//     一架的游标透传给另一架。列表只来自当前 role 的 P5历史 快照，经 映射P5列表项 投影；
//     不读 归档列表/企业归档列表、不水合 Mock 归档条、绝不从 Mock 归档条重建时间线或原因，
//     绝不 import Mock。
//   · 归档架无角色专属过滤（Mock 归档屏同样全量）：两架共用 filterRef=null 的 scope。
//   · 服务端顺序原样保留（不做客户端重排）；游标未尽不下「没有」的结论、不声称全量总数。
//   · 终局行读-only：卡上没有任何动作归属徽标（「需要你/代理处理中」是在谈工作区的
//     概念）、没有决策控件；点卡按 case_id 开同一四阶段详情路由（求职→在谈详情 /
//     招聘→候选详情），终局详情由 Task 5 的组件只读呈现。键与导航唯一归属 case_id；
//     candidate_alias 是不透明展示文本，头像用与别名无关的通用匿名图标。
//   · 未知契约行按展示映射 fail closed：整行只给契约错误提示 + 重试（重新 GET），
//     绝不渲染该行的部分数据。首载失败给失败态 + 重试（force 重读）；刷新失败保留
//     旧条目只读，错误单独一行交代（§10.3：错误态由操作层快照承载，页面给重试）。
//   · 历史零轮询（§10.3 只轮询 open 列表与 open 详情）：终局架子不进任何节拍，
//     本组件不 import useMatchCase轮询；重读只来自显式重试与 mutation 后的已载刷新。

import { useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import 列表样式 from './MatchCase列表.module.css';
import { 白卡, 骨架卡组 } from '../../组件/通用';
import { 人像图标 } from '../../组件/图标';
import { use应用状态 } from '../../状态/应用状态';
import { use导航 } from '../../路由/导航钩子';
import { 路径 } from '../../路由/路径表';
import { 映射P5列表项, P5契约错误提示 } from '../../数据/MatchCase展示映射';
import type { P5角色, P5列表正常视图 } from '../../数据/MatchCase展示映射';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import type { P5历史生命周期 } from '../../数据/招聘数据源/MatchCase';
import type { P5列表快照 } from '../../状态/后端/类型';

// 版式沿用 Task 4 列表卡的既有类与设计令牌，只补架子标题等少量行内布局（不另建 CSS 文件）
const 双架间距样式: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14, margin: '0 8px' };
const 架子题样式: CSSProperties = {
  fontSize: 12, fontWeight: 800, letterSpacing: '0.05em', color: 'var(--次要浅)',
};
const 架子列表样式: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };

/** 冻结职位四事实的展示段（职位名/城市·薪资带/技能标签），双端终局卡共用（同列表卡）。 */
function 职位段({ 视图 }: { 视图: P5列表正常视图 }) {
  return (
    <>
      <div className={`${列表样式.事实行} 单行`}>
        {视图.职位.城市} · {视图.职位.薪资带}
      </div>
      <div className={列表样式.标签行}>
        {视图.职位.技能.map((技能) => (
          <span key={技能} className={列表样式.标签}>
            {技能}
          </span>
        ))}
      </div>
    </>
  );
}

/** 阶段行：阶段标题（终局定格在哪一阶段）+ 闭词状态文案（已通过/已结束），权威是 state。 */
function 阶段段({ 视图 }: { 视图: P5列表正常视图 }) {
  return (
    <div className={列表样式.阶段区}>
      <div className={列表样式.阶段头}>
        <span className={列表样式.阶段标}>{视图.阶段标题}</span>
        <span className={`${列表样式.状态文} 单行`}>{视图.状态文案}</span>
        <span className={列表样式.尖括号}>›</span>
      </div>
    </div>
  );
}

/** 候选端终局卡：只渲染冻结工作区职位上下文；零徽标零控件（读-only）。 */
function 候选终局卡({ 视图, 按下 }: { 视图: P5列表正常视图; 按下: () => void }) {
  return (
    <白卡 按下={按下} 类名={列表样式.卡}>
      <div className={`${列表样式.职位名} 单行`}>{视图.职位.职位名}</div>
      <职位段 视图={视图} />
      <阶段段 视图={视图} />
    </白卡>
  );
}

/** 招聘端终局卡：Case 别名原样 + 与别名无关的通用匿名头像 + 冻结职位；零徽标零控件。 */
function 招聘终局卡({ 视图, 按下 }: { 视图: P5列表正常视图; 按下: () => void }) {
  return (
    <白卡 按下={按下} 类名={列表样式.卡}>
      <div className={列表样式.头行}>
        {/* 通用匿名头像：不取别名首字、不按别名散列，每一行都是同一副 */}
        <span className={列表样式.匿名头像} aria-hidden="true">
          <人像图标 尺寸={16} 色="var(--次要浅)" />
        </span>
        <span className={`${列表样式.代号} 单行`}>{视图.candidateAlias}</span>
      </div>
      <div className={`${列表样式.职位名} 单行`}>{视图.职位.职位名}</div>
      <职位段 视图={视图} />
      <阶段段 视图={视图} />
    </白卡>
  );
}

/** 契约错误行：fail closed —— 只给提示与重试，该行的部分数据一概不渲染。 */
function 契约错误行({ 重试 }: { 重试: () => void }) {
  return (
    <div className={列表样式.契约错误行}>
      <div>{P5契约错误提示}</div>
      <button className={`${列表样式.重试键} 可点`} onClick={重试}>
        重试
      </button>
    </div>
  );
}

export function MatchCase历史(props: { role: P5角色 }) {
  const { role } = props;
  const { 数据源模式, 操作 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';

  // 两个架子各自的 scope 键（filterRef 恒 null：归档架无角色专属过滤）
  const completed键 = P5范围键.history(role, 'completed', null);
  const ended键 = P5范围键.history(role, 'ended', null);

  // 进屏：先注册两个架子的 scope 键，再分别懒加载（操作层栅栏靠注册的可见范围对上）。
  // 可见范围槽每个角色只有一格（设置P5范围 的语义）：后注册的键占住槽位，两架的在飞
  // 读写都由这枚槽位栅栏在离开本屏时整包作废；换键递增旧新 scope 代际对两架同样成立
  // （StrictMode 卸载重挂安全）。离开本屏清回 null。Mock 模式本组件不挂载，操作层也恒早退。
  useEffect(() => {
    if (!是后端) return;
    操作.设置P5范围(role, completed键);
    操作.设置P5范围(role, ended键);
    void 操作.加载历史(role, 'completed', null).catch(() => undefined);
    void 操作.加载历史(role, 'ended', null).catch(() => undefined);
    return () => 操作.设置P5范围(role, null);
  }, [是后端, role, completed键, ended键, 操作]);

  return (
    <div style={双架间距样式}>
      <历史架子
        role={role}
        lifecycle="completed"
        标题="已谈成"
        空文案={role === 'candidate' ? '还没有谈成的职位。' : '还没有谈成的候选。'}
      />
      <历史架子
        role={role}
        lifecycle="ended"
        标题="已结束"
        空文案={role === 'candidate' ? '没有已结束的职位。' : '没有已结束的候选。'}
      />
    </div>
  );
}

/** 单个终局架子：快照渲染 + 契约错误行 + 失败/重试 + 游标加载更多（各架各的游标）。 */
function 历史架子({
  role,
  lifecycle,
  标题,
  空文案,
}: {
  role: P5角色;
  lifecycle: P5历史生命周期;
  标题: string;
  空文案: string;
}) {
  const { 后端状态, 操作 } = use应用状态();
  const { 跳转 } = use导航();

  // 只选本架子自己的快照：键按 lifecycle 隔离，另一架的数据天然进不来
  const 快照: P5列表快照 | undefined = 后端状态.P5历史?.[P5范围键.history(role, lifecycle, null)];

  // 展示映射逐行独立：契约错误行整行停用；服务端顺序原样保留（不重排）
  const 视图们 = useMemo(() => (快照?.items ?? []).map(映射P5列表项), [快照?.items]);

  const 载入中 = 快照 === undefined ||
    (快照.items.length === 0 && (快照.阶段 === '未开始' || 快照.阶段 === '进行中'));
  const 首载失败 = 快照 !== undefined && 快照.items.length === 0 && 快照.阶段 === '失败';
  const 游标未尽 = 快照 !== undefined && 快照.nextCursor !== null;

  const 重试首载 = () => void 操作.加载历史(role, lifecycle, null, true).catch(() => undefined);
  const 重读窗口 = () => void 操作.刷新历史(role, lifecycle, null).catch(() => undefined);
  const 追加一页 = () => void 操作.追加历史(role, lifecycle, null).catch(() => undefined);

  return (
    <section>
      <div style={架子题样式}>{标题}</div>
      <div style={架子列表样式}>
        {载入中 ? (
          <骨架卡组 张数={2} />
        ) : 首载失败 ? (
          <div className={列表样式.空态}>
            <div className={列表样式.空态标题}>历史暂时加载不了</div>
            <div className={列表样式.空态说明}>{快照?.error}</div>
            <button className={`${列表样式.重试键} 可点`} onClick={重试首载}>
              重试
            </button>
          </div>
        ) : (
          <>
            {/* 刷新失败：旧条目原样保留只读，错误单独一行交代 + 重试 */}
            {快照?.error && 视图们.length > 0 && !快照.刷新中 ? (
              <div className={列表样式.错误行}>
                {快照.error}
                <button className={`${列表样式.重试键} 可点`} onClick={重读窗口}>
                  重试
                </button>
              </div>
            ) : null}

            {视图们.length === 0 ? (
              <div className={列表样式.空态}>{空文案}</div>
            ) : (
              视图们.map((视图, 下标) =>
                视图.kind === '契约错误' ? (
                  <契约错误行 key={`契约错误_${下标}`} 重试={重读窗口} />
                ) : role === 'candidate' ? (
                  <候选终局卡
                    key={视图.caseId}
                    视图={视图}
                    按下={() => 跳转(路径.在谈详情(视图.caseId))}
                  />
                ) : (
                  <招聘终局卡
                    key={视图.caseId}
                    视图={视图}
                    按下={() => 跳转(路径.候选详情(视图.caseId))}
                  />
                ),
              )
            )}

            {/* 加载更多透传本架快照里的不透明 next_cursor（游标归操作层持有）；读尽即藏 */}
            {游标未尽 ? (
              <button className={`${列表样式.追加键} 可点`} onClick={追加一页}>
                加载更多
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
