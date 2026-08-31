// 谈判进度 = 阶段时间线 + 段内双方代理左右对话（2026-08-20 用户定稿，两端共用）。
//
// 用户口径：「还是像原来的阶段进展的 UI 设计，双方的 Agent 在一左一右交流，
// 每个阶段都有交流，聊完一个阶段就跳下一个；卡住需要协商时用户可以介入
// —— 输入消息或点决策卡片。」所以时间线的轴 / 阶段圆点 / 连线保留，
// 对话是节点主体里的内容，不是替代时间线的另一种版式。
//
// 原来这一屏是「四阶段时间线 + 顶部一张『双方代理对话 ›』入口卡」，
// 想看代理到底聊了什么得再跳一层。现在对话就摊在阶段里：
//   · 已完成阶段 —— 分节条默认折叠，一行结论带走；
//   · 当前阶段   —— 默认展开，对话全显示，流末尾接决策卡（卡在哪一眼就看见）；
//   · 未到达阶段 —— 灰分节条，一行说明谁来推进，不可展开。
// 用户在底部输入条写的话直接接在当前阶段流末尾，紧跟一条代理回执。
//
// 求职端 在谈详情 与 企业端 候选详情 都用这一个组件，保证两端结构同构 ——
// 差别只在传进来的分段数据（视角与文案），版式不许各画各的。

import { useState, type ReactNode, type RefObject } from 'react';
import 样式 from './阶段对话流.module.css';
import 代理标 from './代理标';
import { 阶段配色, 小结托盘 } from './通用';
import type { 对话条, 阶段 } from '../数据/类型';

/** 一个阶段分段的全部渲染输入 */
export interface 分段项 {
  阶段: 阶段;
  /** 已完成 = 默认折叠；当前 = 默认展开；未到达 = 灰条不可展开 */
  态: '已完成' | '当前' | '未到达';
  /** 状态胶囊文字：通过 / 达成 / 进行中 / 需要你 / 已放宽 … */
  状态文?: string | null;
  /** 一句结论摘要：收起时在分节条上，展开时进代理小结托盘 */
  小结?: string | null;
  核对清单?: { 项: string; 结果: '通过' | '核对中' }[];
  /** 该阶段没有对话数据时的兜底附件行（企业端收到的匿名简历）*/
  附件?: { 文件名: string; 说明?: string } | null;
  /**
   * 附件行独立于段内对话常驻（P5 详情专用，评审终审修复）：P5 的 typed 附件是
   * 招聘端唯一 PDF 入口，段内一旦有任何对话内容（Case 叮嘱回执、带文本时间线）
   * 也不得消失。缺省（Mock 屏不传）维持旧行为：无对话时附件才单独成行。
   */
  附件常驻?: boolean;
  对话?: 对话条[];
  /** 小结下方的链接（进往来记录的那类已在重构里去掉，只剩就地切 Tab 的）*/
  小链接?: string | null;
  /** 你发出的话 + 代理回执，接在当前阶段流的末尾 */
  用户气泡?: { 编号: number; 我: string; 回执: string }[];
  /** 未到达阶段的一行说明：这一步由谁推进 */
  待推进说明?: string;
  /** 段内什么都没有时的兜底一行（老单缺小结也不能空白）*/
  空说明?: string;
  /** 决策卡 / 意向确认卡：挂在这一段对话流的末尾 */
  尾部?: ReactNode;
  /** 覆盖默认展开态（协调决策做完后，回执那一段要留着展开）*/
  默认展开?: boolean;
}

