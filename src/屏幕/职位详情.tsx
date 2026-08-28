// A18 职位详情 —— 从「看市场」点职位卡进来，是用户做选择之前看到的岗位全貌页。
//
// 两条路径的入口（2026-08 重排后）：
//   · 直接聊      —— 发布人卡右侧小按钮：双方互相看到身份，AI代理退成旁听；
//   · 让AI代理去谈 —— 底部浮动胶囊条主键：走匿名初筛，委托后原地切到在谈详情。
// 浮动条左侧的 🚫 圆钮 = 不感兴趣：从看市场流里剔除这个岗并回列表。
//
// 内容顺序：职位名 + 薪资 → 标签（含发布于）→ 匹配度分析 → JD → 公司(加厚) → 发布人。
// 2026-08-26 用户指定:发布人挪到公司之下(先认识公司,再认识人);公司区块参考
// 海外求职 App 的公司卡加厚——介绍段 + 融资阶段/规模/行业/成立/地址,数据读 公司档案。
//
// P4 模式边界：Backend 路由只吃 P4 权威数据 —— 先在候选岗位快照里按 job_id 找卡
// （有推荐坐标，可反馈可委托），快照没有再读详情缓存 / GET 单个 CandidateJob；
// 绝不回退 市场列表[0]，未知/不可见 Job 给安全不可用页。详情直取（无推荐坐标）
// 渲染权威详情但禁用 不感兴趣 与 委托 —— 缺 recommendation_id 就绝不猜坐标。
// 委托每次都过 确认层 披露确认，成功后原地停留（不跳 P5 在谈详情、不造本地 Case）；
// 直聊入口整体隐藏（P4 没有直聊许可/会话坐标）；公司槽只在 hiring_organization_ref
// 在场时可进公开企业页。Mock 分支保持原型行为原样。

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import 样式 from './职位详情.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { 谈判图标, 禁止图标 } from '../组件/图标';
import 举报层 from '../组件/举报层';
import { 轻提示 } from '../组件/轻提示';
import { 市场列表, 取市场岗位详情 } from '../数据/模拟数据';
import type { 市场职位 } from '../数据/类型';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import 弹层框架 from '../组件/弹层框架';
import { 公司路由键 } from '../数据/公司档案';
import { 公司区块 } from '../组件/公司区块';
import { 匹配对齐卡 } from '../组件/匹配对齐卡';
import { 求职侧对齐行 } from '../数据/匹配对齐';
import { 从P4候选岗位, 从P4CandidateJob } from '../数据/发现推荐映射';
import type { P4候选岗位页面 } from '../数据/招聘数据源类型';
import { P4错误文案, P4范围键 } from '../状态/后端/发现推荐操作';
import { P4委托进度未知文案, use发现推荐委托轮询 } from '../状态/后端/use发现推荐委托轮询';
import 确认层 from '../组件/确认层';

export default function 职位详情() {
  const { 数据源模式 } = use应用状态();
  return 数据源模式 === 'backend' ? <Backend职位详情 /> : <Mock职位详情 />;
}

