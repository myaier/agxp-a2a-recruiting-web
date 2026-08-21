// 在谈筛选层（用户 2026-08-21：筛选入口两个子视图要一致，过滤项收进面板里）。
//
// 与「看市场 / 推荐」的筛选面板是两回事：那边改的是代理的硬性要求（写成规则、长期生效），
// 这边只决定「现在先看哪几单」——纯视图态，关掉面板就只影响这一屏的列表。
// 两端共用：求职端在谈、企业端在谈候选。

import 样式 from './在谈筛选层.module.css';
import 弹层框架 from './弹层框架';

export type 看什么档 = '全部' | '待我拍板' | '进行中';

export default function 在谈筛选层({
  当前,
  设当前,
  待办数,
  关闭,
}: {
  当前: 看什么档;
  设当前: (档: 看什么档) => void;
  /** 待你拍板的条数，标在对应档右侧 */
  待办数: number;
  关闭: () => void;
}) {
  return (
    <弹层框架 标签="筛选在谈项目" 遮罩类名={样式.遮罩} 面板类名={样式.层} 关闭={关闭}>
      <span className={样式.抓手} aria-hidden="true" />
      <div className={样式.标题}>看哪几单</div>

      <div className={样式.选项组}>
        {(['全部', '待我拍板', '进行中'] as 看什么档[]).map((档) => (
          <button
            key={档}
            className={`${样式.选项} ${当前 === 档 ? 样式.选项选中 : ''} 可点`}
            onClick={() => 设当前(档)}
          >
            <span className={样式.选项名}>{档}</span>
            {档 === '待我拍板' && 待办数 > 0 ? (
              <span className={`${样式.选项数} 等宽数字`}>{待办数}</span>
            ) : null}
            {当前 === 档 ? <span className={样式.选项勾}>✓</span> : null}
          </button>
        ))}
      </div>

      <button className={`${样式.完成} 可点`} onClick={关闭}>
        完成
      </button>
    </弹层框架>
  );
}
