// 求职在谈卡：Mock 在谈单与 Backend P5 候选在谈行共用的唯一卡面（Plan 公共展示契约 /
// Spec §5.3）。视觉基准 = 原 在谈首页.tsx 的 Mock 在谈卡：公司头行（字标 + 公司名/简介 +
// 右列[匹配分 + 薪资]）→ 职位名 → 标签行 → 在谈阶段区，阅读顺序固定。
//
// 占位（Spec §4.2/§4.3）：公司名/简介 null → 「公司信息未知/公司简介未知」；字标 null →
// 本地 CSS 中性空白块（34×34、圆角 10px，可访问名「公司图片未知」）—— 不渲染字标元素，
// 也就不会按未知名称命中静态公司标、不发空 URL 或外部占位图请求；匹配分 null → 卡片分数
// 的未知占位（说明在 40px 容器内，不把薪资挤出右列）；标签 trim 后无有效项 → 「标签信息未知」。
// Backend 的冻结职位/薪资/城市/技能由连接层原样传入，卡内不写 mock/backend 判断。
// 不 import Context/fixture/HTTP/路由/持久化，不派发、不请求、不算分（Mock 的 use适配分
// 留在在谈首页连接层）。
import { 白卡, 公司字标 } from '../通用';
import 卡片分数 from './卡片分数';
import 样式 from './求职在谈卡.module.css';
import 在谈阶段区 from './在谈阶段区';
import type { 求职在谈卡属性 } from './类型';

/** trim 后无有效字符的项不算展示项；其余原样保留（顺序、重复都不动，Spec §4.1） */
function 有效标签们(标签们: readonly string[]): string[] {
  return 标签们.filter((标签) => 标签.trim() !== '');
}

/** 展示文本 trim 后为空按缺失处理（Spec §4.1）：合法 null 与空白字符串同归「未知」，
 *  空白不得冒充已知值；非空原样保留，不改既有显示。 */
function 已知文(值: string | null): string | null {
  return 值 !== null && 值.trim() !== '' ? 值 : null;
}

export default function 求职在谈卡({
  公司,
  公司简介,
  公司字标: 字标,
  匹配分,
  薪资,
  职位,
  标签,
  阶段,
  打开,
}: 求职在谈卡属性) {
  const 标签们 = 有效标签们(标签);
  const 公司名 = 已知文(公司);
  const 公司简介文 = 已知文(公司简介);
  return (
    <div className={样式.根} data-testid="求职在谈卡">
      <白卡 按下={打开} 类名={样式.卡}>
        {/* 公司头行：字标 + 公司名/简介；右列绝对定位挂卡右上（Mock 同一落点），横排
            分数 + 薪资 —— 未知分说明放在分数容器内部，薪资不被往下推（Spec §4.3） */}
        <div className={样式.公司头行} data-card-region="company">
          {字标 !== null ? (
            <公司字标 首字={字标.首字} 公司名={字标.公司名} 尺寸={34} 圆角={10} 字号={14} />
          ) : (
            <span className={样式.字标空位} role="img" aria-label="公司图片未知" />
          )}
          <div className={样式.公司文}>
            {/* 公司名占位换次要文字色（Spec §6）：真实公司名仍是 --墨/700；类名串保持
                已知分支一字不差。简介占位沿用 .公司简介 的 --弱化，不再另加类。 */}
            <div className={`${样式.公司名}${公司名 === null ? ` ${样式.未知文}` : ''} 单行`}>
              {公司名 ?? '公司信息未知'}
            </div>
            <div className={`${样式.公司简介} 单行`}>{公司简介文 ?? '公司简介未知'}</div>
          </div>
          <div className={样式.右列} data-card-region="score">
            <卡片分数 分={匹配分} />
            {/* 原展示破折号行为（Mock 卡沿用至今）：仅把 - 换成 –，不改币种/单位/数值 */}
            <span className={`${样式.薪资} 薪资体`} data-card-region="salary">
              {薪资.replace('-', '–')}
            </span>
          </div>
        </div>

        {/* 职位名 */}
        <div className={`${样式.职位名} 单行`} data-card-region="title">
          {职位}
        </div>

        {/* 标签行：Mock 是岗位属性，Backend 是 城市 + 技能（连接层负责这个组成顺序） */}
        <div className={样式.标签行} data-card-region="tags">
          {标签们.length > 0 ? (
            标签们.map((标签, 序) => (
              // key 带下标：契约不要求元素唯一，重复标签也不产生 duplicate key
              <span key={`${序}-${标签}`} className={样式.标签}>
                {标签}
              </span>
            ))
          ) : (
            <span className={样式.未知标签}>标签信息未知</span>
          )}
        </div>

        {/* 阶段区：两类在谈卡同一组件（Mock 阶段枚举 / P5 阶段标题 + 徽标都经连接层投影） */}
        <在谈阶段区 信息={阶段} />
      </白卡>
    </div>
  );
}
