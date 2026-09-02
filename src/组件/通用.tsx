// 跨屏复用的原子组件。所有屏幕都从这里取外壳、返回栏、按钮、阶段标签等，
// 不允许各屏自己重写一套 —— 这是像素一致性的保证。

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import 样式 from './通用.module.css';
import 代理标 from './代理标';
import { 公司标映射 } from '../资源/公司标索引';
import type { 阶段 } from '../数据/类型';

/** 四阶段配色表：卡片阶段标签、详情页节点、披露说明徽标统一走这张表 */
export const 阶段配色: Record<阶段, { 文字: string; 底: string }> = {
  匿名初筛: { 文字: 'var(--初筛)', 底: 'var(--初筛底)' },
  递交简历: { 文字: 'var(--递简历)', 底: 'var(--递简历底)' },
  需要协调: { 文字: 'var(--协调)', 底: 'var(--协调底)' },
  // 意向确认保持红:四阶段色阶是披露升级梯度(绿→绿→橙→红),红=最终不可撤回
  // (2026-08-31 曾全局改橙,用户指出披露页色阶被带歪,改回)
  意向确认: { 文字: 'var(--意向)', 底: 'var(--意向底)' },
};

// ── 主 Tab 页外壳：米色底 + 顶部渐变头 ──────────────────────────
export function 主页外壳({ children, 白底 = false }: { children: ReactNode; 白底?: boolean }) {
  // 白底（「我」页方案 A，2026-08-24）：页底纯白、顶部渐变头减淡到 45%
  return (
    <div className={`${样式.主页外壳} ${白底 ? 样式.主页白底 : ''}`}>
      <div className="顶部渐变头" />
      <div className={样式.主页内容}>{children}</div>
    </div>
  );
}

// ── 次级页外壳 ────────────────────────────────────────────────
export function 次级页外壳({
  children,
  对话底 = false,
  白底 = false,
}: {
  children: ReactNode;
  对话底?: boolean;
  /** 私聊三屏用：纯白页底（标注 2026-08-24「私聊页面的背景都改成白色」）*/
  白底?: boolean;
}) {
  return (
    <div className={`${样式.次级页外壳} ${对话底 ? 样式.对话底 : ''} ${白底 ? 样式.白底 : ''}`}>{children}</div>
  );
}

// ── 返回栏 ────────────────────────────────────────────────────
export function 返回栏({
  返回,
  标题,
  副标题,
  右侧,
  居中标题 = false,
}: {
  返回: () => void;
  标题?: string;
  副标题?: string;
  右侧?: ReactNode;
  居中标题?: boolean;
}) {
  return (
    <div className={样式.返回栏}>
      <button className={`${样式.返回键} 可点`} onClick={返回} aria-label="返回">
        ‹
      </button>
      {标题 ? (
        <div className={`${样式.返回栏标题组} ${居中标题 ? 样式.居中 : ''}`}>
          <div className={`${样式.返回栏标题} 单行`}>{标题}</div>
          {副标题 ? <div className={`${样式.返回栏副标题} 单行`}>{副标题}</div> : null}
        </div>
      ) : (
        <div style={{ flex: 1 }} />
      )}
      {右侧 ?? (居中标题 ? <div style={{ width: 30 }} /> : null)}
    </div>
  );
}

// ── 表单页大标题 ──────────────────────────────────────────────
export function 页面大标题({ 标题, 说明 }: { 标题: string; 说明?: string }) {
  return (
    <div className={样式.大标题区}>
      <h1 className={样式.大标题}>{标题}</h1>
      {说明 ? <p className={样式.大标题说明}>{说明}</p> : null}
    </div>
  );
}

// ── 荧光绿主按钮（底部固定）─────────────────────────────────────
export function 主按钮({
  文字,
  按下,
  禁用 = false,
}: {
  文字: string;
  按下: () => void;
  禁用?: boolean;
}) {
  return (
    <div className={样式.主按钮区}>
      <button className={`${样式.主按钮} 可点`} onClick={按下} disabled={禁用}>
        {文字}
      </button>
    </div>
  );
}

