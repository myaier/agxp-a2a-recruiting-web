// A16 消息Tab · AI代理动态与真人会话
//
// 结构：大标题「消息」+ 放大镜 → 三个筛选页签（全部 / 仅会话 / 通知）
// → 搜索条 → 会话行列表（白底通栏 + 分隔线）。
//
// 两条产品口径（来自设计稿）：
//   · 「通知」= AI代理动态，「仅会话」= 真人 / 直聊，两者互补不重叠
//   · 会话行不放任何操作按钮，点整行进对应会话页

import { useMemo, useRef, useState } from 'react';
import 样式 from './消息列表.module.css';
import { 主页外壳, 滚动区 } from '../组件/通用';
import { 放大镜图标 } from '../组件/图标';
import 代理标 from '../组件/代理标';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { 消息列表 as 消息数据 } from '../数据/模拟数据';
import type { 消息条目 } from '../数据/类型';

/** 三个筛选页签。顺序即设计稿顺序，别改 */
const 页签列表 = ['全部', '仅会话', '通知'] as const;
type 页签 = (typeof 页签列表)[number];

export default function 消息列表() {
  const { 跳转 } = use导航();
  const [当前页签, 设当前页签] = useState<页签>('全部');
  const [搜索词, 设搜索词] = useState('');
  // 点右上角放大镜时把焦点送进搜索框（设计稿里放大镜就是搜索入口）
  const 搜索框引用 = useRef<HTMLInputElement>(null);

  // 先按页签过滤（仅会话 = 去掉 AI代理动态；通知 = 只留 AI代理动态），
  // 再按搜索词在标题 / 副标题 / 摘要三个字段里做包含匹配。
  const 过滤后 = useMemo(() => {
    const 关键词 = 搜索词.trim();
    return 消息数据.filter((条) => {
      if (当前页签 === '仅会话' && 条.类型 === 'AI代理') return false;
      if (当前页签 === '通知' && 条.类型 !== 'AI代理') return false;
      if (!关键词) return true;
      return `${条.标题} ${条.副标题} ${条.摘要}`.includes(关键词);
    });
  }, [当前页签, 搜索词]);

  // 三种会话类型各自对应一个次级页
  const 取跳转路径 = (条: 消息条目) => {
    if (条.类型 === 'AI代理') return 路径.问AI代理;
    if (条.类型 === '直聊') return 路径.直聊会话;
    return 路径.真人会话;
  };

  return (
    <主页外壳>
      {/* 标题行：大标题 + 右侧放大镜 */}
      <div className={样式.标题行}>
        <div className={样式.大标题}>消息</div>
        <button
          className={`${样式.放大镜键} 可点`}
          onClick={() => 搜索框引用.current?.focus()}
          aria-label="搜索"
        >
          <放大镜图标 />
        </button>
      </div>

      {/* 筛选页签行：选中态字重 700 + 墨色，未选 600 + 次级标题色 */}
      <div className={样式.页签行}>
        {页签列表.map((签) => (
          <button
            key={签}
            className={`${签 === 当前页签 ? 样式.页签选中 : 样式.页签未选} 可点`}
            onClick={() => 设当前页签(签)}
          >
            {签}
          </button>
        ))}
      </div>

      <滚动区 样式覆盖={{ paddingTop: 2, paddingBottom: 130 }}>
        {/* 搜索条：设计稿是假条，这里做成真输入框，输入即时过滤列表 */}
        <div className={样式.搜索条}>
          <放大镜图标 尺寸={15} 色="var(--灰白)" 线宽={2} />
          <input
            ref={搜索框引用}
            className={样式.搜索输入}
            placeholder="搜索会话 / 公司 / 职位"
            value={搜索词}
            onChange={(事件) => 设搜索词(事件.target.value)}
          />
        </div>

        {过滤后.length === 0 ? (
          <div className={样式.空态}>
            没有匹配的会话。
            <br />
            换个关键词，或者切到「全部」看看。
          </div>
        ) : (
          过滤后.map((条) => (
            <会话行 key={条.编号} 条={条} 按下={() => 跳转(取跳转路径(条))} />
          ))
        )}
      </滚动区>
    </主页外壳>
  );
}

/** 单条会话行：左头像 + 中间两行文字 + 右侧未读数红胶囊 / 红点 */
function 会话行({ 条, 按下 }: { 条: 消息条目; 按下: () => void }) {
  return (
    <button className={`${样式.会话行} 可点`} onClick={按下}>
      {条.类型 === 'AI代理' ? (
        // AI代理动态：荧光绿圆底 + 盾牌，品牌符号，跟真人头像明显区分
        <span className={样式.代理头像}>
          <代理标 尺寸={24} 脸色="#ffffff" 眼色="var(--荧光绿)" />
        </span>
      ) : (
        // 真人 / 直聊：底色圆头像 + 姓氏首字（无图片资源，用首字占位）
        <span className={样式.头像} style={{ background: 条.底色 ?? 'var(--最弱)' }}>
          {条.首字 ?? ''}
        </span>
      )}

      <span className={样式.正文区}>
        <span className={样式.会话头行}>
          <span className={样式.会话标题}>{条.标题}</span>
          <span className={`${样式.会话副标题} 单行`}>{条.副标题}</span>
          <span className={`${样式.会话时间} 等宽数字`}>{条.时间}</span>
        </span>

        <span className={样式.会话摘要行}>
          <span className={`${样式.会话摘要} 单行`}>{条.摘要}</span>
          {条.未读数 ? (
            <span className={`${样式.未读徽标} 等宽数字`}>{条.未读数}</span>
          ) : 条.红点 ? (
            <span className={样式.红点} />
          ) : null}
        </span>
      </span>
    </button>
  );
}
