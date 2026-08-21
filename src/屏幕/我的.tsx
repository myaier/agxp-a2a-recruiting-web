// A15 我的Tab · 状态入口 + 功能宫格
//
// 版式（从上到下）：右上三枚工具图标（齿轮带未读红点）→ 头像行（56 圆头像 + 姓名 +
// 对外画像 + 状态胶囊）→ 四个统计数 → 代理状态毛玻璃卡 → 常用/其他功能宫格 → 页脚小字。
// 数值全部照 RN 版（duixi-app/应用/屏幕/我的.js）与设计稿 A15 一比一搬。
//
// 屏内只有「功能宫格 + 页脚」这一段滚动，上半部分（头像 / 统计 / 代理卡）钉住不动 ——
// 这是设计稿的意图：个人状态是常驻信息，功能入口才是可翻的列表。

import { useEffect, useState, type ComponentType } from 'react';
import 样式 from './我的.module.css';
import { 主页外壳, 滚动区 } from '../组件/通用';
import {
  齿轮图标,
  铃铛图标,
  身份切换图标,
  简历图标,
  靶心图标,
  旗帜图标,
  禁止图标,
  层级图标,
  归档图标,
  问号图标,
} from '../组件/图标';
import 代理标 from '../组件/代理标';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { 我的信息 } from '../数据/模拟数据';
import { use应用状态 } from '../状态/应用状态';

/** 图标.tsx 里所有图标共用的属性签名 —— 宫格数据里要存「图标组件本身」，所以需要这个类型 */
type 图标组件 = ComponentType<{ 尺寸?: number; 色?: string; 线宽?: number }>;

/** 宫格里的一格。目标为 null 表示原型里还没有对应屏，点了给一条浮层提示 */
interface 宫格条目 {
  名称: string;
  图标: 图标组件;
  目标: string | null;
}

/** 统计数的取色：模拟数据里存的是语义色名，这里翻成 CSS 变量（对齐 RN 版的三档配色） */
function 取统计色(色名: string): string {
  if (色名 === '深绿') return 'var(--深绿)';
  if (色名 === '次要') return 'var(--次要浅)';
  return 'var(--墨)';
}