/** Mock 原型分支：静态市场表 + 全局归约，行为与接线前逐字一致。 */
function Mock职位详情() {
  const { id: 编号 } = useParams<{ id: string }>();
  const { 状态, 派发 } = use应用状态();
  const { 返回, 替换跳转 } = use导航();

  // 「⋯」拉起的更多操作抽屉是否展开
  const [抽屉展开, 设抽屉展开] = useState(false);
  // 举报层（从更多操作抽屉里进）
  const [举报层开, 设举报层开] = useState(false);

  // 按路由参数取岗位；直接输 URL 或参数丢失时退回第一条，
  // 保证这一屏永远有内容可渲染，不会白屏。
  const 岗 = 市场列表.find((条) => 条.编号 === 编号) ?? 市场列表[0];
  // 举报/屏蔽的对象是这个岗位所属的公司，取自岗位数据本身，
  // 不用下面公司卡里的静态 mock —— 用户屏蔽的是他刚才在列表里看到的那一家
  const 岗位公司名 = 岗.公司;
  // 已经委托过的岗位，主按钮换成「AI代理已接手」，和「看市场」卡片上的状态标口径一致
  const 已委托 = 状态.已委托.includes(岗.编号);

  return (
    <次级页外壳>
      <返回栏
        返回={返回}
        右侧={
          <div className={样式.工具组}>
            <button
              className={`${样式.工具符} 可点`}
              onClick={() => 设抽屉展开(true)}
              aria-label="更多操作"
            >
              ⋯
            </button>
          </div>
        }
      />

      <滚动区>
        <职位正文 岗={岗} />
      </滚动区>

      {/* 底部浮动胶囊条：悬浮在滚动内容之上，🚫（不感兴趣）+ 主键（让AI代理去谈） */}
      <div className={样式.浮动条}>
        <button
          className={`${样式.圆形次按钮} 可点`}
          aria-label="不感兴趣"
          onClick={() => {
            // 和「⋯ → 不感兴趣」同一动作：从看市场流剔除 + 代理负反馈样本，随后回列表
            派发({ 型: '不感兴趣', 编号: 岗.编号 });
            返回();
          }}
        >
          <禁止图标 尺寸={18} 色="var(--次要)" />
        </button>
        <button
          className={`${样式.主按钮} ${已委托 ? 样式.已委托态 : '可点'}`}
          disabled={已委托}
          onClick={() => {
            // 标注意见 #8：点了不是回列表，而是这个岗位当场变成一个在谈单 ——
            // 代理立刻主动打招呼，页面原地切到在谈详情（replace，后退不回本页），
            // 首页在谈列表里同时多出这张卡
            派发({ 型: '委托入谈', 岗 });
            替换跳转(路径.在谈详情(岗.编号));
          }}
        >
          <谈判图标 尺寸={15} 色={已委托 ? 'var(--深绿)' : undefined} />
          <span className={样式.主按钮文字}>{已委托 ? 'AI代理已接手' : '让AI代理去谈'}</span>
        </button>
      </div>

      {/* 「⋯」更多操作抽屉：点遮罩或「取消」关闭 */}
      {抽屉展开 ? (
        <弹层框架 标签="职位更多操作" 遮罩类名={样式.遮罩} 面板类名={样式.抽屉} 关闭={() => 设抽屉展开(false)}>
            <button
              className={`${样式.抽屉项} 可点`}
              onClick={() => {
                // 真的落到全局：这个岗从看市场的职位流里消失，同时是代理的负反馈样本，
                // 所以提示语说的是「代理会记住」而不是「已隐藏」
                派发({ 型: '不感兴趣', 编号: 岗.编号 });
                设抽屉展开(false);
                轻提示('已不再推荐，代理会记住这类岗位');
                返回();
              }}
            >
              不感兴趣，别再推给我
            </button>
            <button
              className={`${样式.抽屉项} 可点`}
              onClick={() => {
                设抽屉展开(false);
                设举报层开(true);
              }}
            >
              举报这个职位
            </button>
            <button
              className={`${样式.抽屉项} ${样式.抽屉取消} 可点`}
              onClick={() => 设抽屉展开(false)}
            >
              取消
            </button>
        </弹层框架>
      ) : null}

      {举报层开 ? (
        <举报层
          对象名={`${岗.职位} · ${岗位公司名}`}
          屏蔽名称={岗位公司名}
          关闭={() => 设举报层开(false)}
        />
      ) : null}
    </次级页外壳>
  );
}

