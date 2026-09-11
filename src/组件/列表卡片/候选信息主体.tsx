// 候选信息主体：招聘两卡共用的「头行 → 工作图标行 → 教育图标行 → 亮点标签行」（Spec §5.1）。
// 头行复用 候选头行（详情页/匿名简历同源出处）；分数位由具体卡的外层右列定位，主体只在
// 头行让出右列空间。占位规则统一在 Spec §4.2：合法 null / trim 后为空才显示「未知」，
// 工作/教育复合行显示已知部分、全空才占位；标签 trim 后无有效展示项按空处理，
// 非空项不去重、不排序。空字段保留行与图标，未知不让后续行上移。
// 不 import Context/fixture/HTTP/路由/持久化，不派发、不请求、不算分。
import 候选头行 from '../候选头行';
import type { 头行段名 } from '../候选头行';
import { 公文包图标, 学帽图标 } from '../图标';
import 样式 from './候选信息主体.module.css';
import type { 候选卡信息 } from './类型';

/** trim 后无有效字符的项不算展示项；其余原样保留 */
function 有效项们(值们: readonly string[]): string[] {
  return 值们.filter((值) => 值.trim() !== '');
}

/** 展示文本 trim 后为空按缺失处理（Spec §4.1）：合法 null 与空白字符串同归「未知」，
 *  空白不得冒充已知值；非空原样保留，不改既有显示。 */
function 已知文(值: string | null): string | null {
  return 值 !== null && 值.trim() !== '' ? 值 : null;
}

export default function 候选信息主体({ 信息 }: { 信息: 候选卡信息 }) {
  const 亮点们 = 有效项们(信息.亮点);
  const 年限 = 已知文(信息.年限);
  const 学历 = 已知文(信息.学历);
  const 求职状态 = 已知文(信息.求职状态);
  // 占位文案在这里预格式化，「哪段是未知」单独交给头行上色（Spec §6）—— 头行不猜文案含义，
  // 详情 / 匿名简历不传 未知段们，渲染一字不变。
  const 未知段们: 头行段名[] = [];
  if (年限 === null) 未知段们.push('年限');
  if (学历 === null) 未知段们.push('学历');
  if (求职状态 === null) 未知段们.push('求职状态');
  return (
    <>
      <div className={样式.头区} data-card-region="head">
        {/* 三段未知文本由主体预格式化后传给现有头行 props —— 不让整个头行知道「卡片模式」，
            详情 / 匿名简历的默认行为不变。两行位只在卡片调用处生效（见 .两行）。 */}
        <候选头行
          性别={信息.性别 ?? undefined}
          未知性别占位={信息.性别 === null}
          年限={年限 ?? '经验未知'}
          学历={学历 ?? '学历未知'}
          求职状态={求职状态 ?? '求职状态未知'}
          未知段们={未知段们}
          类名={样式.两行}
        />
      </div>

      {/* 工作图标行：永远在；复合行只显示已知部分，全空才占位（Spec §4.2） */}
      <div className={样式.信息行} data-card-region="work">
        <公文包图标 尺寸={14} 色="var(--次要浅)" />
        {已知文(信息.工作) === null ? (
          <span className={`${样式.信息文} ${样式.未知文} 单行`}>工作经历未知</span>
        ) : (
          <span className={`${样式.信息文} 单行`}>{信息.工作}</span>
        )}
      </div>

      <div className={样式.信息行} data-card-region="education">
        <学帽图标 尺寸={14} 色="var(--次要浅)" />
        {已知文(信息.教育) === null ? (
          <span className={`${样式.信息文} ${样式.未知文} 单行`}>教育经历未知</span>
        ) : (
          <span className={`${样式.信息文} 单行`}>{信息.教育}</span>
        )}
      </div>

      {/* 标签行：亮点（BOSS 的标签位）。占位只表示「没有可展示的亮点」，不补其他域数据 */}
      <div className={样式.标签行} data-card-region="tags">
        {亮点们.length > 0 ? (
          亮点们.map((亮点, 序) => (
            // key 带下标：契约不要求元素唯一，重复亮点也不产生 duplicate key
            <span key={`${序}-${亮点}`} className={样式.标签}>
              {亮点}
            </span>
          ))
        ) : (
          <span className={样式.未知文}>亮点信息未知</span>
        )}
      </div>
    </>
  );
}
