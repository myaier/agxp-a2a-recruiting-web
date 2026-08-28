// 已筛掉的候选 —— 企业「我的 › 其他功能 › 已筛掉」进来。
//
// 存在的理由：推荐流里左滑「不合适」是一个不可见的动作，如果没有这一屏，用户就无法
// 知道自己到底把谁挡掉了、按什么理由挡的，也无法纠错。负反馈必须可回看、可撤销，
// 否则它就是一个静默的黑洞。
//
// P4 模式边界：Backend 一次请求全部在招岗位（job_id 来自水合后的 岗位列表）的
// rejected 腿，服务端把全部腿原子提交后才展示（任一腿失败不落半份聚合）；原因文案
// 经 P4淘汰原因文案 闭合四员；撤销等服务端成功——它只解除这条筛选，之后的推荐批次
// 才可能再出现这位候选，页面文案绝不承诺「立刻回到推荐流」。
// Mock 继续读 状态.不合适候选 与既有归约，零 P4 请求。
//
// 双盲不变：这一屏同样只出现代号与画像，没有真名，也不出现任何薪资数字。

import { useEffect, useMemo, useState } from 'react';
import 样式 from './我的功能页.module.css';
import 本屏样式 from './已筛候选.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 推荐列表 } from '../数据/企业端模拟数据';
import { 轻提示 } from '../组件/轻提示';
import { 从P4招聘候选, P4淘汰原因文案 } from '../数据/发现推荐映射';
import type { BFF招聘候选推荐 } from '../数据/BFF契约';
import { P4错误文案, P4范围键 } from '../状态/后端/发现推荐操作';

export default function 已筛候选() {
  const { 数据源模式 } = use应用状态();
  return 数据源模式 === 'backend' ? <Backend已筛候选 /> : <Mock已筛候选 />;
}

