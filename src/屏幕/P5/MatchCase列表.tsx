// P5 Task 4：双端 open 工作区列表（Backend 专用的共享组件；Mock 屏不渲染本组件）。
//
// 模式边界（spec §10.1 与 P5 冻结契约；J-PILOT-01 Task 4 修订候选半边）：
//   · 候选主列表 = 全意向连续 active 快照（me/negotiations shelf=active，恒省略
//     intention_id，覆盖全部意向），经 映射连续列表项 投影进共享 求职在谈卡；
//     不依赖当前意向有效才展示旧记录，也不读 Case open 工作区。键与导航唯一归属
//     canonical record_id（dlg_/mc_）。
//   · 招聘端继续 Case open 工作区快照（当前岗位 = owned job_id），经 映射P5列表项
//     投影进共享 招聘在谈卡；不读 连续集合（negotiation 是候选专属资源）。
//   · 服务端顺序原样保留（active：needs_action DESC, created_at DESC, record_id DESC）——
//     本组件不做任何客户端重排（Mock 屏的「需要你置顶」不搬过来）。
//   · 状态档（在谈看什么 / 企业在谈看什么）不读、不过滤（2026-09-09 删筛选层）；
//     候选连续主列表也不带任何意向过滤（Spec §5：默认覆盖全部意向）。
//   · 状态档（在谈看什么 / 企业在谈看什么：全部/待我拍板/进行中）本组件不读、不过滤
//     —— 2026-09-09 产品负责人：删筛选层，在谈只显示全部。列表恒为范围内全部行；
//     「我」页「待你拍」派发后档位落成 待我拍板 也照样显示全部，需要你的行靠服务端
//     needs_action DESC 已排在前，本组件原样保留。
//   · 未知契约行按展示映射 fail closed：整行只给契约错误提示 + 重试（重新 GET），
//     绝不渲染该行的部分数据（招聘端）；候选连续行由 facade decode 挡漂移，投影全函数。
//   · 首载失败给失败态 + 重试（force 重读首屏）；刷新/轮询失败保留旧条目只读，
//     错误单独一行交代（§10.3：错误态由操作层快照承载，页面给重试）。
//   · 可见 5 秒列表节拍交给 useMatchCase轮询（隐藏当拍跳过、卸载即停、
//     同目标在飞不并发）：候选 callback 调 刷新连续列表('active')，招聘调 刷新工作区；
//     本组件不持任何节拍。

import { useEffect, useMemo } from 'react';
import 样式 from './MatchCase列表.module.css';
import { 骨架卡组 } from '../../组件/通用';
import 招聘在谈卡 from '../../组件/列表卡片/招聘在谈卡';
import 求职在谈卡 from '../../组件/列表卡片/求职在谈卡';
import { use应用状态 } from '../../状态/应用状态';
import { use导航 } from '../../路由/导航钩子';
import { 路径 } from '../../路由/路径表';
import { 从招聘摘要到卡信息, 从P5到阶段, 从连续到阶段 } from '../../数据/列表卡片映射';
import { 映射连续列表项 } from '../../数据/连续代谈展示映射';
import { 映射P5列表项, P5契约错误提示 } from '../../数据/MatchCase展示映射';
import type { P5角色 } from '../../数据/MatchCase展示映射';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import { useMatchCase轮询 } from '../../状态/后端/useMatchCase轮询';
import type { P5连续列表快照, P5列表快照 } from '../../状态/后端/类型';

export function MatchCase列表(props: { role: P5角色; filterRef: string | null }) {
  // J-PILOT-01 Task 4：候选主列表接全意向连续集合（Spec §5），招聘端继续 Case open
  // 工作区（spec §4：招聘仍由 Case 列表承接）。Mock 模式本组件不挂载，操作层也恒早退。
  return props.role === 'candidate'
    ? <候选连续在谈 />
    // eslint-disable-next-line jsx-a11y/aria-role -- role 是 P5 域 prop，非 ARIA role
    : <Case在谈列表 role="recruiter" filterRef={props.filterRef} />;
}

/** J-PILOT-01 Task 4：候选主列表 = 全意向连续 active 快照。恒省略 intention_id：覆盖全部
 *  意向，不依赖当前意向有效才展示旧记录；顶部意向选择器只服务市场，这里不读任何意向档。
 *  键与导航唯一归属 canonical record_id；「加载更多」接 追加连续列表，轮询走 刷新连续列表，
 *  手动刷新（首载失败重试）用 force 首屏（丢旧游标）。 */
