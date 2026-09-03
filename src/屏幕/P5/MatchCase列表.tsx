// P5 Task 4：双端 open 工作区列表（Backend 专用的共享组件；Mock 屏不渲染本组件）。
//
// 模式边界（spec §10.1 与 P5 冻结契约）：
//   · 列表只来自当前 role + 角色专属过滤（candidate=intention_id / recruiter=job_id）
//     的 P5工作区 快照，经 映射P5列表项 投影；不读 在谈列表/企业候选列表、不水合
//     Mock 在谈单/候选 对象、绝不 import Mock。
//   · 服务端 viewer-specific 顺序（needs_action DESC, updated_at DESC, case_id DESC）
//     原样保留 —— 本组件不做任何客户端重排（Mock 屏的「需要你置顶」不搬过来）。
//   · 状态档（待我拍板/进行中）是纯视图过滤，只滤「当前已载窗口」里各行的
//     viewer 专属 needs_action；游标未尽时不下「没有」的结论、不声称全量总数。
//   · 键与导航唯一归属 case_id；candidate_alias 是不透明展示文本：原样带出、
//     不截断不派生，头像用与别名无关的通用匿名图标（每行同一副）。
//   · 候选卡只渲染 Case 冻结的工作区职位四事实（职位名/城市/薪资带/技能）；
//     招聘卡额外渲染 Case 别名。没有公司/画像/匹配分 —— 那些是 P5.1 依赖。
//   · 未知契约行按展示映射 fail closed：整行只给契约错误提示 + 重试（重新 GET），
//     绝不渲染该行的部分数据。
//   · 首载失败给失败态 + 重试（force 重读）；刷新/轮询失败保留旧条目只读，
//     错误单独一行交代（§10.3：错误态由操作层快照承载，页面给重试）。
//   · 可见 5 秒列表节拍交给 useMatchCase轮询（隐藏当拍跳过、卸载即停、
//     同目标在飞不并发）；本组件不持任何节拍。

import { useEffect, useMemo } from 'react';
import 样式 from './MatchCase列表.module.css';
import { 白卡, 骨架卡组 } from '../../组件/通用';
import { 人像图标 } from '../../组件/图标';
import { use应用状态 } from '../../状态/应用状态';
import type { 看什么档 } from '../../状态/应用状态';
import { use导航 } from '../../路由/导航钩子';
import { 路径 } from '../../路由/路径表';
import { 映射P5列表项, P5契约错误提示 } from '../../数据/MatchCase展示映射';
import type { P5角色, P5列表正常视图 } from '../../数据/MatchCase展示映射';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import { useMatchCase轮询 } from '../../状态/后端/useMatchCase轮询';
import type { P5列表快照 } from '../../状态/后端/类型';

/** viewer 专属动作归属徽标：needs_action=true → 需要你；否则 attention 行 → 需注意
 *  （owner-safe：绝不把 hosted agent 失败显示成「代理处理中」）；其余 → 代理处理中。 */
function 待办徽标({ 待办, 注意说明 }: { 待办: boolean; 注意说明: string | null }) {
  const copy = 待办 ? '需要你' : 注意说明 !== null ? '需注意' : '代理处理中';
  const tone = 待办 || 注意说明 !== null ? 样式.徽标待办 : 样式.徽标代理;
  return <span className={`${样式.徽标} ${tone}`}>{copy}</span>;
}

/** 冻结职位四事实的展示段（职位名/城市·薪资带/技能标签），双端卡共用。 */
function 职位段({ 视图 }: { 视图: P5列表正常视图 }) {
  return (
    <>
      <div className={`${样式.事实行} 单行`}>
        {视图.职位.城市} · {视图.职位.薪资带}
      </div>
      <div className={样式.标签行}>
        {视图.职位.技能.map((技能) => (
          <span key={技能} className={样式.标签}>
            {技能}
          </span>
        ))}
      </div>
    </>
  );
}

/** 阶段行：阶段标题 + 状态文案（权威是 state.lifecycle/stage/status，无服务端下一步字段）。
 *  attention 行在状态头后追加 owner-safe 说明（纯文本，零操作）。 */