/** Mock 原型分支：本地 不合适候选 表 + 撤销归约，行为与接线前逐字一致。 */
function Mock已筛候选() {
  const { 返回 } = use导航();
  const { 状态, 派发 } = use应用状态();

  // 把「编号 → 原因」的记录补上代号与画像；查不到推荐档的（数据被换过）也照样列出来
  const 条目 = Object.entries(状态.不合适候选).map(([编号, 原因]) => {
    const 推 = 推荐列表.find((条) => 条.编号 === 编号);
    return {
      编号,
      原因,
      代号: 推?.代号 ?? 编号,
      画像: 推?.画像 ?? '这位候选的画像已不在当前推荐库里',
    };
  });

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="已筛掉的候选" 副标题="代理不会再推荐这些人" />

      <滚动区 样式覆盖={{ padding: '14px 18px 24px' }}>
        <div className={样式.说明条}>
          你标记的原因会成为代理的负反馈样本，
          <span className={样式.说明强调}>下一批推荐会避开同类</span>
          。撤销后这位候选立刻回到推荐流。
        </div>

        {条目.length === 0 ? (
          <div className={样式.空态}>
            <div className={样式.空态图}>◎</div>
            <div className={样式.空态标题}>还没有筛掉任何人</div>
            <div className={样式.空态说明}>
              在推荐流里左滑一张卡片，就能标记「不合适」并选择原因。
            </div>
          </div>
        ) : (
          <div className={样式.卡}>
            {条目.map((条) => (
              <div className={样式.行} key={条.编号}>
                <span className={样式.行文字组}>
                  <span className={本屏样式.头行}>
                    <span className={`${本屏样式.代号} 单行`}>{条.代号}</span>
                    <span className={本屏样式.原因标}>{条.原因}</span>
                  </span>
                  <span className={本屏样式.画像}>{条.画像}</span>
                </span>
                <button
                  className={`${样式.次要键} 可点`}
                  onClick={() => {
                    派发({ 型: '撤销不合适', 编号: 条.编号 });
                    轻提示(`${条.代号} 已回到推荐流`);
                  }}
                >
                  撤销
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={样式.版本}>
          筛掉的记录只影响推荐排序，不会通知对方，
          <br />
          对方也不会知道是哪家公司筛掉了他。
        </div>
      </滚动区>
    </次级页外壳>
  );
}

/** Backend 分支（P4）：跨全部在招岗位的 rejected 快照，服务端原子聚合。 */
function Backend已筛候选() {
  const { 返回 } = use导航();
  const { 状态, 数据源模式, 后端状态, 操作 } = use应用状态();
  // 撤销写进行中的那条推荐：服务端没回执前按钮保持禁用，绝不本地假装成功
  const [撤销中, 设撤销中] = useState<string | null>(null);

  const 是后端 = 数据源模式 === 'backend';
  // 全部在招岗位：job_id 由水合后的 岗位列表[].编号 承载（从BFF岗位 编号=dto.job_id）
  const 在招岗位编号们 = useMemo(
    () => 状态.岗位列表.filter((岗) => 岗.状态 === '在招').map((岗) => 岗.编号),
    [状态.岗位列表]
  );
  const 范围键 = P4范围键.招聘已筛(在招岗位编号们);

  // 进屏 / 岗位集变化：先注册可见范围再加载（操作层的栅栏要靠注册的可见范围对上）；
  // 离开本屏时把可见范围清成 null，别让别的屏背上旧范围。
  useEffect(() => {
    if (!是后端 || 在招岗位编号们.length === 0) return;
    操作.设置发现推荐范围('recruiter', 范围键);
    void 操作.加载招聘已筛(在招岗位编号们).catch(() => undefined);
    return () => 操作.设置发现推荐范围('recruiter', null);
  }, [是后端, 范围键, 在招岗位编号们, 操作]);

  // 只认原子提交：聚合与快照都是 操作层 同一次 设后端状态 写进去的，
  // 任一腿失败时聚合停在 失败、快照不出现 —— 这里就永远读不到半份。
  const 聚合 = 后端状态.招聘已筛聚合;
  const 快照 = 聚合.jobKey !== '' ? 后端状态.招聘已筛候选?.[聚合.jobKey] : undefined;
  const 条目 = useMemo(() => {
    if (聚合.阶段 !== '成功' || !快照 || 快照.阶段 !== '成功') return [];
    return 快照.items.map((卡) => ({ 卡, 视图: 从P4招聘候选(卡) }));
  }, [聚合.阶段, 快照]);

  const 撤销 = async (卡: BFF招聘候选推荐, 代号: string) => {
    if (撤销中 !== null) return;
    设撤销中(卡.recommendation_id);
    try {
      await 操作.撤销淘汰候选(卡.job_id, 卡.recommendation_id);
      // 文案中性：撤销只解除这条筛选，不承诺他立刻回到当前这批推荐
      轻提示(`已撤销「${代号}」的筛选`);
    } catch (错误) {
      轻提示(P4错误文案(错误));
    } finally {
      设撤销中(null);
    }
  };

  const 重读 = () => {
    if (在招岗位编号们.length === 0) return;
    void 操作.加载招聘已筛(在招岗位编号们, true).catch(() => undefined);
  };

  // 无在招岗位：本屏没有任何 scope 可读（上面的 effect 也不发请求），
  // 直接给空态 —— 绝不让聚合停在 未开始 而永远显示「正在读取筛掉的候选…」
  const 无在招岗位 = 在招岗位编号们.length === 0;
  // 加载态：聚合未提交（未开始/进行中，或腿还在飞）先给加载中；失败给明确重试
  const 载入中 = 聚合.阶段 === '未开始' || 聚合.阶段 === '进行中' ||
    (聚合.阶段 === '成功' && (!快照 || 快照.阶段 !== '成功'));

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="已筛掉的候选" 副标题="代理不会再推荐这些人" />

      <滚动区 样式覆盖={{ padding: '14px 18px 24px' }}>
        <div className={样式.说明条}>
          你标记的原因会成为代理的负反馈样本，
          <span className={样式.说明强调}>下一批推荐会避开同类</span>
          。撤销只解除这条筛选，之后的推荐批次才可能再出现这位候选。
        </div>

        {无在招岗位 ? (
          <div className={样式.空态}>
            <div className={样式.空态图}>◎</div>
            <div className={样式.空态标题}>还没有在招的岗位</div>
            <div className={样式.空态说明}>
              发布或重开一个岗位后，这里才会显示它筛掉的候选。
            </div>
          </div>
        ) : 聚合.阶段 === '失败' ? (
          <div className={样式.空态}>
            <div className={样式.空态标题}>筛掉的候选暂时加载不了</div>
            <div className={样式.空态说明}>{聚合.error}</div>
            <button className={`${样式.次要键} 可点`} onClick={重读}>
              重试
            </button>
          </div>
        ) : 载入中 ? (
          <div className={样式.空态}>
            <div className={样式.空态标题}>正在读取筛掉的候选…</div>
          </div>
        ) : 条目.length === 0 ? (
          <div className={样式.空态}>
            <div className={样式.空态图}>◎</div>
            <div className={样式.空态标题}>还没有筛掉任何人</div>
            <div className={样式.空态说明}>
              在推荐流里左滑一张卡片，就能标记「不合适」并选择原因。
            </div>
          </div>
        ) : (
          <div className={样式.卡}>
            {条目.map(({ 卡, 视图 }) => {
              // 原因文案闭合四员：wire 码只在这里换成展示词，绝不原样上屏
              const 原因 = 视图.淘汰原因 !== null ? P4淘汰原因文案(视图.淘汰原因) : null;
              const 画像 = 视图.摘要 ||
                [视图.经验, 视图.求职状态].filter(Boolean).join(' · ');
              return (
                <div className={样式.行} key={卡.recommendation_id}>
                  <span className={样式.行文字组}>
                    <span className={本屏样式.头行}>
                      <span className={`${本屏样式.代号} 单行`}>{视图.代号}</span>
                      {原因 !== null ? (
                        <span className={本屏样式.原因标}>{原因}</span>
                      ) : null}
                    </span>
                    {画像 ? <span className={本屏样式.画像}>{画像}</span> : null}
                  </span>
                  <button
                    className={`${样式.次要键} ${撤销中 === 卡.recommendation_id ? '' : '可点'}`}
                    disabled={撤销中 !== null}
                    onClick={() => void 撤销(卡, 视图.代号)}
                  >
                    撤销
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className={样式.版本}>
          筛掉的记录只影响推荐排序，不会通知对方，
          <br />
          对方也不会知道是哪家公司筛掉了他。
        </div>
      </滚动区>
    </次级页外壳>
  );
}