function 候选连续在谈() {
  const { 后端状态, 操作 } = use应用状态();
  const { 跳转 } = use导航();
  const scope键 = P5范围键.negotiations('active');
  // 只选当前主体自己的快照：owner 不匹配（同角色换主体的过渡帧）按不存在处理
  const 当前SubjectId = 后端状态.主体?.last_used_role === 'candidate'
    ? 后端状态.主体.subject_id
    : null;
  const 原快照 = 后端状态.P5连续列表?.[scope键];
  const 快照: P5连续列表快照 | undefined = 原快照?.ownerSubjectId === 当前SubjectId ? 原快照 : undefined;

  // 进屏 / 换主体：先注册连续 scope 再懒加载首屏（操作层栅栏靠注册的可见范围对上）；
  // 离开本屏清回 null。Mock 模式本组件不挂载，操作层也恒早退。
  useEffect(() => {
    if (当前SubjectId === null) return;
    操作.设置P5范围('candidate', scope键);
    void 操作.加载连续列表('active').catch(() => undefined);
    return () => 操作.设置P5范围('candidate', null);
  }, [当前SubjectId, scope键, 操作]);

  // 可见 5 秒列表节拍（spec §5：复用既有 hook 的 callback 调 刷新连续列表，不新增永久
  // timer）：刷新从首屏重建已载窗口；隐藏当拍跳过、卸载即停、单拍失败吞掉（错误态由
  // 快照承载，页面给重试）—— 都在钩子内实现。
  useMatchCase轮询({
    开启: 当前SubjectId !== null,
    列表: { role: 'candidate', filterRef: null },
    详情: null,
    详情终局: false,
    刷新列表: () => 操作.刷新连续列表('active'),
    刷新详情: async () => undefined,
  });

  // 展示映射逐行独立（decode 已 fail closed，投影是全函数）；服务端顺序原样保留（不重排）
  const 视图们 = useMemo(() => (快照?.items ?? []).map(映射连续列表项), [快照?.items]);

  const 载入中 = 快照 === undefined ||
    (快照.items.length === 0 && (快照.阶段 === '未开始' || 快照.阶段 === '进行中'));
  const 首载失败 = 快照 !== undefined && 快照.items.length === 0 && 快照.阶段 === '失败';
  const 游标未尽 = 快照 !== undefined && 快照.nextCursor !== null;

  const 重试首载 = () => void 操作.加载连续列表('active', true).catch(() => undefined);
  const 重读窗口 = () => void 操作.刷新连续列表('active').catch(() => undefined);
  const 追加一页 = () => void 操作.追加连续列表('active').catch(() => undefined);

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
          {/* 刷新/轮询失败：旧条目原样保留只读，错误单独一行交代 + 重试（同 Case 列表口径） */}
          {快照?.error && !快照.刷新中 ? (
            <div className={样式.错误行}>
              {快照.error}
              <button className={`${样式.重试键} 可点`} onClick={重读窗口}>
                重试
              </button>
            </div>
          ) : null}

          {视图们.length === 0 ? (
            // 错误在场时不下「没有在谈」的定论：那不是事实，只是这次没读到
            快照?.error && !快照.刷新中 ? null : <div className={样式.空态}>暂时没有在谈职位。</div>
          ) : (
            视图们.map((视图) => (
              // 候选卡（2026-09-10 卡片统一）：与 Mock 在谈单同一张 求职在谈卡。
              // 公司三件套与匹配分 negotiation 不提供 → 传 null 给未知占位；标签区 = 城市
              // （NegotiationJob 无技能段，城市缺失时由卡面给「标签信息未知」占位）。
              <求职在谈卡
                key={视图.recordId}
                公司={null}
                公司简介={null}
                公司字标={null}
                匹配分={null}
                薪资={视图.薪资带}
                职位={视图.职位名}
                标签={视图.城市 === null ? [] : [视图.城市]}
                阶段={从连续到阶段(视图)}
                打开={() => 跳转(路径.在谈详情(视图.recordId))}
              />
            ))
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

/** 招聘端 open 工作区列表（J-PILOT-01 起不再承接候选）：只来自当前岗位的 P5工作区 快照，
 *  经 映射P5列表项 投影；negotiation 是候选专属资源，招聘分支零连续读取。 */
function Case在谈列表({ role, filterRef }: { role: P5角色; filterRef: string | null }) {
  const { 后端状态, 操作 } = use应用状态();
  const { 跳转 } = use导航();

  // 只选当前 role+过滤 自己的快照：键按 scope 隔离，切换时旧 scope 数据天然进不来；
  // owner 与当前主体不匹配（同角色换主体的过渡帧）时按不存在处理，绝不渲染旧主体 items
  const scope键 = P5范围键.open(role, filterRef);
  const 当前SubjectId = 后端状态.主体?.subject_id ?? null;
  const 原快照 = 后端状态.P5工作区?.[scope键];
  const 快照: P5列表快照 | undefined = 原快照?.ownerSubjectId === 当前SubjectId ? 原快照 : undefined;

  // 进屏 / 换 scope / 换主体：先注册可见范围再懒加载（操作层栅栏靠注册的可见范围对上）；
  // 离开本屏或换 scope 清回 null。Mock 模式本组件不挂载，操作层也恒早退。
  useEffect(() => {
    if (当前SubjectId === null) return;
    操作.设置P5范围(role, scope键);
    void 操作.加载工作区(role, filterRef).catch(() => undefined);
    return () => 操作.设置P5范围(role, null);
  }, [当前SubjectId, role, filterRef, scope键, 操作]);

  // 可见 5 秒列表节拍（spec §10.3）：刷新已载窗口；隐藏当拍跳过、卸载即停、
  // 单拍失败吞掉（错误态由快照承载，页面给重试）—— 都在钩子内实现。
  useMatchCase轮询({
    开启: 当前SubjectId !== null,
    列表: { role, filterRef },
    详情: null,
    详情终局: false,
    刷新列表: (范围) => 操作.刷新工作区(范围.role, 范围.filterRef),
    刷新详情: async () => undefined,
  });

  // 展示映射逐行独立：契约错误行整行停用；服务端顺序原样保留（不重排）
  const 视图们 = useMemo(() => (快照?.items ?? []).map(映射P5列表项), [快照?.items]);

  const 载入中 = 快照 === undefined ||
    (快照.items.length === 0 && (快照.阶段 === '未开始' || 快照.阶段 === '进行中'));
  const 首载失败 = 快照 !== undefined && 快照.items.length === 0 && 快照.阶段 === '失败';
  const 游标未尽 = 快照 !== undefined && 快照.nextCursor !== null;

  // 状态档（在谈看什么 / 企业在谈看什么）不读、不过滤（2026-09-09 删筛选层）：
  // 空态只剩招聘端一句通用文案（列表真空才出现）。
  const 空文案 = '暂无在谈候选，去推荐里让AI代理接触几个';

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
          {/* 刷新/轮询失败：旧条目原样保留只读，错误单独一行交代 + 重试。
              Task 5：已有成功空缓存后刷新失败同样要出这一行 —— 旧实现用 视图们.length > 0
              把它挡掉，用户只看到一个正常空态，完全不知道这次没读到。 */}
          {快照?.error && !快照.刷新中 ? (
            <div className={样式.错误行}>
              {快照.error}
              <button className={`${样式.重试键} 可点`} onClick={重读窗口}>
                重试
              </button>
            </div>
          ) : null}

          {视图们.length === 0 ? (
            // 错误在场时不下「没有在谈」的定论：那不是事实，只是这次没读到
            快照?.error && !快照.刷新中 ? null : <div className={样式.空态}>{空文案}</div>
          ) : (
            视图们.map((视图, 下标) =>
              视图.kind === '契约错误' ? (
                <契约错误行 key={`契约错误_${下标}`} 重试={重读窗口} />
              ) : (
                // 招聘端卡（2026-09-10 卡片统一）：与 Mock 在谈候选共用 组件/列表卡片/招聘在谈卡 ——
                // 摘要经 从招聘摘要到卡信息 投影（null = 全未知占位），P5 open 无匹配分传 null，
                // 阶段/待办徽标/注意说明经 从P5到阶段 投影进卡底阶段区；别名/通用匿名头像/
                // 冻结职位事实段退场（候选卡面见 候选连续在谈），Case 跳转坐标不变。
                <招聘在谈卡
                  key={视图.caseId}
                  信息={从招聘摘要到卡信息(视图.候选摘要 ?? null)}
                  匹配分={null}
                  阶段={从P5到阶段(视图)}
                  打开={() => 跳转(路径.候选详情(视图.caseId))}
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

/** 契约错误行：fail closed —— 只给提示与重试，该行的部分数据一概不渲染（招聘端行）。 */
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