/** Backend 分支（P4）：只吃候选岗位快照 / 详情缓存 / 单个 CandidateJob GET 的权威数据。 */
function Backend职位详情() {
  const { id: 编号 } = useParams<{ id: string }>();
  const { 后端状态, 操作 } = use应用状态();
  const { 返回 } = use导航();

  // 「⋯」拉起的更多操作抽屉是否展开
  const [抽屉展开, 设抽屉展开] = useState(false);
  // 详情读取的非 404 错误文案（404 走统一不可用页，不进这里）
  const [读取错误, 设读取错误] = useState<string | null>(null);
  // 反馈/委托写进行中：并发写会被操作层单飞丢弃，动作键统一禁用防静默丢点击
  const [写中, 设写中] = useState(false);
  // 本次要委托的卡：确认层只在它非空时挂载，确认后立刻清（不复用授权）
  const [待确认视图, 设待确认视图] = useState<P4候选岗位页面 | null>(null);

  // 进屏先注册可见范围（操作层栅栏要靠它对上），离开即清，别让别的屏背上旧范围
  useEffect(() => {
    if (!编号) return;
    操作.设置发现推荐范围?.('candidate', P4范围键.候选详情(编号));
    return () => 操作.设置发现推荐范围?.('candidate', null);
  }, [编号, 操作]);

  // 先在候选岗位快照里按 job.job_id 找推荐卡：命中即有当前卡的推荐坐标
  // （intention_id + recommendation_id），反馈与委托都只用它，绝不猜。
  const 推荐卡 = useMemo(() => {
    if (!编号) return null;
    for (const 快照 of Object.values(后端状态.候选岗位推荐 ?? {})) {
      const 命中 = 快照.items.find((卡) => 卡.job.job_id === 编号);
      if (命中) return 命中;
    }
    return null;
  }, [后端状态.候选岗位推荐, 编号]);

  // 权威 Job：快照卡自带完整 CandidateJob（详情优先复用卡），没有才靠缓存 / GET
  const 岗位 = 推荐卡?.job ?? (编号 ? 后端状态.候选岗位详情?.[编号] ?? null : null);
  const 不可用 = 编号 !== undefined && (后端状态.候选岗位不可用 ?? []).includes(编号);

  // 快照与缓存都没有：GET 单个 CandidateJob。404 已由操作层收口成不可用标记（不抛）；
  // 其余错误落到 读取错误，给明确重试。
  useEffect(() => {
    if (!编号 || 岗位 || 不可用) return;
    let 已失效 = false;
    const 读取 = 操作.读取候选岗位详情?.(编号);
    if (读取) {
      void 读取.catch((错误: unknown) => {
        if (!已失效) 设读取错误(P4错误文案(错误));
      });
    }
    return () => {
      已失效 = true;
    };
  }, [编号, 岗位, 不可用, 操作]);

  // 推荐卡路径带真实匹配分与推荐坐标；详情直取路径 wire 上没有这些，置 null/0 不编造
  const 视图 = useMemo(
    () => (岗位 === null ? null : 推荐卡 !== null ? 从P4候选岗位(推荐卡) : 从P4CandidateJob(岗位)),
    [岗位, 推荐卡]
  );

  // 本页唯一可见的进行中委托（accepted/evaluating）；详情直取没有推荐坐标，恒空
  const 进行中委托 = useMemo(() => {
    const 委托 = 推荐卡?.delegation;
    return 委托 !== null && 委托 !== undefined &&
        (委托.state === 'accepted' || 委托.state === 'evaluating')
      ? [{ role: 'candidate' as const, delegationId: 委托.delegation_id, state: 委托.state }]
      : [];
  }, [推荐卡]);
  const 进度未知 = use发现推荐委托轮询({
    开启: true,
    委托: 进行中委托,
    刷新: 操作.刷新委托,
  });

  const 重试读取 = () => {
    if (!编号) return;
    设读取错误(null);
    const 读取 = 操作.读取候选岗位详情?.(编号, true);
    if (读取) void 读取.catch((错误: unknown) => 设读取错误(P4错误文案(错误)));
  };

  // 确认层只在这里真正发起委托：先收层再 await —— 失败后下一次点击必须重新确认
  const 执行候选委托 = async (候选视图: P4候选岗位页面) => {
    if (!候选视图.recommendationId || !候选视图.intentionId) return;
    设待确认视图(null);
    设写中(true);
    try {
      await 操作.委托候选岗位({
        intentionId: 候选视图.intentionId,
        recommendationId: 候选视图.recommendationId,
        jobId: 候选视图.jobId,
        disclosureAcknowledged: true,
      });
    } catch (错误) {
      轻提示(P4错误文案(错误));
    } finally {
      设写中(false);
    }
  };

  // 不感兴趣：服务端先行，PUT 成功（或 404 收口）才回列表；失败原地提示不移动
  const 标记不感兴趣 = async () => {
    if (!推荐卡) return;
    设写中(true);
    try {
      await 操作.标记岗位不感兴趣(推荐卡.intention_id, 推荐卡.recommendation_id);
      返回();
    } catch (错误) {
      轻提示(P4错误文案(错误));
    } finally {
      设写中(false);
    }
  };

  // ── 加载 / 错误 / 安全不可用页：真实 DTO 到手前不给任何 Mock 内容 ──
  if (视图 === null) {
    const 不可用态 = 不可用;
    return (
      <次级页外壳>
        <返回栏 返回={返回} />
        <滚动区>
          <div className={样式.后端态}>
            <div className={样式.后端态标题}>
              {不可用态 ? '这个职位暂时看不了' : 读取错误 !== null ? '职位暂时加载不了' : '正在加载职位详情…'}
            </div>
            {不可用态 ? (
              <div className={样式.后端态说明}>该职位可能已下架，或已不在你的推荐范围内。</div>
            ) : 读取错误 !== null ? (
              <>
                <div className={样式.后端态说明}>{读取错误}</div>
                <button className={`${样式.后端态按钮} 可点`} onClick={重试读取}>
                  重试
                </button>
              </>
            ) : null}
          </div>
        </滚动区>
      </次级页外壳>
    );
  }

  const 委托摘要 = 推荐卡?.delegation ?? null;
  const 已委托 = 委托摘要 !== null;
  // 轮询连败的委托：把「已接手」覆盖成中性文案，绝不伪造终态回执
  const 主键文字 = 已委托
    ? (委托摘要 !== null && 进度未知.has(委托摘要.delegation_id)
      ? P4委托进度未知文案
      : 'AI代理已接手')
    : '让AI代理去谈';
  const 动作可用 = 推荐卡 !== null && !写中;

  return (
    <次级页外壳>
      <返回栏
        返回={返回}
        右侧={
          // 无推荐坐标时抽屉里没有可做的推荐动作（举报也无 P4 坐标），⋯ 不出
          推荐卡 !== null ? (
            <div className={样式.工具组}>
              <button
                className={`${样式.工具符} 可点`}
                onClick={() => 设抽屉展开(true)}
                aria-label="更多操作"
              >
                ⋯
              </button>
            </div>
          ) : undefined
        }
      />

      <滚动区>
        <职位正文 岗={视图.卡} P4视图={视图} />
      </滚动区>

      {/* 底部浮动胶囊条：🚫（不感兴趣）+ 主键（让AI代理去谈 / 已接手状态标） */}
      <div className={样式.浮动条}>
        <button
          className={`${样式.圆形次按钮} ${动作可用 ? '可点' : ''}`}
          aria-label="不感兴趣"
          disabled={!推荐卡 || 写中}
          onClick={() => void 标记不感兴趣()}
        >
          <禁止图标 尺寸={18} 色="var(--次要)" />
        </button>
        <button
          className={`${样式.主按钮} ${已委托 ? 样式.已委托态 : 动作可用 ? '可点' : ''}`}
          disabled={!推荐卡 || 已委托 || 写中}
          onClick={() => 设待确认视图(视图)}
        >
          <谈判图标 尺寸={15} 色={已委托 ? 'var(--深绿)' : undefined} />
          <span className={样式.主按钮文字}>{主键文字}</span>
        </button>
      </div>

      {/* 「⋯」更多操作抽屉：不感兴趣与浮动条同一动作（服务端先行，成功才回列表） */}
      {抽屉展开 ? (
        <弹层框架 标签="职位更多操作" 遮罩类名={样式.遮罩} 面板类名={样式.抽屉} 关闭={() => 设抽屉展开(false)}>
            <button
              className={`${样式.抽屉项} 可点`}
              disabled={写中}
              onClick={() => {
                设抽屉展开(false);
                void 标记不感兴趣();
              }}
            >
              不感兴趣，别再推给我
            </button>
            <button
              className={`${样式.抽屉项} ${样式.抽屉取消} 可点`}
              onClick={() => 设抽屉展开(false)}
            >
              取消
            </button>
        </弹层框架>
      ) : null}

      {待确认视图 ? (
        <确认层
          标题="确认委托AI代理？"
          正文="S0 通过后，本 Case 可按固定规则提交默认/已选 PDF，并向该招聘方披露姓名和联系方式。"
          执行文="确认委托"
          取消文="暂不委托"
          取消={() => 设待确认视图(null)}
          执行={() => void 执行候选委托(待确认视图)}
        />
      ) : null}
    </次级页外壳>
  );
}

