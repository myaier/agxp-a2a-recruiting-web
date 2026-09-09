// P5 Task 4：双端 open 工作区列表（Backend 专用的共享组件；Mock 屏不渲染本组件）。
//
// 模式边界（spec §10.1 与 P5 冻结契约）：
//   · 列表只来自当前 role + 角色专属过滤（candidate=intention_id / recruiter=job_id）
//     的 P5工作区 快照，经 映射P5列表项 投影；不读 在谈列表/企业候选列表、不水合
//     Mock 在谈单/候选 对象、绝不 import Mock。
//   · 服务端 viewer-specific 顺序（needs_action DESC, updated_at DESC, case_id DESC）
//     原样保留 —— 本组件不做任何客户端重排（Mock 屏的「需要你置顶」不搬过来）。
//   · 状态档（在谈看什么 / 企业在谈看什么：全部/待我拍板/进行中）本组件不读、不过滤
//     —— 2026-09-09 产品负责人：删筛选层，在谈只显示全部。列表恒为范围内全部行；
//     「我」页「待你拍」派发后档位落成 待我拍板 也照样显示全部，需要你的行靠服务端
//     needs_action DESC 已排在前，本组件原样保留。
//   · 键与导航唯一归属 case_id；candidate_alias 只留在视图字段里供日志/测试，
//     招聘卡卡面不再显示（2026-09-09 摘要接线：卡面只渲染 candidate_summary 摘要）。
//   · 候选卡卡主体 = 组件/列表卡片/求职在谈卡（2026-09-10 卡片统一，与 Mock 在谈单同一张
//     卡面）：Case 冻结的工作区职位四事实照常显示（职位名 / 右列薪资带 / 城市在前技能随后
//     的标签区 / 阶段区），公司名/简介/图与匹配分 P5 当前不提供 → 传 null 给未知占位；
//     招聘卡卡主体 = 组件/列表卡片/招聘在谈卡：摘要经 从招聘摘要到卡信息 投影，P5 open 无
//     匹配分传 null（未知分占位），阶段/待办徽标经 从P5到阶段 投影进卡底阶段区。
//   · 未知契约行按展示映射 fail closed：整行只给契约错误提示 + 重试（重新 GET），
//     绝不渲染该行的部分数据。
//   · 首载失败给失败态 + 重试（force 重读）；刷新/轮询失败保留旧条目只读，
//     错误单独一行交代（§10.3：错误态由操作层快照承载，页面给重试）。
//   · 可见 5 秒列表节拍交给 useMatchCase轮询（隐藏当拍跳过、卸载即停、
//     同目标在飞不并发）；本组件不持任何节拍。

import { useEffect, useMemo } from 'react';
import 样式 from './MatchCase列表.module.css';
import { 骨架卡组 } from '../../组件/通用';
import 招聘在谈卡 from '../../组件/列表卡片/招聘在谈卡';
import 求职在谈卡 from '../../组件/列表卡片/求职在谈卡';
import { use应用状态 } from '../../状态/应用状态';
import { use导航 } from '../../路由/导航钩子';
import { 路径 } from '../../路由/路径表';
import { 从招聘摘要到卡信息, 从P5到阶段 } from '../../数据/列表卡片映射';
import { 映射P5列表项, P5契约错误提示 } from '../../数据/MatchCase展示映射';
import type { P5角色, P5列表正常视图 } from '../../数据/MatchCase展示映射';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import { useMatchCase轮询 } from '../../状态/后端/useMatchCase轮询';
import type { P5列表快照 } from '../../状态/后端/类型';

/** 候选端卡（2026-09-10 卡片统一）：与 Mock 在谈单共用 组件/列表卡片/求职在谈卡。
 *  只投影冻结职位快照：职位名 + 右列薪资带 + 标签区（城市在前、技能随后）+ 阶段区；
 *  P5 当前不提供公司名/简介/图与匹配分，四个 props 传 null 由卡面给未知占位 ——
 *  不向 owner Job / 推荐缓存 / Organization 补齐，也不触发 use适配分 的 Mock 计算路径。 */
function 候选在谈卡({ 视图, 按下 }: { 视图: P5列表正常视图; 按下: () => void }) {
  return (
    <求职在谈卡
      公司={null}
      公司简介={null}
      公司字标={null}
      匹配分={null}
      薪资={视图.职位.薪资带}
      职位={视图.职位.职位名}
      标签={[视图.职位.城市, ...视图.职位.技能]}
      阶段={从P5到阶段(视图)}
      打开={按下}
    />
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
  const { 数据源模式, 后端状态, 操作 } = use应用状态();
  const { 跳转 } = use导航();
  const 是后端 = 数据源模式 === 'backend';
  // 2026-09-09 产品负责人：删筛选层，在谈只显示全部 —— 状态里的 在谈看什么 / 企业在谈看什么
  // 本组件不再读（字段与归约在状态层保留，「我」页「待你拍」仍会派发成 待我拍板，但这里不认档）。

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
  // 2026-09-09 产品负责人：删筛选层，在谈只显示全部 —— 原按 看什么 档滤 needs_action 的
  // 过滤已删，渲染的就是 视图们 本身（范围内全部行；服务端 needs_action DESC 的置顶原样保留）。

  const 载入中 = 快照 === undefined ||
    (快照.items.length === 0 && (快照.阶段 === '未开始' || 快照.阶段 === '进行中'));
  const 首载失败 = 快照 !== undefined && 快照.items.length === 0 && 快照.阶段 === '失败';
  const 游标未尽 = 快照 !== undefined && 快照.nextCursor !== null;

  // 2026-09-09 产品负责人：删筛选层，在谈只显示全部 —— 「没有待我拍板的职位」这类按档写的
  // 空文案随之删除；档不再区分，空态只剩双端各一句通用文案（列表真空才出现）。
  const 空文案 = role === 'candidate'
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
              ) : role === 'candidate' ? (
                <候选在谈卡
                  key={视图.caseId}
                  视图={视图}
                  按下={() => 跳转(路径.在谈详情(视图.caseId))}
                />
              ) : (
                // 招聘端卡（2026-09-10 卡片统一）：与 Mock 在谈候选共用 组件/列表卡片/招聘在谈卡 ——
                // 摘要经 从招聘摘要到卡信息 投影（null = 全未知占位），P5 open 无匹配分传 null，
                // 阶段/待办徽标/注意说明经 从P5到阶段 投影进卡底阶段区；别名/通用匿名头像/
                // 冻结职位事实段退场（候选卡面见 候选在谈卡），Case 跳转坐标不变。
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