// ── 阶段标签 ──────────────────────────────────────────────────
export function 阶段标签({ 阶段: 值, 待你 = false }: { 阶段: 阶段; 待你?: boolean }) {
  // 两态合一（标注 10:35：「需要你」胶囊冗余）——
  //   待你：整枚变实底胶囊（阶段色底 + 白字 + 呼吸点），一眼就是「这一单在等你」；
  //   平时：安静的状态灯 + 文字，不抢眼。
  // 卡片置顶 + 下一步文案本来就在问你，不必再挂第二枚标签。
  // 标注 11:44：原来两态两种形（等你有框、平时没框），同一个组件长得不一样。
  // 现在统一成永远是淡底胶囊，两态只差那颗点会不会呼吸。
  const 配 = 阶段配色[值];
  // 标注 2026-08-24（方案 A 描边胶囊）：浅色底撤成白，只留一圈调淡的阶段色描边。
  // 卡片洗白、标签片提亮、投影抬卡之后，这块实底色是卡上最后一块"上一版"的颜色。
  // 配.底 不删 —— 详情页阶段节点、披露说明徽标还在用。
  return (
    <span
      className={样式.阶段标签}
      style={{
        background: '#fff',
        color: 配.文字,
        borderColor: `color-mix(in srgb, ${配.文字} 40%, #fff)`,
      }}
    >
      <span
        className={`${样式.阶段点} ${待你 ? 样式.阶段点呼吸 : ''}`}
        style={{ background: 配.文字 }}
      />
      {值}
    </span>
  );
}

// ── 分歧对比轴：双方数值互不披露，只呈现差额 ─────────────────────
export function 分歧轴({
  我方,
  差值,
  对方,
  主色 = 'var(--协调)',
}: {
  我方: string;
  差值: string;
  对方: string;
  主色?: string;
}) {
  return (
    <div className={样式.分歧轴}>
      <span className={`${样式.分歧端值} 等宽数字`}>{我方}</span>
      <span
        className={样式.分歧线左}
        style={{ background: `linear-gradient(90deg, ${主色}, var(--描边深))` }}
      />
      <span className={样式.分歧差值} style={{ color: 主色 }}>
        {差值}
      </span>
      <span
        className={样式.分歧线右}
        style={{ background: `linear-gradient(90deg, var(--描边深), ${主色})` }}
      />
      <span className={`${样式.分歧端值} 等宽数字`}>{对方}</span>
    </div>
  );
}

// ── 「问AI代理」横幅 ──────────────────────────────────────────
export function 代理横幅({
  前文,
  强调,
  按下,
  动作文 = '问AI代理 ›',
}: {
  前文: string;
  强调: string;
  按下: () => void;
  /** 右侧动作字样;默认「问AI代理 ›」,发岗收 JD 横幅换成「上传 JD ›」(2026-09-01) */
  动作文?: string;
}) {
  return (
    <button className={`${样式.代理横幅} 可点`} onClick={按下}>
      {/* 标注 21:16：去掉外圈圆底、放大、外轮廓描黑 —— 荧光绿脸 + 墨色描边与眼睛，
          没有底衬也立得住 */}
      <代理标
        尺寸={30}
        脸色="#ffffff"
        眼色="var(--墨)"
        描边色="var(--墨)"
        描边宽={2.6}
      />
      <span className={样式.横幅文字}>
        {前文}
        <b className={样式.横幅强调}>{强调}</b>
      </span>
      <span className={样式.横幅动作}>{动作文}</span>
    </button>
  );
}

// ── 底部代理输入条（点一下跳到对话页）───────────────────────────
export function 代理输入条({ 占位, 按下 }: { 占位: string; 按下: () => void }) {
  return (
    <div className={样式.输入条区}>
      <button className={`${样式.输入条} 可点`} onClick={按下}>
        <span className={`${样式.输入条占位} 单行`}>{占位}</span>
        <span className={样式.发送键}>↑</span>
      </button>
    </div>
  );
}

