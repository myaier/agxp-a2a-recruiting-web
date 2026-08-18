// 已筛掉的候选 —— 企业「我的 › 其他功能 › 已筛掉」进来。
//
// 存在的理由：推荐流里左滑「不合适」是一个不可见的动作，如果没有这一屏，用户就无法
// 知道自己到底把谁挡掉了、按什么理由挡的，也无法纠错。负反馈必须可回看、可撤销，
// 否则它就是一个静默的黑洞 —— 撤销后这位候选立刻回到推荐流。
//
// 双盲不变：这一屏同样只出现代号与画像，没有真名，也不出现任何薪资数字。

import 样式 from './我的功能页.module.css';
import 本屏样式 from './已筛候选.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 推荐列表 } from '../数据/企业端模拟数据';
import { 轻提示 } from '../组件/轻提示';

export default function 已筛候选() {
  const { 返回 } = use导航();
  const { 状态, 派发 } = use应用状态();

  // 把「编号 → 原因」的记录补上代号与画像；查不到推荐档的（数据被换过）也照样列出来
  const 条目 = Object.entries(状态.不合适候选).map(([编号, 原因]) => {
    const 推 = 推荐列表.find((条) => 条.编号 === 编号);
    return {
      编号,
      原因,
      代号: 推?.代号 ?? `候选 ${编号}`,
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
