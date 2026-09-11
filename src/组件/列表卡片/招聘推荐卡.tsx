// 招聘推荐卡：Mock 与 Backend 两模式共用的唯一卡面（Plan 公共展示契约 / Spec §5.1）。
// 视觉基准 = 原 src/屏幕/候选推荐.tsx 的 Mock 推荐卡（BOSS 牛人卡版式，2026-09-08 去名改版）：
// 卡上无真名、无代号、无头像、不谈薪；来源标「你的AI代理从人才库筛出」是两模式现有固定文案，
// 随卡面搬移，不设来源 prop。
//
// 底部行为（Spec §5.1）：卡主体与 › 只调 打开；★ 只调 切收藏、收藏禁用时不响应；
// 未委托显示去聊键（提交中禁用），有回执只渲染权威文案状态标；滑开时卡内点击全部让位
// 给外层滑动行的「收起」。外层用不可点的白卡 + 独立卡主体按钮，白卡不形成嵌套 button。
// 不 import Context/fixture/HTTP/路由/持久化，不派发、不请求、不算分。
import { 白卡 } from '../通用';
import 代理标 from '../代理标';
import { 谈判图标 } from '../图标';
import 候选信息主体 from './候选信息主体';
import 卡片分数 from './卡片分数';
import 样式 from './招聘推荐卡.module.css';
import type { 招聘推荐卡属性 } from './类型';

export default function 招聘推荐卡({
  信息,
  匹配分,
  收藏,
  收藏禁用,
  滑开,
  操作状态,
  打开,
  切收藏,
  委托,
}: 招聘推荐卡属性) {
  return (
    <div className={样式.根} data-testid="招聘推荐卡">
      <白卡 类名={样式.卡}>
        {/* 卡主体整块可点 → 匿名在线简历。内容出自 候选信息主体，静态分析看不到文字，
            所以给一个明确的可访问名（不再是整卡文字串起来的长名）。分数位放主体前：
            阅读顺序 = 头行 + 右侧匹配分 一组 → 工作行 → 教育行 → 亮点行（Spec §5.1）；
            候选信息主体的签名冻结（只收 信息），分数位只能由卡层绝对定位，
            落点仍是头行右侧同一位置。 */}
        <button
          className={`${样式.卡主体} 可点`}
          aria-label="查看候选匿名简历"
          onClick={() => !滑开 && 打开()}
        >
          <div className={样式.右列} data-card-region="score">
            <卡片分数 分={匹配分} />
          </div>
          <候选信息主体 信息={信息} />
        </button>

        {/* 底行：AI代理来源标 + ★收藏 + ›详情 + 委托操作（镜像市场卡发布人行 + 去谈键） */}
        <div className={样式.底行} data-card-region="actions">
          <span className={样式.代理小圆}>
            <代理标 尺寸={12} 带点={false} />
          </span>
          <span className={`${样式.来源} 单行`}>你的AI代理从人才库筛出</span>

          <button
            className={`${样式.收藏键} ${收藏 ? 样式.已收藏 : ''} 可点`}
            disabled={收藏禁用}
            onClick={() => !滑开 && !收藏禁用 && 切收藏()}
            aria-label={收藏 ? '取消收藏' : '收藏'}
            aria-pressed={收藏}
          >
            {收藏 ? '★' : '☆'}
          </button>

          <button
            className={`${样式.尖括号} 可点`}
            onClick={() => !滑开 && 打开()}
            aria-label="查看候选画像"
          >
            ›
          </button>

          {操作状态.kind === '回执' ? (
            // 一切回执（成功/失败/拒绝/进行中）都是不可点的状态标：文案由调用方给权威值，
            // 卡片不做任何业务推断；看候选画像仍走卡上原来的 › 入口。
            <span className={样式.已接触}>
              <span className={样式.已接触文字}>{操作状态.文案}</span>
            </span>
          ) : (
            <button
              className={`${样式.去聊键} 可点`}
              disabled={操作状态.提交中}
              onClick={() => !滑开 && !操作状态.提交中 && 委托()}
            >
              <谈判图标 />
              <span className={样式.去聊文字}>让AI代理去聊</span>
            </button>
          )}
        </div>
      </白卡>
    </div>
  );
}
