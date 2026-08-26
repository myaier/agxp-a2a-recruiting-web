// 初始化页 —— 注册流收尾后的一次性加载页（2026-08-25 用户定稿的乙方案）。
//
// 位置：注册引导最后一步 → 本页 → 替换进主壳。两端同构，只有内容不同：
//   求职端：读简历建档 / 记红线 / 扫市场岗位（带计数）/ 备第一批匹配，上下文 = 当前意向
//   招聘端：读岗位建档 / 记硬性条件 / 候选人市场初筛（带计数）/ 备候选推荐，上下文 = 刚发布的岗位
//
// 步骤清单的竖连线 + 三态圆点致敬 App 内「代谈进度」时间轴 —— 加载页与产品内同一套视觉语言。
// 页面自动播放（总时长 ≈3.4s），播完 替换跳转 进主壳，后退退不回本页。
// 计数是原型的模拟数字；接后端后换成真实扫描进度。

import { useEffect, useRef, useState } from 'react';
import 样式 from './初始化页.module.css';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { use应用状态 } from '../状态/应用状态';

interface 初始化步骤 {
  题: string;
  /** 进行中时的计数行：前缀 + 目标数 + 后缀（只有扫描步有；其余步没有计数行） */
  计数?: { 前缀: string; 目标: number; 后缀: string };
}

/** 各步完成的时刻（毫秒，自进页起算）。前两步是读本地数据，快；扫描步最长 */
const 步骤节奏 = [500, 1100, 2600, 3200];
const 离场时刻 = 3600;

const 求职步骤: 初始化步骤[] = [
  { 题: '读取简历，建立求职档案' },
  { 题: '记下你的求职红线' },
  { 题: '按你的条件扫描市场岗位', 计数: { 前缀: '已扫描 ', 目标: 862, 后缀: ' 个岗位' } },
  { 题: '准备第一批匹配' },
];

const 招聘步骤: 初始化步骤[] = [
  { 题: '读取岗位，建立招聘档案' },
  { 题: '记下岗位的硬性条件' },
  { 题: '在候选人市场里初筛', 计数: { 前缀: '已核对 ', 目标: 316, 后缀: ' 位候选人' } },
  { 题: '准备第一批候选推荐' },
];

export default function 初始化页({ 端 }: { 端: '求职' | '招聘' }) {
  const { 替换跳转 } = use导航();
  const { 状态 } = use应用状态();
  const 步骤组 = 端 === '求职' ? 求职步骤 : 招聘步骤;
  const 扫描步 = 步骤组.findIndex((步) => 步.计数);

  // 上下文胶囊读真实数据：求职端 = 当前意向；招聘端 = 刚发布的岗位（列表末尾那条）。
  // 读不到就不摆胶囊，不放占位假词
  const 上下文 =
    端 === '求职'
      ? { 标: '意向', 值: 状态.当前意向 }
      : { 标: '岗位', 值: 状态.岗位列表.at(-1)?.名称 ?? '' };

  const [完成数, 设完成数] = useState(0);
  const [计数值, 设计数值] = useState(0);
  // 跳转函数装 ref：计时器只在挂载时装一次，不因导航钩子重建而重置节奏
  const 跳 = useRef(替换跳转);
  跳.current = 替换跳转;

  useEffect(() => {
    const 计时器们 = 步骤节奏.map((时刻, 序) =>
      window.setTimeout(() => 设完成数(序 + 1), 时刻),
    );
    const 离场 = window.setTimeout(
      () => 跳.current(端 === '求职' ? 路径.主壳 : 路径.企业主壳),
      离场时刻,
    );
    return () => {
      计时器们.forEach(window.clearTimeout);
      window.clearTimeout(离场);
    };
  }, [端]);

  // 扫描步的计数动画：从该步开始的时刻跑到该步完成，缓动收尾（越接近目标涨得越慢）
  useEffect(() => {
    const 目标 = 步骤组[扫描步]?.计数?.目标;
    if (!目标) return;
    const 起 = 步骤节奏[扫描步 - 1] ?? 0;
    const 止 = 步骤节奏[扫描步];
    const 挂载时刻 = Date.now();
    const 表 = window.setInterval(() => {
      const 进度 = Math.max(0, Math.min(1, (Date.now() - 挂载时刻 - 起) / (止 - 起)));
      设计数值(Math.round(目标 * (1 - (1 - 进度) ** 2)));
    }, 50);
    return () => window.clearInterval(表);
  }, [步骤组, 扫描步]);

  return (
    <div className={样式.页} role="status" aria-label="正在初始化">
      <div className={样式.品牌区}>
        {/* 品牌占位标：圆角六边形蜂巢单元（正式蜂标定稿后替换） */}
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" aria-hidden>
          <polygon
            points="12,2.6 20.2,7.3 20.2,16.7 12,21.4 3.8,16.7 3.8,7.3"
            fill="var(--荧光绿)"
            stroke="var(--深绿文字)"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="2.6" fill="var(--深绿文字)" />
        </svg>
        <div className={样式.品牌名}>工作蜂</div>
        {上下文.值 ? (
          <div className={样式.上下文芯}>
            <span className={样式.芯标}>{上下文.标}</span>
            <span className={样式.芯分} />
            <span className={`${样式.芯值} 单行`}>{上下文.值}</span>
          </div>
        ) : null}
      </div>

      <div className={样式.清单}>
        {步骤组.map((步, 序) => {
          const 态 = 序 < 完成数 ? '完' : 序 === 完成数 ? '转' : '待';
          return (
            <div key={步.题} className={`${样式.步} ${态 === '待' ? 样式.步待 : ''}`}>
              <div className={样式.点位}>
                {态 === '完' ? (
                  <div className={样式.完点}>
                    <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden>
                      <path
                        d="M2.6 7.4 L5.8 10.6 L11.4 3.8"
                        stroke="#fff"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                ) : 态 === '转' ? (
                  <div className={样式.转点} />
                ) : (
                  <div className={样式.待点} />
                )}
              </div>
              <div className={样式.步文}>
                <div className={样式.步题}>{步.题}</div>
                {步.计数 && 态 === '转' ? (
                  <div className={样式.步注}>
                    {步.计数.前缀}
                    <span className={样式.数字}>{计数值}</span>
                    {步.计数.后缀}
                    <span className={样式.跳点组} aria-hidden>
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className={样式.进度区}>
        <div className={样式.进度轨}>
          <div
            className={样式.进度芯}
            style={{ width: `${Math.max(8, (完成数 / 步骤组.length) * 100)}%` }}
          />
        </div>
        <div className={样式.进度计}>
          <span className={样式.数字}>{Math.min(完成数, 步骤组.length)}</span>/
          <span className={样式.数字}>{步骤组.length}</span>
        </div>
      </div>
    </div>
  );
}