export default function 我的() {
  const { 跳转 } = use导航();
  const { 状态 } = use应用状态();
  // 齿轮红点跟着真实未读数走，不再是写死的装饰
  const 未读通知 = 状态.通知列表.filter((条) => !条.已读).length;

  // 四个统计数改成从真实状态算：在详情页接受/退出之后，这里要立刻跟着变，
  // 否则用户做完决策回到「我的」看到的还是建档时写死的数字
  const 统计 = [
    { 数值: String(状态.在谈列表.length), 名称: '在谈', 色: '墨' },
    {
      数值: String(状态.在谈列表.filter((条) => 条.阶段 === '匿名初筛').length),
      名称: '初筛中',
      色: '深绿',
    },
    {
      数值: String(状态.在谈列表.filter((条) => 条.需要你).length),
      名称: '待你拍',
      色: '深绿',
    },
    { 数值: String(状态.归档列表.length), 名称: '已归档', 色: '次要' },
  ];

  // 尚未实现的入口（屏蔽名单 / 帮助与客服 / 右上三枚工具图标）点了弹一条浮层提示，
  // 保证每个可点元素都有真实反馈，而不是按下去毫无动静的死按钮
  const [提示, 设提示] = useState<string | null>(null);
  useEffect(() => {
    if (!提示) return;
    const 定时器 = window.setTimeout(() => 设提示(null), 1600);
    return () => window.clearTimeout(定时器);
  }, [提示]);

  const 常用功能: 宫格条目[] = [
    { 名称: '我的简历', 图标: 简历图标, 目标: 路径.我的简历 },
    { 名称: '求职意向', 图标: 靶心图标, 目标: 路径.求职意向管理 },
    { 名称: 'AI代理规则库', 图标: 旗帜图标, 目标: 路径.规则库 },
    { 名称: '屏蔽名单', 图标: 禁止图标, 目标: 路径.屏蔽名单 },
  ];
  const 其他功能: 宫格条目[] = [
    { 名称: '披露偏好', 图标: 层级图标, 目标: 路径.披露偏好 },
    { 名称: '历史接洽', 图标: 归档图标, 目标: 路径.归档谈判 },
    { 名称: '帮助与客服', 图标: 问号图标, 目标: 路径.帮助与客服 },
  ];

  /** 宫格 / 工具图标的统一点击：有目标就跳转，没有就提示 */
  const 打开 = (目标: string | null, 名称: string) => {
    if (目标) 跳转(目标);
    else 设提示(`${名称} 正在开发中`);
  };

  return (
    <主页外壳>
      {/* ── 右上工具行：切换身份 / 通知 / 设置（设置带未读红点）── */}
      <div className={样式.工具行}>
        {/* 切身份进选身份页让用户自己挑，而不是直接甩到另一端（标注意见 2026-08-18）*/}
        <button
          className={`${样式.工具键} 可点`}
          onClick={() => 跳转(路径.切换身份自求职端)}
          aria-label="切换身份"
        >
          <身份切换图标 />
        </button>
        <button
          className={`${样式.工具键} 可点`}
          onClick={() => 跳转(路径.通知中心)}
          aria-label="通知"
        >
          <铃铛图标 />
          {/* 有未读通知才亮红点，数字挂在铃铛上 */}
          {未读通知 > 0 ? (
            <span className={样式.未读数}>{未读通知 > 9 ? '9+' : 未读通知}</span>
          ) : null}
        </button>
        <button
          className={`${样式.工具键} 可点`}
          onClick={() => 跳转(路径.设置)}
          aria-label="设置"
        >
          <齿轮图标 />
        </button>
      </div>

      {/* ── 头像行：整行可点，进「我的简历」（= 对外画像的编辑入口）── */}
      <button className={`${样式.头像行} 可点`} onClick={() => 跳转(路径.我的简历)}>
        <span className={样式.头像}>{我的信息.首字}</span>
        <span className={样式.头像信息}>
          <span className={`${样式.姓名} 单行`}>{我的信息.姓名}</span>
          <span className={样式.状态行}>
            <span className={样式.对外画像}>对外画像 ✎</span>
            <span className={`${样式.状态胶囊} 单行`}>{我的信息.状态}</span>
          </span>
        </span>
        <span className={样式.尖括号}>›</span>
      </button>

      {/* ── 四个统计数：在谈 / 暂缓 / 待确认 / 已归档 ── */}
      <div className={样式.统计行}>
        {统计.map((项) => (
          <div key={项.名称} className={样式.统计项}>
            <span className={`${样式.统计数} 等宽数字`} style={{ color: 取统计色(项.色) }}>
              {项.数值}
            </span>
            <span className={样式.统计名}>{项.名称}</span>
          </div>
        ))}
      </div>

      {/* ── 代理状态毛玻璃卡：压在顶部渐变头上，「管理 ›」进规则库 ── */}
      <button className={`${样式.代理卡} 可点`} onClick={() => 跳转(路径.规则库)}>
        <代理标
          尺寸={30}
          脸色="#ffffff"
          眼色="var(--墨)"
          描边色="var(--墨)"
          描边宽={2.6}
        />
        <span className={样式.代理文字}>
          <span className={样式.代理标题行}>
            <span className={样式.代理标题}>我的求职AI代理</span>
            {/* 在线绿点：代理正在后台并行谈判的可视信号 */}
            <span className={样式.在线点} />
          </span>
          <span className={`${样式.代理状态} 单行`}>
            在线 · 正在跟进 {状态.在谈列表.length} 个机会 · 规则{' '}
            {状态.全局规则.filter((条) => 条.生效).length +
              状态.意向级规则.filter((条) => 条.生效).length}{' '}
            条生效
          </span>
        </span>
        <span className={样式.管理}>管理 ›</span>
      </button>

      {/* ── 功能宫格区：屏内唯一滚动容器，底部留 130 给悬浮玻璃导航 ── */}
      <滚动区>
        <div className={样式.功能区}>
          <宫格卡 标题="常用功能" 项目={常用功能} 打开={打开} 主色 />
          <宫格卡 标题="其他功能" 项目={其他功能} 打开={打开} />
          <div className={样式.页脚}>
            服务热线 400-000-0000 · 工作时间 8:00–22:00
            <br />
            人力资源服务许可证 · 算法举报 · 资质证照
          </div>
        </div>
      </滚动区>

      {/* 浮层提示：未实现入口的兜底反馈，1.6 秒后自动消失 */}
      {提示 ? <div className={样式.浮层提示}>{提示}</div> : null}
    </主页外壳>
  );
}

/**
 * 功能宫格卡：白卡 + 标题 + 4 列图标格。
 * 主色 = true 时图标底用淡绿底 + 深绿描线（常用功能），否则用浅灰底 + 次要色（其他功能），
 * 靠这一层颜色差把「常用」和「其他」在视觉上分开，而不用额外的分组标题层级。
 */
function 宫格卡({
  标题,
  项目,
  打开,
  主色 = false,
}: {
  标题: string;
  项目: 宫格条目[];
  打开: (目标: string | null, 名称: string) => void;
  主色?: boolean;
}) {
  return (
    <div className={样式.宫格卡}>
      <div className={样式.宫格标题}>{标题}</div>
      <div className={样式.宫格}>
        {项目.map((项) => {
          const 图标 = 项.图标;
          return (
            <button
              key={项.名称}
              className={`${样式.宫格项} 可点`}
              onClick={() => 打开(项.目标, 项.名称)}
            >
              <span className={`${样式.宫格图标底} ${主色 ? '' : 样式.次色底}`}>
                <图标 色={主色 ? 'var(--深绿)' : 'var(--次要)'} />
              </span>
              <span className={样式.宫格名}>{项.名称}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