/** 四档条里每一块的配色。
 *  当前档用深绿实心；序号 1 那一块固定用中灰（RN 源里就是硬编码 序===1，
 *  不是「当前档减一」，这里保持一致以免像素对不上）；其余用更浅的灰。 */
/** 匹配维度：岗位字段 × 简历侧事实 → 逐行核对。
 *  值一律「你的值 → 岗位的值」或单值事实，不写解释句。 */
// ── 职位正文（共享）：职位名/薪资 → 发布人 → 匹配度分析 → JD → 公司 ──
// 2026-08-24 从本屏抽出：直聊会话顶部「看职位」层要铺同一份内容
// （产品负责人：「这私信的两个人点开后为什么还不一样」）。
// 藏直聊：在直聊会话的层里已经在和发布人聊天，「直接聊」按钮没有意义，藏掉。
// P4：Backend 传 P4视图 时整页改吃映射后的权威数据（JD/公司/发布人），
// 直聊入口同样隐藏 —— P4 没有建立直聊许可或会话坐标。
export function 职位正文({
  岗,
  藏直聊 = false,
  P4视图,
}: {
  岗: 市场职位;
  藏直聊?: boolean;
  /** Backend 候选岗位视图；缺省走 Mock 的 取市场岗位详情（直聊会话等调用方不变） */
  P4视图?: P4候选岗位页面;
}) {
  const { 状态, 数据源模式 } = use应用状态();
  const { 跳转 } = use导航();
  const 是后端 = 数据源模式 === 'backend';
  // 视图只在「Backend 且调用方给了 P4视图」时生效：Mock 调用方不传，行为不变
  const 视图 = 是后端 && P4视图 ? P4视图 : null;
  const 详 = 取市场岗位详情(岗);

  // 详情直取（recommendationId === null）wire 上没有匹配分：藏环不伪造 0 分
  const 藏匹配环 = 视图 !== null && 视图.recommendationId === null;

  // 公司槽落点：Backend 只认 hiring_organization_ref（claim 不是组织坐标）；
  // Mock 仍按原公司名 slug 进企业详情
  let 公司跳转: (() => void) | undefined;
  if (视图 !== null) {
    const 组织编号 = 视图.公司.organizationId;
    if (组织编号 !== null) 公司跳转 = () => 跳转(路径.企业详情(组织编号));
  } else if (!是后端) {
    公司跳转 = () => 跳转(路径.企业详情(公司路由键(详.公司.名称)));
  }

  // 发布人：wire 缺席 → 整卡不渲染，绝不拿公司声明合成「某某 · 企业直招」
  const 发布人 = 视图 !== null
    ? (视图.发布人
      ? {
        首字: 视图.发布人.首字,
        姓名: 视图.发布人.姓名,
        公司: 视图.公司.名称,
        职务: 视图.发布人.职务,
        备注: '',
      }
      : null)
    : {
      首字: 详.发布人.首字,
      姓名: 详.发布人.姓名,
      公司: 详.发布人.公司,
      职务: 详.发布人.职务,
      备注: 详.发布人.备注,
    };

  return (
    <div className={样式.内容}>
      {/* 职位名 + 薪资 + 标签：baseline 对齐，让 21px 的职位名和 16px 的薪资底线齐平 */}
      <div>
        <div className={样式.标题行}>
          <div className={样式.职位名}>{岗.职位}</div>
          <div className={`${样式.薪资} 薪资体`}>{岗.薪资}</div>
        </div>
        <div className={样式.标签行}>
          {(视图 !== null ? (岗.学历要求 ? [岗.学历要求] : []) : 详.标签).map((标签) => (
            <span key={标签} className={样式.标签}>
              {标签}
            </span>
          ))}
          {/* 发布时间 chip：淡绿一档，和灰标签区分出「新鲜度」这一维 */}
          {岗.发布于 ? <span className={样式.发布于标}>{岗.发布于}</span> : null}
        </div>
      </div>

      {/* 匹配度分析(2026-08-26 用户定稿「对齐表·圆点行式」):每行 = JD 要求原文(重)
          × 简历证据原文(浅),AI 只做连线;未命中置顶,零自创文案。原维度行/硬性小节/
          技能 chips 三段合并退役 —— 规则复述回沉默过滤层 */}
      <div className={样式.卡}>
        <匹配对齐卡
          分={岗.适配分}
          藏环={藏匹配环}
          行们={求职侧对齐行(岗, {
            经历: 状态.简历经历,
            教育: 状态.简历教育,
            技能: 状态.简历技能,
          })}
        />
      </div>

      {/* JD：职位详情 + 职位要求两段合在一张卡里，中间用小标题分隔 */}
      <div className={样式.卡}>
        <div className={样式.卡标题}>职位详情</div>
        {(视图 !== null ? 视图.职位详情 : 详.职位详情).map((行) => (
          <div key={行} className={样式.卡正文}>
            {行}
          </div>
        ))}
        <div className={样式.卡小标题}>职位要求</div>
        {(视图 !== null ? 视图.职位要求 : 详.职位要求).map((行) => (
          <div key={行} className={样式.卡正文}>
            {行}
          </div>
        ))}
      </div>

      {/* 公司(加厚,2026-08-26 用户指定「所有页面都要改」):共用 公司区块 组件,
          介绍段 + 融资阶段/规模/行业/成立/地址。Backend(P4)公司名照常展示,
          介绍段不造(映射层只带 wire 事实);只有 hiring_organization_ref 在场才可点进公开企业页 */}
      <div className={样式.卡}>
        <公司区块
          名称={视图 !== null ? 视图.公司.名称 : 详.公司.名称}
          首字={视图 !== null ? 视图.公司.首字 : 详.公司.首字}
          一行简介={视图 !== null ? 视图.公司.简介 : 详.公司.简介}
          资料={是后端 ? { 介绍段: null, 元行组: [] } : undefined}
          按下={公司跳转}
        />
      </div>

      {/* 发布人:是企业招聘负责人还是猎头,决定了用户愿不愿意直接聊。
          2026-08-26 用户指定:挪到公司区块之下——先认识公司,再认识对接的人。
          P4 发布人缺席(wire 无 publisher_profile)整卡不渲染 */}
      {发布人 !== null ? (
        <div className={`${样式.卡} ${样式.发布人卡}`}>
          <span className={样式.发布人头像}>{发布人.首字}</span>
          <div className={样式.发布人文字区}>
            <div className={样式.发布人名}>
              {发布人.姓名} · {发布人.公司}{' '}
              {发布人.职务 ? (
                <span className={样式.发布人职务}>{发布人.职务}</span>
              ) : null}
            </div>
            {发布人.备注 ? (
              <div className={样式.发布人备注}>{发布人.备注}</div>
            ) : null}
          </div>
          {/* 直接聊入口收进发布人卡:聊的对象就是这个人,按钮贴着人放。
              直聊层里本来就在和这个人聊,藏掉;Backend 无直聊坐标,同样藏掉 */}
          {藏直聊 || 是后端 ? null : (
            <button
              className={`${样式.发布人聊} 可点`}
              onClick={() => 跳转(路径.直聊会话岗位(岗.编号))}
            >
              直接聊
            </button>
          )}
        </div>
      ) : null}

    </div>
  );
}
