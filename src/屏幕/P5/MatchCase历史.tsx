// P5 Task 7：双端终局历史（Backend 专用组件；Mock 归档屏不渲染本组件）。
// S0–S3 展示统一 Task 2：本组件直接拥有共享 历史代谈外壳（返回栏＋固定说明条＋18px 滚动
// 内边距），并改渲染共享 历史代谈卡（求职/招聘 × Mock/Backend 四入口同版式，H1）；返回
// 回调由两个路由屏（归档谈判/企业归档 Backend 分支）传入，数量说明在本层与列表同次渲染。
// 加载/重试/空态/游标等列表状态仍归本连接层；控制语义全部原样保留。
//
// 模式边界（spec §10.2/§10.3 与 P5 冻结契约；J-PILOT-01 Task 4 修订候选半边）：
//   · 候选历史 = 单一服务端分页集合（me/negotiations shelf=history）：已结束 Case 与
//     已归档初评失败由同一个连续分页承接（Spec §5：不再拼两个 Case 分页、不开新历史
//     页面、不新增结果筛选布局），点卡按 canonical record_id 开同一在谈详情 ——
//     needs_action=false 不等于禁止恢复（按钮权限读取 actions.retry，恢复控件在详情
//     动作槽，本组件零动作控件）。
//   · 招聘端继续 completed 与 ended 两个独立架子：各自的 scope 键（P5范围键.history）、
//     各自的快照、各自的不透明游标 —— 请求分开发、行分开渲染，绝不合并成一个列表，
//     绝不把一架的游标透传给另一架。列表只来自当前 role 的 P5历史 快照，经 映射P5列表项
//     投影；不读 归档列表/企业归档列表、不水合 Mock 归档条、绝不 import Mock。
//   · 归档架无角色专属过滤（Mock 归档屏同样全量）：两架共用 filterRef=null 的 scope。
//   · 服务端顺序原样保留（不做客户端重排）；游标未尽不下「没有」的结论、不声称全量总数
//     —— 数量说明只给「已加载 N 单」（两架已成功加载的正常记录数；错误行不计；加载未
//     开始不给假零，Spec §4.2）。
//   · 终局行读-only：卡上没有任何动作归属徽标（「需要你/代理处理中」是在谈工作区的
//     概念）；点卡开同一详情路由（求职→在谈详情 / 招聘→候选详情）。
//   · Task 6（Spec §3.6 冻结）：历史架子不加任何评分 UI 或分析入口 —— 行上有分/有展开
//     解释也不传 查看匹配分析；历史卡打开详情路由后由详情自己的响应展示分析（列表绝不
//     携带别条记录的解释补齐详情；读取合同仍经严格解码，不因列表不显示而放宽）。
//   · 未知契约行按展示映射 fail closed（招聘端）：整行只给契约错误提示 + 重试（重新
//     GET），绝不渲染该行的部分数据；候选连续行由 facade decode 挡漂移，投影全函数。
//     首载失败给失败态 + 重试（force 重读）；刷新失败保留旧条目只读，错误单独一行交代。
//   · 历史零轮询（§10.3 只轮询 open 列表与 open 详情）：终局架子不进任何节拍，
//     本组件不 import useMatchCase轮询；重读只来自显式重试与 mutation 后的已载刷新。

import { useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import 列表样式 from './MatchCase列表.module.css';
import { 骨架卡组 } from '../../组件/通用';
import { 历史代谈外壳, 历史代谈卡 } from '../../组件/历史代谈展示';
import { use应用状态 } from '../../状态/应用状态';
import type { 后端状态 } from '../../状态/应用状态';
import { use导航 } from '../../路由/导航钩子';
import { 路径 } from '../../路由/路径表';
import { 映射P5列表项, P5契约错误提示 } from '../../数据/MatchCase展示映射';
import type { P5角色 } from '../../数据/MatchCase展示映射';
import { 从候选历史到卡, 从招聘历史到卡 } from '../../数据/历史代谈展示映射';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import type { P5历史生命周期 } from '../../数据/招聘数据源/MatchCase';
import type { P5连续列表快照, P5列表快照 } from '../../状态/后端/类型';

// 版式沿用 Task 4 列表态的既有设计令牌（架子标题/间距少量行内布局，不另建 CSS 文件）；
// 卡间 10px 间距由共享历史卡自带 margin 提供，容器不再叠 gap。
const 双架间距样式: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14 };
const 架子题样式: CSSProperties = {
  fontSize: 12, fontWeight: 800, letterSpacing: '0.05em', color: 'var(--次要浅)',
};
const 架子列表样式: CSSProperties = { display: 'flex', flexDirection: 'column' };