// ── 可真实输入的底部输入条 ─────────────────────────────────────
export function 真输入条({
  占位,
  值,
  改变,
  发送,
  灰边 = false,
  右侧图标,
}: {
  占位: string;
  值: string;
  改变: (文本: string) => void;
  发送: () => void;
  灰边?: boolean;
  右侧图标?: ReactNode;
}) {
  // 标注 2026-08-24：「输入多了要自动换行」—— 单行 input 换自动长高的 textarea，
  // 随内容长到约 5 行（120px）封顶，之后框内滚动
  const 框 = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const 元 = 框.current;
    if (!元) return;
    元.style.height = 'auto';
    元.style.height = `${Math.min(元.scrollHeight, 120)}px`;
  }, [值]);

  return (
    <div className={样式.输入条区}>
      <div className={`${样式.输入条} ${灰边 ? 样式.灰边 : ''}`}>
        <textarea
          ref={框}
          className={样式.输入框}
          aria-label={占位}
          placeholder={占位}
          value={值}
          rows={1}
          onChange={(事件) => 改变(事件.target.value)}
          onKeyDown={(事件) => {
            // isComposing 挡住中文输入法「回车上屏候选词」那一下，
            // 否则拼音还没上屏就被当成发送，这是中文 App 的必修项；
            // Shift+Enter 留给换行（桌面习惯），手机上发送走右侧按钮
            if (事件.key === 'Enter' && !事件.shiftKey && !事件.nativeEvent.isComposing) {
              事件.preventDefault();
              发送();
            }
          }}
          enterKeyHint="send"
        />
        {右侧图标}
        <button className={`${样式.发送键} 可点`} onClick={发送} aria-label="发送">
          ↑
        </button>
      </div>
    </div>
  );
}

// ── 白卡 ──────────────────────────────────────────────────────
export function 白卡({
  children,
  按下,
  样式覆盖,
  类名,
}: {
  children: ReactNode;
  按下?: () => void;
  样式覆盖?: CSSProperties;
  类名?: string;
}) {
  const 类 = `${样式.白卡} ${按下 ? '可点' : ''} ${类名 ?? ''}`;
  if (按下) {
    return (
      <button className={类} style={样式覆盖} onClick={按下}>
        {children}
      </button>
    );
  }
  return (
    <div className={类} style={样式覆盖}>
      {children}
    </div>
  );
}

// ── 设置行 ────────────────────────────────────────────────────
export function 设置行({
  标题,
  值,
  按下,
  无分隔线 = false,
  徽标,
}: {
  标题: string;
  值: string;
  按下?: () => void;
  无分隔线?: boolean;
  徽标?: string;
}) {
  const 类名 = `${样式.设置行} ${无分隔线 ? 样式.无线 : ''}`;
  const 内容 = (
    <>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        <span className={样式.设置行标题}>{标题}</span>
        {徽标 ? <span className={样式.小徽标}>{徽标}</span> : null}
      </span>
      <span className={样式.设置行值}>{值}</span>
      <span className={样式.尖括号}>›</span>
    </>
  );
  // 同 表单条目：没接交互就不渲染成 button，避免死按钮
  if (按下) {
    return (
      <button className={`${类名} 可点`} onClick={按下}>
        {内容}
      </button>
    );
  }
  return <div className={类名}>{内容}</div>;
}

// ── 表单条目（上方小标签 + 下方大值 + ›）────────────────────────
// 没传 按下 时渲染成 div 且不给手型光标：避免出现「看着能点、点了没反应」的死按钮；
// › 尖括号照设计稿保留（它表达的是「这里将来可进入编辑」）。
export function 表单条目({
  标签,
  值,
  按下,
  徽标,
}: {
  标签: string;
  值: string;
  按下?: () => void;
  徽标?: string;
}) {
  const 内容 = (
    <>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={样式.表单条目标签}>{标签}</span>
        {徽标 ? <span className={样式.小徽标}>{徽标}</span> : null}
      </span>
      <span className={样式.表单条目值行}>
        <span className={`${样式.表单条目值} 单行`}>{值}</span>
        <span className={样式.尖括号}>›</span>
      </span>
    </>
  );
  if (按下) {
    return (
      <button className={`${样式.表单条目} 可点`} onClick={按下}>
        {内容}
      </button>
    );
  }
  return <div className={样式.表单条目}>{内容}</div>;
}

// ── 圆形单选点（选中 = 深绿粗环）───────────────────────────────
export function 单选点({ 选中, 尺寸 = 22 }: { 选中: boolean; 尺寸?: number }) {
  return (
    <span
      className={`${样式.单选点} ${选中 ? 样式.选中 : ''}`}
      style={{
        width: 尺寸,
        height: 尺寸,
        borderWidth: 选中 ? 尺寸 / 3.1 : 1.5,
      }}
    />
  );
}