function 阶段段({ 视图 }: { 视图: P5列表正常视图 }) {
  return (
    <div className={样式.阶段区}>
      <div className={样式.阶段头}>
        <span className={样式.阶段标}>{视图.阶段标题}</span>
        <span className={`${样式.状态文} 单行`}>{视图.状态文案}</span>
        <span className={样式.尖括号}>›</span>
      </div>
      {视图.注意说明 !== null ? (
        <div className={样式.注意说明}>{视图.注意说明}</div>
      ) : null}
    </div>
  );
}

/** 候选端卡：只渲染冻结工作区职位上下文（无公司/画像/匹配分 —— P5.1 依赖）。 */
function 候选在谈卡({ 视图, 按下 }: { 视图: P5列表正常视图; 按下: () => void }) {
  return (
    <白卡 按下={按下} 类名={样式.卡}>
      <div className={样式.头行}>
        <div className={`${样式.职位名} 单行`}>{视图.职位.职位名}</div>
        <待办徽标 待办={视图.待办} 注意说明={视图.注意说明} />
      </div>
      <职位段 视图={视图} />
      <阶段段 视图={视图} />
    </白卡>
  );
}

/** 招聘端卡：Case 别名原样 + 与别名无关的通用匿名头像 + 冻结工作区职位上下文。 */
function 招聘在谈卡({ 视图, 按下 }: { 视图: P5列表正常视图; 按下: () => void }) {
  return (
    <白卡 按下={按下} 类名={样式.卡}>
      <div className={样式.头行}>
        {/* 通用匿名头像：不取别名首字、不按别名散列，每一行都是同一副 */}
        <span className={样式.匿名头像} aria-hidden="true">
          <人像图标 尺寸={16} 色="var(--次要浅)" />
        </span>
        <span className={`${样式.代号} 单行`}>{视图.candidateAlias}</span>
        <待办徽标 待办={视图.待办} 注意说明={视图.注意说明} />
      </div>
      <div className={`${样式.职位名} 单行`}>{视图.职位.职位名}</div>
      <职位段 视图={视图} />
      <阶段段 视图={视图} />
    </白卡>
  );
}

/** 契约错误行：fail closed —— 只给提示与重试，该行的部分数据一概不渲染。 */
function 契约错误行({ 重试 }: { 重试: () => void }) {
  return (
    <div className={样式.契约错误行}>
      <div>{P5契约错误提示}</div>
      <button className={`${样式.重试键} 可点`} onClick={重试}>
        重试
      </button>
    </div>
  );
}

