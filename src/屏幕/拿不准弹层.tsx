// A24 拿不准 → 记成规则：在往来记录 / 在谈详情里介入决策后，从屏幕底部升起。
//
// 结构：遮罩 → 抓手 → 盾牌 + 标题 → 你刚才的决定（灰托盘）
//      → 我想记成的规则（绿托盘 + 影响预计）→ 只这一次 / 记成规则 → 尾注。
//
// 定位用 absolute 而不是 fixed：桌面机身模式下整台手机是被缩放过的容器，
// fixed 会跑到机身外面去；absolute 挂在 次级页外壳（position:relative）上才刚好铺满屏内。

import 样式 from './拿不准弹层.module.css';
import 代理标 from '../组件/代理标';
import { 拿不准弹层 as 文案 } from '../数据/模拟数据';

export default function 拿不准弹层({
  可见,
  关闭,
  决策类型,
  记成规则,
  决定文案,
  规则草案,
}: {
  可见: boolean;
  关闭: () => void;
  决策类型: '接受' | '退出' | null;
  记成规则: (内容: string) => void;
  决定文案?: string;
  规则草案?: string;
}) {
  // 不可见就整块不渲染 —— 这样每次升起都会重新触发 CSS 入场动画
  if (!可见) return null;

  // 决定 / 规则文案优先用调用方传进来的真实上下文，没传就按决策类型退回设计稿示例文案
  const 决定正文 =
    决定文案 ??
    (决策类型 === '退出'
      ? 文案.你的决定
      : '你同意放宽这一项 —— AI代理会立刻回报对方，并把这一单推进到下一阶段。');

  const 规则正文 =
    规则草案 ??
    (决策类型 === '退出'
      ? 文案.规则文案
      : '现金差 2K 以内、其余条件全过的岗位，可以直接替我放宽');

  return (
    <>
      {/* 半透明遮罩：点空白处等于「只这一次」，直接关掉不留规则 */}
      <button className={样式.遮罩} onClick={关闭} aria-label="关闭" />

      <div className={样式.抽屉} role="dialog" aria-modal="true">
        <div className={样式.抓手} />

        <div className={样式.标题行}>
          <span className={样式.盾牌底}>
            <代理标 尺寸={30} 脸色="#ffffff" 眼色="var(--墨)" 描边色="var(--墨)" 描边宽={2.6} />
          </span>
          <span className={样式.标题}>{文案.标题}</span>
        </div>

        {/* 灰托盘：复述用户刚做的那个决定，让他确认「我要记的是这件事」 */}
        <div className={样式.灰托盘}>
          <div className={样式.托盘标签}>你 刚 才 的 决 定</div>
          <div className={样式.灰托盘正文}>{决定正文}</div>
        </div>

        {/* 绿托盘：代理拟好的规则草案 + 记下来之后能省掉多少次打扰 */}
        <div className={样式.绿托盘}>
          <div className={样式.绿托盘标签}>我 想 记 成 的 规 则</div>
          <div className={样式.规则文案}>{规则正文}</div>
          <div className={样式.影响预计}>{文案.影响预计}</div>
        </div>

        <div className={样式.按钮行}>
          <button className={`${样式.次按钮} 可点`} onClick={关闭}>
            只这一次
          </button>
          <button
            className={`${样式.主按钮} 可点`}
            onClick={() => {
              记成规则(规则正文);
              关闭();
            }}
          >
            记成规则
          </button>
        </div>

        <div className={样式.尾注}>{文案.尾注}</div>
      </div>
    </>
  );
}