// ── 开关 ──────────────────────────────────────────────────────
// 禁用（P3）：只挡交互、不加任何视觉态 —— 未水合服务端隐私时「对现雇主隐身」不可写
export function 开关({ 开, 切换, 标签 = '切换此设置', 禁用 = false }: {
  开: boolean; 切换: () => void; 标签?: string; 禁用?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${样式.开关} ${开 ? 样式.开 : ''}`}
      onClick={切换}
      role="switch"
      aria-checked={开}
      aria-label={标签}
      disabled={禁用}
    >
      <span className={样式.开关点} />
    </button>
  );
}

// ── 代理小结托盘 ──────────────────────────────────────────────
export function 小结托盘({
  标签 = '代 理 小 结',
  children,
  样式覆盖,
}: {
  标签?: string;
  children: ReactNode;
  样式覆盖?: CSSProperties;
}) {
  return (
    <div className={样式.小结托盘} style={样式覆盖}>
      <div className={样式.小结标签}>{标签}</div>
      {children}
    </div>
  );
}

// ── 公司字标方块 ───────────────────────────────────────────────
// 传 公司名 且在 公司标映射 里有真 logo 时渲染图片（标注 23:55），否则首字占位
export function 公司字标({
  首字,
  公司名,
  尺寸 = 38,
  圆角 = 11,
  底色 = 'var(--白)',
  字色 = 'var(--墨)',
  描边 = true,
  字号 = 15,
}: {
  首字: string;
  /** 公司全名，用于查真实 logo */
  公司名?: string;
  尺寸?: number;
  圆角?: number;
  底色?: string;
  字色?: string;
  描边?: boolean;
  字号?: number;
}) {
  const 真标 = 公司名 ? 公司标映射[公司名] : undefined;
  return (
    <span
      className={样式.公司字标}
      style={{
        width: 尺寸,
        height: 尺寸,
        borderRadius: 圆角,
        background: 真标 ? 'var(--白)' : 底色,
        color: 字色,
        fontSize: 字号,
        border: 描边 || 真标 ? '1px solid var(--描边)' : 'none',
        overflow: 'hidden',
      }}
    >
      {真标 ? (
        <img
          src={真标}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        首字
      )}
    </span>
  );
}

// ── 滚动区：屏幕内部唯一允许滚动的容器 ─────────────────────────
export function 滚动区({
  children,
  样式覆盖,
}: {
  children: ReactNode;
  样式覆盖?: CSSProperties;
}) {
  return (
    <div className="滚动区" style={{ flex: 1, minHeight: 0, ...样式覆盖 }}>
      {children}
    </div>
  );
}

export { 样式 as 通用样式 };

// ── 加载体感（标注意见：进入首页要有一个加载过程）──────────────

/** 模拟数据加载：挂载后 毫秒 内返回 false，期间渲染骨架屏。
 *  原型数据其实是同步的，这个延迟专门做「App 在拉数据」的真实体感；
 *  接真后端后删掉这个钩子、直接用请求状态即可。 */
export function use模拟加载(毫秒 = 450): boolean {
  const [就绪, 设就绪] = useState(false);
  useEffect(() => {
    const 定时 = setTimeout(() => 设就绪(true), 毫秒);
    return () => clearTimeout(定时);
  }, [毫秒]);
  return 就绪;
}

/** 列表骨架：N 张流光闪烁的占位卡，形状对齐在谈卡（头行 + 两行 + 标签） */
export function 骨架卡组({ 张数 = 3 }: { 张数?: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: 张数 }, (_, 序) => (
        <div key={序} className={样式.骨架卡}>
          <div className={样式.骨架头行}>
            <span className={样式.骨架块} style={{ width: 38, height: 38, borderRadius: 11 }} />
            <span className={样式.骨架块} style={{ width: '38%', height: 14 }} />
            <span className={样式.骨架块} style={{ width: 56, height: 16, marginLeft: 'auto' }} />
          </div>
          <div className={样式.骨架块} style={{ width: '62%', height: 17, marginTop: 12 }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <span className={样式.骨架块} style={{ width: 64, height: 22 }} />
            <span className={样式.骨架块} style={{ width: 48, height: 22 }} />
            <span className={样式.骨架块} style={{ width: 72, height: 22 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