export function MatchCase列表(props: { role: P5角色; filterRef: string | null }) {
  const { role, filterRef } = props;
  const { 状态, 数据源模式, 后端状态, 操作 } = use应用状态();
  const { 跳转 } = use导航();
  const 是后端 = 数据源模式 === 'backend';
  // 状态档是全局纯视图态：双端各认各的档（在谈看什么 / 企业在谈看什么）
  const 看什么: 看什么档 = role === 'candidate' ? 状态.在谈看什么 : 状态.企业在谈看什么;

  // 只选当前 role+过滤 自己的快照：键按 scope 隔离，切换时旧 scope 数据天然进不来；
  // owner 与当前主体不匹配（同角色换主体的过渡帧）时按不存在处理，绝不渲染旧主体 items
  const scope键 = P5范围键.open(role, filterRef);
  const 当前SubjectId = 后端状态.主体?.subject_id ?? null;
  const 原快照 = 后端状态.P5工作区?.[scope键];
  const 快照: P5列表快照 | undefined = 原快照?.ownerSubjectId === 当前SubjectId ? 原快照 : undefined;

  // 进屏 / 换 scope / 换主体：先注册可见范围再懒加载（操作层栅栏靠注册的可见范围对上）；
  // 离开本屏或换 scope 清回 null。Mock 模式本组件不挂载，操作层也恒早退。
  useEffect(() => {
    if (!是后端 || 当前SubjectId === null) return;
    操作.设置P5范围(role, scope键);
    void 操作.加载工作区(role, filterRef).catch(() => undefined);
    return () => 操作.设置P5范围(role, null);
  }, [是后端, 当前SubjectId, role, filterRef, scope键, 操作]);

  // 可见 5 秒列表节拍（spec §10.3）：刷新已载窗口；隐藏当拍跳过、卸载即停、
  // 单拍失败吞掉（错误态由快照承载，页面给重试）—— 都在钩子内实现。
  useMatchCase轮询({
    开启: 是后端,
    列表: { role, filterRef },
    详情: null,
    详情终局: false,
    刷新列表: (范围) => 操作.刷新工作区(范围.role, 范围.filterRef),
    刷新详情: async () => undefined,
  });

  // 展示映射逐行独立：契约错误行整行停用；服务端顺序原样保留（不重排）
  const 视图们 = useMemo(() => (快照?.items ?? []).map(映射P5列表项), [快照?.items]);
  // 状态档只滤已载条目的 needs_action；契约错误行不受档过滤影响（失败必须可见）
  const 过滤后 = 看什么 === '全部'
    ? 视图们
    : 视图们.filter((视图) =>
        视图.kind === '契约错误' ? true : 看什么 === '待我拍板' ? 视图.待办 : !视图.待办);

  const 载入中 = 快照 === undefined ||
    (快照.items.length === 0 && (快照.阶段 === '未开始' || 快照.阶段 === '进行中'));
  const 首载失败 = 快照 !== undefined && 快照.items.length === 0 && 快照.阶段 === '失败';
  const 游标未尽 = 快照 !== undefined && 快照.nextCursor !== null;

  const 名词 = role === 'candidate' ? '职位' : '候选';
  const 空文案 = 看什么 !== '全部'
    ? 游标未尽
      ? `已读入的里没有${看什么}的${名词}，加载更多后再看。`
      : `没有${看什么}的${名词}`
    : role === 'candidate'
      ? '暂时没有在谈职位。'
      : '暂无在谈候选，去推荐里让AI代理接触几个';

  const 重试首载 = () => void 操作.加载工作区(role, filterRef, true).catch(() => undefined);
  const 重读窗口 = () => void 操作.刷新工作区(role, filterRef).catch(() => undefined);
  const 追加一页 = () => void 操作.追加工作区(role, filterRef).catch(() => undefined);

  return (
    <div className={样式.列表}>
      {载入中 ? (
        <骨架卡组 张数={3} />
      ) : 首载失败 ? (
        <div className={样式.空态}>
          <div className={样式.空态标题}>在谈暂时加载不了</div>
          <div className={样式.空态说明}>{快照?.error}</div>
          <button className={`${样式.重试键} 可点`} onClick={重试首载}>
            重试
          </button>
        </div>
      ) : (
        <>
          {/* 刷新/轮询失败：旧条目原样保留只读，错误单独一行交代 + 重试 */}
          {快照?.error && 视图们.length > 0 && !快照.刷新中 ? (
            <div className={样式.错误行}>
              {快照.error}
              <button className={`${样式.重试键} 可点`} onClick={重读窗口}>
                重试
              </button>
            </div>
          ) : null}

          {过滤后.length === 0 ? (
            <div className={样式.空态}>{空文案}</div>
          ) : (
            过滤后.map((视图, 下标) =>
              视图.kind === '契约错误' ? (
                <契约错误行 key={`契约错误_${下标}`} 重试={重读窗口} />
              ) : role === 'candidate' ? (
                <候选在谈卡
                  key={视图.caseId}
                  视图={视图}
                  按下={() => 跳转(路径.在谈详情(视图.caseId))}
                />
              ) : (
                <招聘在谈卡
                  key={视图.caseId}
                  视图={视图}
                  按下={() => 跳转(路径.候选详情(视图.caseId))}
                />
              ),
            )
          )}

          {/* 加载更多透传快照里的不透明 next_cursor（游标归操作层持有）；读尽即藏 */}
          {游标未尽 ? (
            <button className={`${样式.追加键} 可点`} onClick={追加一页}>
              加载更多
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