export default function 阶段对话流({
  分段们,
  点附件,
  点链接,
  当前段引用,
}: {
  分段们: 分段项[];
  /** 点简历附件行：求职端开自己的原件层，企业端开候选原件（S0 候选开打码预览） */
  点附件?: (文件名: string) => void;
  点链接?: (链接: string) => void;
  /** 挂在「当前」那一段上，进页面自动滚到视野 */
  当前段引用?: RefObject<HTMLDivElement | null>;
}) {
  // 展开态 = 手动开集合 / 手动收集合 / 默认（当前段展开）三者叠加。
  // 用两个集合而不是一个「展开集合」：阶段推进后默认值会变（协调 → 意向确认），
  // 单一集合会把「用户从没碰过」和「用户手动收起过」混成一种状态。
  const [手开, 设手开] = useState<Set<string>>(() => new Set());
  const [手收, 设手收] = useState<Set<string>>(() => new Set());

  const 是否展开 = (段: 分段项) => {
    if (手开.has(段.阶段)) return true;
    if (手收.has(段.阶段)) return false;
    return 段.默认展开 ?? 段.态 === '当前';
  };

  const 切换 = (段: 分段项) => {
    const 开着 = 是否展开(段);
    设手开((旧) => {
      const 新 = new Set(旧);
      if (开着) 新.delete(段.阶段);
      else 新.add(段.阶段);
      return 新;
    });
    设手收((旧) => {
      const 新 = new Set(旧);
      if (开着) 新.add(段.阶段);
      else 新.delete(段.阶段);
      return 新;
    });
  };

  return (
    <div className={样式.流}>
      {分段们.map((段) => {
        const 配色 = 阶段配色[段.阶段];
        const 展开 = 段.态 !== '未到达' && 是否展开(段);
        // 「N 条」：代理往来 + 你的话与代理回执（一条叮嘱在流里是两个气泡）
        const 条数 = (段.对话?.length ?? 0) + (段.用户气泡?.length ?? 0) * 2;

        return (
          <div
            key={段.阶段}
            className={样式.分段}
            ref={段.态 === '当前' ? 当前段引用 : undefined}
          >
            {/* 时间线轴：阶段圆点 +（非末段才有的）连线 —— 原阶段进展的骨架 */}
            <div className={样式.轴列}>
              <span
                className={`${样式.轴点} ${
                  段.态 === '已完成'
                    ? 样式.轴点已过
                    : 段.态 === '当前'
                      ? 样式.轴点当前
                      : 样式.轴点未到
                }`}
                style={
                  段.态 === '已完成'
                    ? { background: 配色.文字, borderColor: 配色.文字 }
                    : 段.态 === '当前'
                      ? { borderColor: 配色.文字 }
                      : undefined
                }
              >
                {段.态 === '已完成' ? <span className={样式.轴勾}>✓</span> : null}
              </span>
              <span className={样式.轴线} />
            </div>

            <div className={样式.轴右}>
            {段.态 === '未到达' ? (
              <div className={`${样式.分节条} ${样式.分节条灰}`}>
                <span className={样式.分节名}>{段.阶段}</span>
                <span className={样式.分节待办}>{段.待推进说明}</span>
              </div>
            ) : (
              <button className={`${样式.分节条} 可点`} onClick={() => 切换(段)}>
                <span className={样式.分节名} style={{ color: 配色.文字 }}>
                  {段.阶段}
                </span>
                {段.状态文 ? (
                  <span
                    className={样式.分节胶囊}
                    style={{ background: 配色.底, color: 配色.文字 }}
                  >
                    {段.状态文}
                  </span>
                ) : null}
                {/* 摘要位常驻（收起时才有字）：它占住中间的伸缩位，
                    「N 条」与箭头才会稳稳贴在右端，不会跟着胶囊往左跑 */}
                <span className={`${样式.分节摘要} 单行`}>
                  {展开 ? '' : (段.小结 ?? '')}
                </span>
                {条数 ? (
                  <span className={`${样式.分节条数} 等宽数字`}>{条数} 条</span>
                ) : null}
                <span
                  className={`${样式.分节箭头} ${展开 ? 样式.分节箭头开 : ''}`}
                >
                  ⌄
                </span>
              </button>
            )}

            {展开 ? (
              <div className={样式.段内}>
                {/* 该阶段没有对话数据时，简历附件单独成行（有对话时附件挂在那条话里）；
                    附件常驻（P5 详情）让入口独立于对话内容 —— 叮嘱回执/时间线文本落段
                    绝不压掉它（评审终审：那是招聘端唯一的原始 PDF 入口） */}
                {段.附件 && (段.附件常驻 === true || !段.对话?.length) ? (
                  <div className={样式.对话列}>
                    <附件行 附件={段.附件} 点开={点附件} />
                  </div>
                ) : null}

                {段.对话?.length || 段.用户气泡?.length ? (
                  <div className={样式.对话列}>
                    {段.对话?.map((条) =>
                      条.方 === '对方' ? (
                        <div key={条.编号} className={样式.对方行}>
                          <div className={样式.对方气泡}>
                            <span className={样式.气泡体}>
                              <span className={样式.气泡文}>{条.内容}</span>
                              {条.附件 ? (
                                <附件行 附件={条.附件} 点开={点附件} />
                              ) : null}
                            </span>
                          </div>
                          <span className={`${样式.气泡时间} 等宽数字`}>{条.时间}</span>
                        </div>
                      ) : (
                        <div key={条.编号} className={样式.我方行}>
                          <div className={样式.我方气泡}>
                            <span className={样式.气泡体}>
                              <span className={样式.气泡文}>{条.内容}</span>
                              {条.附件 ? (
                                <附件行 附件={条.附件} 点开={点附件} />
                              ) : null}
                            </span>
                            <span className={样式.我方记}>
                              <代理标
                                尺寸={16}
                                脸色="var(--荧光绿)"
                                眼色="var(--墨)"
                                描边色="var(--墨)"
                                描边宽={2.6}
                                带点={false}
                              />
                            </span>
                          </div>
                          <span className={`${样式.气泡时间} ${样式.时间右} 等宽数字`}>
                            {条.时间}
                          </span>
                        </div>
                      )
                    )}

                    {/* 你发出的话接在流末尾：荧光绿右气泡 + 紧跟一条代理回执 */}
                    {段.用户气泡?.map((条) => (
                      <div key={`叮嘱-${条.编号}`}>
                        <div className={样式.用户行}>
                          <div className={样式.用户气泡}>
                            <span className={样式.气泡文}>{条.我}</span>
                          </div>
                        </div>
                        <div className={样式.我方行} style={{ marginTop: 9 }}>
                          <div className={样式.我方气泡}>
                            <span className={样式.气泡体}>
                              <span className={样式.气泡文}>{条.回执}</span>
                            </span>
                            <span className={样式.我方记}>
                              <代理标
                                尺寸={16}
                                脸色="var(--荧光绿)"
                                眼色="var(--墨)"
                                描边色="var(--墨)"
                                描边宽={2.6}
                                带点={false}
                              />
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* 阶段结论：用户 2026-08-20 定稿 —— 先看双方代理怎么聊的，最下面才是这一阶段的总结 */}
                {段.小结 ? (
                  <小结托盘>
                    <div className={样式.小结正文}>{段.小结}</div>

                    {段.核对清单 ? (
                      <div className={样式.核对列}>
                        {段.核对清单.map((条) => (
                          <div key={条.项} className={样式.核对行}>
                            <span
                              className={`${样式.核对记} ${
                                条.结果 === '通过' ? 样式.核对记过 : 样式.核对记中
                              }`}
                            >
                              {条.结果 === '通过' ? '✓' : '·'}
                            </span>
                            <span className={样式.核对项}>{条.项}</span>
                            {条.结果 === '核对中' ? (
                              <span className={样式.核对中字}>核对中</span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {段.小链接 ? (
                      <button
                        className={`${样式.小链接} 可点`}
                        onClick={() => 点链接?.(段.小链接 as string)}
                      >
                        {段.小链接}
                      </button>
                    ) : null}
                  </小结托盘>
                ) : null}

                {/* 老数据缺小结也缺对话时的兜底一行，不留空白段 */}
                {!段.小结 && !段.对话?.length && !段.用户气泡?.length && !段.尾部 && 段.空说明 ? (
                  <div className={样式.空说明}>{段.空说明}</div>
                ) : null}

                {段.尾部 ? <div className={样式.尾部}>{段.尾部}</div> : null}
              </div>
            ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 简历附件行：PDF 块 + 文件名 + 说明，整行可点开原件 */
function 附件行({
  附件,
  点开,
}: {
  附件: { 文件名: string; 说明?: string };
  点开?: (文件名: string) => void;
}) {
  return (
    <button
      className={`${样式.附件行} 可点`}
      onClick={() => 点开?.(附件.文件名)}
    >
      <span className={样式.PDF块}>
        <span className={样式.PDF字}>PDF</span>
      </span>
      <span className={样式.附件文本}>
        <span className={`${样式.附件名} 单行`}>{附件.文件名}</span>
        {附件.说明 ? (
          <span className={`${样式.附件说明} 单行`}>{附件.说明}</span>
        ) : null}
      </span>
      <span className={样式.附件看}>查看 ›</span>
    </button>
  );
}