export function MatchCase历史(props: { role: P5角色; 返回: () => void }) {
  // J-PILOT-01 Task 4：候选历史接单一连续分页集合，招聘端保持双终局架子（spec §5：
  // 招聘继续旧 Case 列表）。Mock 模式本组件不挂载，操作层也恒早退。
  return props.role === 'candidate'
    ? <候选连续历史 返回={props.返回} />
    : <招聘终局架子组 role={props.role} 返回={props.返回} />;
}

/** 候选连续历史 = 单一服务端分页集合（shelf=history）。原序渲染共享历史卡；「加载更多」
 *  接 追加连续列表，无运行 timer，手动刷新用 force 首屏。数量说明=「已加载 N 单」。 */
function 候选连续历史({ 返回 }: { 返回: () => void }) {
  const { 后端状态, 操作 } = use应用状态();
  const { 跳转 } = use导航();
  const scope键 = P5范围键.negotiations('history');
  // 只选当前主体自己的快照：owner 不匹配（同角色换主体的过渡帧）按不存在处理
  const 当前SubjectId = 后端状态.主体?.last_used_role === 'candidate'
    ? 后端状态.主体.subject_id
    : null;
  const 原快照 = 后端状态.P5连续列表?.[scope键];
  const 快照: P5连续列表快照 | undefined = 原快照?.ownerSubjectId === 当前SubjectId ? 原快照 : undefined;

  // 进屏 / 换主体：先注册连续 scope 再懒加载首屏（与在谈列表同一栅栏口径）；离开清回 null。
  useEffect(() => {
    if (当前SubjectId === null) return;
    操作.设置P5范围('candidate', scope键);
    void 操作.加载连续列表('history').catch(() => undefined);
    return () => 操作.设置P5范围('candidate', null);
  }, [当前SubjectId, scope键, 操作]);

  // 展示映射逐行独立（decode 已 fail closed）；服务端顺序原样保留（不重排）；
  // 点卡按 canonical record_id 开同一在谈详情（回调由映射层原样接通）
  const 卡信息们 = useMemo(
    () => (快照?.items ?? []).map((卡) => 从候选历史到卡(卡, () => 跳转(路径.在谈详情(卡.record_id)))),
    [快照?.items, 跳转],
  );

  const 载入中 = 快照 === undefined ||
    (快照.items.length === 0 && (快照.阶段 === '未开始' || 快照.阶段 === '进行中'));
  const 首载失败 = 快照 !== undefined && 快照.items.length === 0 && 快照.阶段 === '失败';
  const 游标未尽 = 快照 !== undefined && 快照.nextCursor !== null;

  // 无 total 不显示假总数：只报已成功加载的正常记录数；加载未开始/首载失败不给假零
  const 数量说明 = 载入中 || 首载失败 ? null : `已加载 ${快照?.items.length ?? 0} 单`;

  const 重试首载 = () => void 操作.加载连续列表('history', true).catch(() => undefined);
  const 重读窗口 = () => void 操作.刷新连续列表('history').catch(() => undefined);
  const 追加一页 = () => void 操作.追加连续列表('history').catch(() => undefined);

  return (
    <历史代谈外壳 返回={返回} 数量说明={数量说明}>
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
            {快照?.error && !快照.刷新中 ? (
              <div className={列表样式.错误行}>
                {快照.error}
                <button className={`${列表样式.重试键} 可点`} onClick={重读窗口}>
                  重试
                </button>
              </div>
            ) : null}

            {卡信息们.length === 0 ? (
              // 错误在场时不下「没有历史代谈」的定论：那不是事实，只是这次没读到
              快照?.error && !快照.刷新中 ? null : <div className={列表样式.空态}>还没有历史代谈。</div>
            ) : (
              卡信息们.map((信息) => <历史代谈卡 key={信息.键} 信息={信息} />)
            )}

            {/* 加载更多透传快照里的不透明 next_cursor（游标归操作层持有）；读尽即藏 */}
            {游标未尽 ? (
              <button className={`${列表样式.追加键} 可点`} onClick={追加一页}>
                加载更多
              </button>
            ) : null}
          </>
        )}
      </div>
    </历史代谈外壳>
  );
}

/**
 * 单架已成功加载的正常记录数；该架未开始/首载失败按「未贡献」计（null）——两架全未贡献时
 * 不显示「已加载 0 单」的假零（Spec §4.2）。契约错误行不是记录，不计入。
 */
function 架子已载数(
  后端状态: 后端状态,
  role: P5角色,
  lifecycle: P5历史生命周期,
  当前SubjectId: string | null,
): number | null {
  const 原快照 = 后端状态.P5历史?.[P5范围键.history(role, lifecycle, null)];
  const 快照: P5列表快照 | undefined = 原快照?.ownerSubjectId === 当前SubjectId ? 原快照 : undefined;
  if (快照 === undefined) return null;
  if (快照.items.length === 0
    && (快照.阶段 === '未开始' || 快照.阶段 === '进行中' || 快照.阶段 === '失败')) {
    return null;
  }
  return 快照.items.filter((行) => 映射P5列表项(行).kind === '正常').length;
}

/** 招聘端终局历史：completed/ended 两个独立架子（原 Task 7 结构原样保留），共拥共享壳。 */
function 招聘终局架子组({ role, 返回 }: { role: P5角色; 返回: () => void }) {
  const { 后端状态, 操作 } = use应用状态();
  const 当前SubjectId = 后端状态.主体?.subject_id ?? null;

  // 两个架子各自的 scope 键（filterRef 恒 null：归档架无角色专属过滤）
  const completed键 = P5范围键.history(role, 'completed', null);
  const ended键 = P5范围键.history(role, 'ended', null);

  // 进屏 / 换主体：先注册两个架子的 scope 键，再分别懒加载（操作层栅栏靠注册的可见范围对上）。
  // 可见范围槽每个角色只有一格（设置P5范围 的语义）：后注册的键占住槽位，两架的在飞
  // 读写都由这枚槽位栅栏在离开本屏时整包作废；换键递增旧新 scope 代际对两架同样成立
  // （StrictMode 卸载重挂安全）。离开本屏清回 null。Mock 模式本组件不挂载，操作层也恒早退。
  useEffect(() => {
    if (当前SubjectId === null) return;
    操作.设置P5范围(role, completed键);
    操作.设置P5范围(role, ended键);
    void 操作.加载历史(role, 'completed', null).catch(() => undefined);
    void 操作.加载历史(role, 'ended', null).catch(() => undefined);
    return () => 操作.设置P5范围(role, null);
  }, [当前SubjectId, role, completed键, ended键, 操作]);

  // 数量说明与两架渲染同源同次：已成功加载的正常记录数（错误行不计；两架未开始不给假零）
  const completed数 = 架子已载数(后端状态, role, 'completed', 当前SubjectId);
  const ended数 = 架子已载数(后端状态, role, 'ended', 当前SubjectId);
  const 数量说明 = completed数 === null && ended数 === null
    ? null
    : `已加载 ${(completed数 ?? 0) + (ended数 ?? 0)} 单`;

  return (
    <历史代谈外壳 返回={返回} 数量说明={数量说明}>
      <div style={双架间距样式}>
        <历史架子
          role={role}
          lifecycle="completed"
          标题="已谈成"
          空文案="还没有谈成的候选。"
        />
        <历史架子
          role={role}
          lifecycle="ended"
          标题="已结束"
          空文案="没有已结束的候选。"
        />
      </div>
    </历史代谈外壳>
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

  // 只选本架子自己的快照：键按 lifecycle 隔离，另一架的数据天然进不来；owner 与当前
  // 主体不匹配（同角色换主体的过渡帧）时按不存在处理，绝不渲染旧主体 items
  const 当前SubjectId = 后端状态.主体?.subject_id ?? null;
  const 原快照 = 后端状态.P5历史?.[P5范围键.history(role, lifecycle, null)];
  const 快照: P5列表快照 | undefined = 原快照?.ownerSubjectId === 当前SubjectId ? 原快照 : undefined;

  // 展示映射逐行独立（行与视图 1:1 成对，契约错误行整行停用）；服务端顺序原样保留（不重排）
  const 行们 = useMemo(
    () => (快照?.items ?? []).map((行) => ({ 行, 视图: 映射P5列表项(行) })),
    [快照?.items],
  );

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
            {快照?.error && 行们.length > 0 && !快照.刷新中 ? (
              <div className={列表样式.错误行}>
                {快照.error}
                <button className={`${列表样式.重试键} 可点`} onClick={重读窗口}>
                  重试
                </button>
              </div>
            ) : null}

            {行们.length === 0 ? (
              <div className={列表样式.空态}>{空文案}</div>
            ) : (
              行们.map((条) =>
                条.视图.kind === '契约错误' ? (
                  <契约错误行 key={`契约错误_${条.行.state.caseId}`} 重试={重读窗口} />
                ) : (
                  <历史代谈卡
                    key={条.行.state.caseId}
                    信息={从招聘历史到卡(条.行, () => 跳转(路径.候选详情(条.行.state.caseId)))}
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

/** 契约错误行：fail closed —— 只给提示与重试，该行的部分数据一概不渲染（招聘端行）。 */
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
